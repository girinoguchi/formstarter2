import { createHash } from "node:crypto";

import type { FieldClassification } from "../domain/entities/field-classification";
import type { ParsedForm, ParsedFormField } from "../domain/entities/form-field";
import type { Profile } from "../domain/entities/profile";
import type { Run } from "../domain/entities/run";
import type { Target } from "../domain/entities/target";
import type { BrowserSession } from "../domain/ports/browser-session.port";
import type { BrowserSessionFactory } from "../domain/ports/browser-session-factory.port";
import type { ConfirmationPageDetector } from "../domain/ports/confirmation-page-detector.port";
import type { ContactPageFinder } from "../domain/ports/contact-page-finder.port";
import type { FieldClassifier } from "../domain/ports/field-classifier.port";
import type { FieldFillFailure, FormFiller } from "../domain/ports/form-filler.port";
import type { FormParser } from "../domain/ports/form-parser.port";
import type { ProfileRepository } from "../domain/ports/profile-repository.port";
import type { RunRepository } from "../domain/ports/run-repository.port";
import type { ScreenshotService } from "../domain/ports/screenshot-service.port";
import type { TargetRepository } from "../domain/ports/target-repository.port";
import type { ValidationErrorParser } from "../domain/ports/validation-error-parser.port";
import { CONTEXT_KEPT_OPEN_RUN_STATUSES, type RunStatus } from "../domain/value-objects/run-status";
import { CONTACT_PAGE_CONFIDENCE_THRESHOLD } from "../config/constants";
import type { StaticFormChecker } from "../domain/ports/static-form-checker.port";
import type { SentPageDetector } from "../domain/ports/sent-page-detector.port";
import type { RunKind } from "../domain/value-objects/run-kind";

const MAX_VALIDATION_RETRY_ATTEMPTS = 2;

const NAV_TIMEOUT_MS = 30_000;
const NAME_OR_LABEL_NAME_PATTERN = /name|氏名|お名前|担当者/i;
const EMAIL_PATTERN = /email|mail|メール/i;
const SUBMIT_LIKE_TEXT_PATTERN = /送信|contact|submit|send|確認/i;

/**
 * 対象1件分の自動化を指揮する。EXPLORE / FILL の2種類のRunを完全に分離している:
 *
 * - EXPLORE（explore/exploreAndAwaitCompletion → exploreToCompletion）
 *   可視タブを一切開かずに「送信可能かどうか」だけを確認する。まずfetch+Cheerioの
 *   静的探索（ブラウザ不使用、FormStarterapp同様の方針）を試し、見つからない/フォームが
 *   確認できない場合のみ非表示(headless)のPlaywrightにフォールバックする（probeSendable）。
 *   見つかった場合はTarget.status/contactPageUrlを READY として確定するだけで終わる
 *   ——この段階では入力も確認画面遷移も行わない。CSVインポート直後に自動でこれが
 *   全件に対して走る想定（ExplorePool）。
 * - FILL（execute → fillToCompletion）
 *   Target.status が READY（＝EXPLOREで送信可能と確認済み、contactPageUrlも判明済み）
 *   であることを前提に、headedブラウザで実際に問い合わせページへ遷移・入力・確認画面まで
 *   進める。一覧の行ボタンから1件ずつ手動で開始する（自動でまとめて複数タブが開くことはない）。
 *
 * LLMフォールバックは使わない方針のため分類はルールベースのみで完結し、判定できない項目は
 * 未入力のまま残る（推測で埋めない）。各中間チェックポイントでのRun.statusは
 * 「そのステージ自身のstatus」のまま終える——「未実装の先のステージに進んだ」という嘘をつかないための設計。
 *
 * ブラウザコンテキストを最後に閉じるかどうかは CONTEXT_KEPT_OPEN_RUN_STATUSES を
 * 単一の判断基準にする（FILLのみに適用——EXPLOREは可視タブを持たない）。
 * NOT_SENDABLE等「人間が見るかもしれない」終端状態では開いたままにする。
 *
 * execute()/explore() はRun行の作成までを待ち受けて即座にRunを返す。実際のブラウザ操作は
 * バックグラウンドで継続する（このアプリはローカルの長時間稼働Node.jsプロセスとして動くため、
 * Vercelサーバーレス向けの next/server の after() は使わず、単純なfire-and-forgetで十分）。
 */
export class RunOrchestrator {
  constructor(
    private readonly headedSessionFactory: BrowserSessionFactory,
    private readonly headlessSessionFactory: BrowserSessionFactory,
    private readonly screenshotService: ScreenshotService,
    private readonly runRepository: RunRepository,
    private readonly targetRepository: TargetRepository,
    private readonly httpContactPageFinder: ContactPageFinder,
    private readonly playwrightContactPageFinder: ContactPageFinder,
    private readonly staticFormChecker: StaticFormChecker,
    private readonly formParser: FormParser,
    private readonly fieldClassifier: FieldClassifier,
    private readonly formFiller: FormFiller,
    private readonly profileRepository: ProfileRepository,
    private readonly validationErrorParser: ValidationErrorParser,
    private readonly confirmationPageDetector: ConfirmationPageDetector,
    private readonly sentPageDetector: SentPageDetector,
  ) {}

  /** CSVインポート後のExplorePool用/UIの「探索」用: Run行の作成まで待ち、あとはバックグラウンドで継続する。 */
  async explore(targetId: string): Promise<Run> {
    const { target, run } = await this.startRun(targetId, "EXPLORE");

    void this.exploreToCompletion(target, run).catch((error: unknown) => {
      console.error(`[RunOrchestrator] unexpected explore failure for run ${run.id}:`, error);
    });

    return run;
  }

  /** ExplorePool（並列実行）用: 完了まで待つ。 */
  async exploreAndAwaitCompletion(targetId: string): Promise<Run> {
    const { target, run } = await this.startRun(targetId, "EXPLORE");
    await this.exploreToCompletion(target, run);
    return run;
  }

  /** UIの「実行」ボタン用: Run行の作成まで待ち、あとはバックグラウンドで継続する（fire-and-forget）。 */
  async execute(targetId: string): Promise<Run> {
    const { target, run } = await this.startRun(targetId, "FILL");

    void this.fillToCompletion(target, run).catch((error: unknown) => {
      // fillToCompletion内で全例外を捕捉しているため通常ここには来ないが、
      // 想定外の失敗（DB書き込み自体の失敗など）を握りつぶさずログだけ残す。
      console.error(`[RunOrchestrator] unexpected failure for run ${run.id}:`, error);
    });

    return run;
  }

  private async startRun(targetId: string, kind: RunKind): Promise<{ target: Target; run: Run }> {
    const target = await this.targetRepository.findById(targetId);
    if (!target) throw new Error(`Target not found: ${targetId}`);
    if (kind === "FILL" && !target.contactPageUrl) {
      throw new Error(`Target ${targetId} is not READY yet (探索が完了していません)`);
    }

    await this.targetRepository.updateStatus(targetId, "RUNNING");
    const run = await this.runRepository.create(targetId, kind);
    return { target, run };
  }

  /**
   * EXPLORE専用フロー。可視タブは一切開かない。probeSendable()の結果をそのまま
   * Target/Runへ確定させるだけで終わる（入力は行わない）。
   */
  private async exploreToCompletion(target: Target, run: Run): Promise<void> {
    await this.runRepository.updateStatus(run.id, "LOADING_SITE", { startedAt: new Date() });

    const probe = await this.probeSendable(target, run).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false as const,
        finalStatus: "FAILED" as const,
        errorStep: "SITE_UNREACHABLE",
        errorMessage: message,
      };
    });

    if (!probe.ok) {
      await this.runRepository.appendLog(
        run.id,
        probe.finalStatus === "FAILED" ? "ERROR" : "WARN",
        probe.errorStep,
        probe.errorMessage ??
          (probe.errorStep === "NO_FORM_FOUND"
            ? "フォームが見つかりませんでした"
            : "問い合わせページが見つかりませんでした"),
      );
      await this.runRepository.updateStatus(run.id, probe.finalStatus, {
        errorStep: probe.errorStep,
        errorMessage: probe.errorMessage,
        finishedAt: new Date(),
      });
      await this.targetRepository.updateStatus(target.id, probe.finalStatus);
      // 送信可能と判定できなかったターゲットは、可視タブを一切開かずここで終了する。
      return;
    }

    await this.runRepository.appendLog(
      run.id,
      "INFO",
      "READY",
      `送信可能なフォームが見つかりました: ${probe.contactPageUrl}`,
    );
    await this.runRepository.updateStatus(run.id, "READY", {
      contactPageUrl: probe.contactPageUrl,
      finishedAt: new Date(),
    });
    await this.targetRepository.updateStatus(target.id, "READY", { contactPageUrl: probe.contactPageUrl });
  }

  /**
   * FILL専用フロー。target.contactPageUrl（EXPLOREで確定済み）へ直接遷移し、
   * 入力〜確認画面までをheadedブラウザ（可視タブ）で行う。
   */
  private async fillToCompletion(target: Target, run: Run): Promise<void> {
    const contactPageUrl = target.contactPageUrl;
    if (!contactPageUrl) {
      // startRun()でガード済みのため通常到達しないが、型上はnullableなので防御的に扱う。
      await this.runRepository.appendLog(run.id, "ERROR", "NOT_READY", "送信可能なURLが未確定です");
      await this.runRepository.updateStatus(run.id, "FAILED", {
        errorStep: "NOT_READY",
        finishedAt: new Date(),
      });
      await this.targetRepository.updateStatus(target.id, "FAILED");
      return;
    }

    const windowLabel = target.companyName ?? safeHostname(target.url);
    await this.runRepository.updateStatus(run.id, "LAUNCHING_BROWSER", { startedAt: new Date(), windowLabel });
    await this.runRepository.appendLog(run.id, "INFO", "BROWSER_LAUNCHED", "headedブラウザを起動しました");

    const acquired = await this.headedSessionFactory.acquire(windowLabel);

    let finalStatus: RunStatus = "PENDING";

    try {
      await this.runRepository.updateStatus(run.id, "LOADING_SITE", { contactPageUrl });
      await acquired.session.goto(contactPageUrl, { timeoutMs: NAV_TIMEOUT_MS });
      await this.runRepository.appendLog(run.id, "INFO", "URL_ACCESSED", `${contactPageUrl} にアクセスしました`);

      const contactScreenshotPath = await this.screenshotService.capture(acquired.session, run.id, "CONTACT_PAGE");
      await this.runRepository.addScreenshot(run.id, "CONTACT_PAGE", contactScreenshotPath);
      await this.runRepository.appendLog(
        run.id,
        "INFO",
        "CONTACT_PAGE_CAPTURED",
        "問い合わせページのスクリーンショットを保存しました",
      );

      await this.runRepository.updateStatus(run.id, "PARSING_FORM");
      const forms = await this.formParser.parseForms(acquired.session);

      if (forms.length === 0) {
        await this.runRepository.appendLog(run.id, "WARN", "NO_FORM_FOUND", "フォームが見つかりませんでした");
        finalStatus = "NOT_SENDABLE";
        await this.runRepository.updateStatus(run.id, finalStatus, {
          errorStep: "NO_FORM_FOUND",
          finishedAt: new Date(),
        });
        await this.targetRepository.updateStatus(target.id, finalStatus);
        return;
      }

      const bestForm = pickBestForm(forms);
      await this.runRepository.appendLog(
        run.id,
        "INFO",
        "FORM_PARSED",
        `フォームを検出しました（${bestForm.fields.length}項目、候補${forms.length}件中から選択）`,
        { fields: bestForm.fields },
      );
      await this.runRepository.updateStatus(run.id, "PARSING_FORM", { formSelector: bestForm.formSelector });

      await this.runRepository.updateStatus(run.id, "CLASSIFYING_FIELDS");
      const hostKey = safeHostname(contactPageUrl);
      const formSignatureHash = computeFormSignatureHash(bestForm);
      const classifications = await this.fieldClassifier.classify(bestForm.fields, { hostKey, formSignatureHash });
      await this.runRepository.addFieldClassifications(run.id, classifications);

      const unknownCount = classifications.filter((c) => c.category === "UNKNOWN").length;
      await this.runRepository.appendLog(
        run.id,
        "INFO",
        "FIELD_CLASSIFICATION_COMPLETE",
        `${classifications.length}項目を分類しました（未分類: ${unknownCount}件）`,
        { classifications },
      );

      await this.runRepository.updateStatus(run.id, "CLASSIFYING_FIELDS", { finishedAt: new Date() });

      const activeProfile = await this.profileRepository.getActive();
      if (!activeProfile) {
        await this.runRepository.appendLog(
          run.id,
          "WARN",
          "PROFILE_NOT_CONFIGURED",
          "入力プロフィールが未設定のため入力できません",
        );
        finalStatus = "NEEDS_REVIEW";
        await this.runRepository.updateStatus(run.id, finalStatus, {
          errorStep: "PROFILE_NOT_CONFIGURED",
          finishedAt: new Date(),
        });
        await this.targetRepository.updateStatus(target.id, finalStatus);
        return;
      }

      // {{company}}/{{url}} をこのターゲット向けに展開したプロフィールを使う
      // （テンプレートタブの「変数」表記どおりの挙動）。
      const profile: Profile = {
        ...activeProfile,
        inquiryType: substituteTemplateVariables(activeProfile.inquiryType, target),
        inquiryBody: substituteTemplateVariables(activeProfile.inquiryBody, target),
      };

      await this.runRepository.updateStatus(run.id, "FILLING_FORM");
      const fillFailures = await this.formFiller.fill(acquired.session, bestForm.fields, classifications, profile);
      await this.runRepository.appendLog(run.id, "INFO", "FILL_COMPLETE", "フォームへの入力が完了しました");

      const hasRequiredFillFailure = fillFailures.length > 0 && (await this.reportFillFailures(run, fillFailures));

      const afterFillScreenshotPath = await this.screenshotService.capture(acquired.session, run.id, "AFTER_FILL");
      await this.runRepository.addScreenshot(run.id, "AFTER_FILL", afterFillScreenshotPath);

      if (hasRequiredFillFailure) {
        // 必須項目が入力できていない場合、確認ボタンを押しても弾かれるだけなので
        // ここで打ち切り、可視タブを開いたまま人間に残りを埋めてもらう。
        finalStatus = "NEEDS_REVIEW";
        await this.runRepository.updateStatus(run.id, finalStatus, {
          errorStep: "FIELD_FILL_FAILED",
          finishedAt: new Date(),
        });
        await this.targetRepository.updateStatus(target.id, finalStatus);
        return;
      }

      const formFrameUrl = bestForm.frameUrl ?? undefined;

      const filledOk = await this.retryValidationErrors(
        run,
        acquired.session,
        bestForm.fields,
        classifications,
        profile,
        formFrameUrl,
      );
      if (!filledOk) {
        finalStatus = "NEEDS_REVIEW";
        await this.runRepository.updateStatus(run.id, finalStatus, {
          errorStep: "VALIDATION_FAILED",
          finishedAt: new Date(),
        });
        await this.targetRepository.updateStatus(target.id, finalStatus);
        return;
      }

      const confirmButton = this.confirmationPageDetector.findSafeConfirmButton(bestForm.fields);
      if (confirmButton) {
        await this.runRepository.appendLog(
          run.id,
          "INFO",
          "CONFIRM_BUTTON_CLICKED",
          `確認ボタンをクリックします: ${confirmButton.label ?? confirmButton.value ?? confirmButton.selector}`,
        );
        await acquired.session.click(confirmButton.selector, { frameUrl: confirmButton.frameUrl ?? undefined });

        const stillHasErrors = !(await this.retryValidationErrors(
          run,
          acquired.session,
          bestForm.fields,
          classifications,
          profile,
          formFrameUrl,
        ));
        if (stillHasErrors) {
          finalStatus = "NEEDS_REVIEW";
          await this.runRepository.updateStatus(run.id, finalStatus, {
            errorStep: "VALIDATION_FAILED",
            finishedAt: new Date(),
          });
          await this.targetRepository.updateStatus(target.id, finalStatus);
          return;
        }
      }

      await this.runRepository.updateStatus(run.id, "REACHED_CONFIRMATION");
      const confirmationScreenshotPath = await this.screenshotService.capture(
        acquired.session,
        run.id,
        "CONFIRMATION_PAGE",
      );
      await this.runRepository.addScreenshot(run.id, "CONFIRMATION_PAGE", confirmationScreenshotPath);
      await this.runRepository.appendLog(
        run.id,
        "INFO",
        "REACHED_CONFIRMATION",
        confirmButton ? "確認画面に到達しました" : "確認ボタンが見つからないため入力完了時点を確認状態とします",
      );

      // 送信ボタンをクリックするコードパスはこのクラス・FormFillerのどちらにも存在しない。
      // ここでは「送信待ち」であることをUI/ログに記録し、ブラウザは開いたまま人間の操作を待つ。
      finalStatus = "AWAITING_SEND";
      await this.runRepository.updateStatus(run.id, finalStatus, { finishedAt: new Date() });
      await this.targetRepository.updateStatus(target.id, finalStatus);
      await this.runRepository.appendLog(run.id, "INFO", "AWAITING_SEND", "送信待ち — 人間の操作をお待ちください");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finalStatus = "FAILED";
      await this.runRepository.updateStatus(run.id, finalStatus, {
        errorStep: "SITE_UNREACHABLE",
        errorMessage: message,
        finishedAt: new Date(),
      });
      await this.runRepository.appendLog(run.id, "ERROR", "SITE_UNREACHABLE", message);
      await this.targetRepository.updateStatus(target.id, finalStatus);
    } finally {
      // AWAITING_SEND/NEEDS_REVIEW/BLOCKED/NOT_SENDABLE はタブを開いたまま残し、
      // 人間が内容を確認できるようにする。FAILEDのみ即座に閉じる。
      if (CONTEXT_KEPT_OPEN_RUN_STATUSES.includes(finalStatus)) {
        if (finalStatus === "AWAITING_SEND") {
          // 人間が実際に送信ボタンを押した後に表示される「送信完了ページ」への遷移を
          // 観測するだけのリスナー——このアプリ自身が送信ボタンを押すことは絶対にない。
          acquired.session.onNavigation((info) => {
            if (!this.sentPageDetector.isSentConfirmationPage(info)) return;
            void this.runRepository.markSent(run.id).catch((error: unknown) => {
              console.error(`[RunOrchestrator] markSent failed for run ${run.id}:`, error);
            });
            void this.targetRepository.updateStatus(target.id, "SENT").catch((error: unknown) => {
              console.error(`[RunOrchestrator] target status SENT failed for run ${run.id}:`, error);
            });
            void this.runRepository.appendLog(
              run.id,
              "INFO",
              "SENT_DETECTED",
              `送信完了ページへの遷移を検知しました: ${info.url}`,
            );
          });
        }

        // 人間が実際にタブを閉じたら「開いているタブ」一覧から消えるようにclosedAtを記録する。
        // execute()はfillToCompletion()をfire-and-forgetしているため、ここでawaitせず
        // バックグラウンドで待っても誰もブロックしない（HTTPレスポンス等には影響しない）。
        void acquired.session
          .waitForClose()
          .then(() => this.runRepository.markClosed(run.id))
          .catch((error: unknown) => {
            console.error(`[RunOrchestrator] waitForClose failed for run ${run.id}:`, error);
          });
      } else {
        await acquired.release();
      }
    }
  }

  /**
   * 可視タブを開く前に「送信可能かどうか」だけを確認する。まずfetch+Cheerioの
   * 静的探索（ブラウザ不使用）を試し、見つからない/フォームがない場合のみ
   * 非表示(headless)のPlaywrightにフォールバックする。ここで見つからなければ
   * 可視タブは一切開かずに終了する——探索の失敗を人間に見せる必要はないため。
   */
  private async probeSendable(
    target: Target,
    run: Run,
  ): Promise<
    | { ok: true; contactPageUrl: string }
    | { ok: false; finalStatus: "NOT_SENDABLE" | "FAILED"; errorStep: string; errorMessage?: string }
  > {
    await this.runRepository.appendLog(
      run.id,
      "INFO",
      "STATIC_PROBE_STARTED",
      "静的探索（ブラウザ不使用）で問い合わせフォームを探しています",
    );

    const httpResult = await this.httpContactPageFinder
      .findContactPage(target.url)
      .catch(() => ({ contactPageUrl: null, confidence: 0 }));

    if (httpResult.contactPageUrl && httpResult.confidence >= CONTACT_PAGE_CONFIDENCE_THRESHOLD) {
      const hasForm = await this.staticFormChecker.hasFillableForm(httpResult.contactPageUrl);
      if (hasForm) {
        await this.runRepository.appendLog(
          run.id,
          "INFO",
          "STATIC_PROBE_SUCCESS",
          `静的探索でフォームを検出しました: ${httpResult.contactPageUrl}`,
        );
        return { ok: true, contactPageUrl: httpResult.contactPageUrl };
      }
    }

    await this.runRepository.appendLog(
      run.id,
      "INFO",
      "HEADLESS_PROBE_STARTED",
      "静的探索で確認できなかったため、非表示ブラウザで再探索します",
    );

    const headless = await this.headlessSessionFactory.acquire(`${target.id}-probe`);
    try {
      await headless.session.goto(target.url, { timeoutMs: NAV_TIMEOUT_MS });

      let contactPageUrl = httpResult.contactPageUrl;
      if (!contactPageUrl) {
        const pwResult = await this.playwrightContactPageFinder.findContactPage(target.url, headless.session);
        contactPageUrl = pwResult.contactPageUrl;
      }

      if (!contactPageUrl) {
        return { ok: false, finalStatus: "NOT_SENDABLE", errorStep: "CONTACT_PAGE_NOT_FOUND" };
      }

      await headless.session.goto(contactPageUrl, { timeoutMs: NAV_TIMEOUT_MS });
      const forms = await this.formParser.parseForms(headless.session);
      if (forms.length === 0) {
        return { ok: false, finalStatus: "NOT_SENDABLE", errorStep: "NO_FORM_FOUND" };
      }

      await this.runRepository.appendLog(
        run.id,
        "INFO",
        "HEADLESS_PROBE_SUCCESS",
        `非表示ブラウザでフォームを検出しました: ${contactPageUrl}`,
      );
      return { ok: true, contactPageUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, finalStatus: "FAILED", errorStep: "SITE_UNREACHABLE", errorMessage: message };
    } finally {
      await headless.release();
    }
  }

  /**
   * FormFiller.fill()が個別に諦めたフィールド（非表示要素等でtimeoutした等）をログに残す。
   * required項目が1つでも含まれていれば true を返し、呼び出し側はこの後の確認画面遷移を
   * 諦めてNEEDS_REVIEWで打ち切る（必須項目欠落のまま確認へ進んでも弾かれるだけのため）。
   */
  private async reportFillFailures(run: Run, failures: readonly FieldFillFailure[]): Promise<boolean> {
    await this.runRepository.appendLog(
      run.id,
      "WARN",
      "FIELD_FILL_FAILED",
      `${failures.length}件のフィールドで入力に失敗しました（非表示要素等）`,
      { failures },
    );
    return failures.some((f) => f.required);
  }

  /**
   * バリデーションエラーが出ているフィールドのみ最大 MAX_VALIDATION_RETRY_ATTEMPTS 回まで
   * 再入力する。最終的にエラーが残っていなければ true、残っていれば false を返す。
   */
  private async retryValidationErrors(
    run: Run,
    session: BrowserSession,
    fields: readonly ParsedFormField[],
    classifications: readonly FieldClassification[],
    profile: Profile,
    frameUrl?: string,
  ): Promise<boolean> {
    let attemptsLeft = MAX_VALIDATION_RETRY_ATTEMPTS;
    let errors = await this.validationErrorParser.findErrors(session, frameUrl);

    while (errors.length > 0 && attemptsLeft > 0) {
      await this.runRepository.updateStatus(run.id, "HANDLING_VALIDATION");
      await this.runRepository.appendLog(
        run.id,
        "WARN",
        "VALIDATION_ERROR_DETECTED",
        `${errors.length}件のフィールドでエラーを検出しました。再入力します（残り${attemptsLeft}回）`,
        { errors },
      );

      const erroredSelectors = new Set(errors.map((e) => e.selector));
      const retryClassifications = classifications.filter((c) => erroredSelectors.has(c.fieldSelector));
      await this.formFiller.fill(session, fields, retryClassifications, profile);

      attemptsLeft -= 1;
      errors = await this.validationErrorParser.findErrors(session, frameUrl);
    }

    if (errors.length > 0) {
      await this.runRepository.appendLog(
        run.id,
        "ERROR",
        "VALIDATION_FAILED",
        `再試行後も${errors.length}件のフィールドでエラーが解消しませんでした`,
        { errors },
      );
      return false;
    }

    return true;
  }
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * 1ページに複数<form>がある場合の判別。email項目・氏名項目・送信/確認らしいボタン文言の
 * 有無に加点し、項目数をベースにする単純なスコアリング。
 */
function pickBestForm(forms: readonly ParsedForm[]): ParsedForm {
  let best = forms[0];
  let bestScore = scoreForm(best);

  for (const form of forms.slice(1)) {
    const score = scoreForm(form);
    if (score > bestScore) {
      best = form;
      bestScore = score;
    }
  }

  return best;
}

/** 同一サイト・同一form構造かどうかを判定するための簡易シグネチャ（分類結果のログ相関用）。 */
function computeFormSignatureHash(form: ParsedForm): string {
  const signature = form.fields
    .map((f) => `${f.name ?? ""}|${f.id ?? ""}|${f.type}`)
    .sort()
    .join(";");
  return createHash("sha1").update(signature).digest("hex").slice(0, 16);
}

function scoreForm(form: ParsedForm): number {
  let score = form.fields.length;

  const hasEmail = form.fields.some(
    (f) => f.type === "email" || EMAIL_PATTERN.test(f.name ?? "") || EMAIL_PATTERN.test(f.label ?? ""),
  );
  const hasName = form.fields.some(
    (f) => NAME_OR_LABEL_NAME_PATTERN.test(f.label ?? "") || NAME_OR_LABEL_NAME_PATTERN.test(f.name ?? ""),
  );
  const hasSubmitLikeButton = form.fields.some(
    (f) =>
      (f.type === "submit" || f.type === "button") &&
      (SUBMIT_LIKE_TEXT_PATTERN.test(f.label ?? "") || SUBMIT_LIKE_TEXT_PATTERN.test(f.value ?? "")),
  );

  if (hasEmail) score += 5;
  if (hasName) score += 3;
  if (hasSubmitLikeButton) score += 3;

  return score;
}

/** テンプレート内の {{company}} / {{url}} をターゲットの値に置き換える。 */
function substituteTemplateVariables(text: string, target: Target): string {
  const companyName = target.companyName ?? safeHostname(target.url);
  return text.replaceAll("{{company}}", companyName).replaceAll("{{url}}", target.url);
}
