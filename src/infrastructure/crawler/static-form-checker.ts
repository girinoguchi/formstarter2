import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import type { StaticFormChecker as StaticFormCheckerPort } from "../../domain/ports/static-form-checker.port";

const FILLABLE_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';

// run-orchestrator.tsのlooksLikeContactFormと同じ判定基準。素の"mail"/"name"は
// "mailmagazine"/"newsletter_mail"/"campaign_name"/"file_name"/"username"のような
// 無関係なフィールド名まで拾ってしまうため使わず、曖昧さの少ない言い回しのみ見る。
// 項目数(3件以上)によるフォールバックも、検索フォーム(キーワード+カテゴリ+価格帯)や
// ログインフォームまで通してしまうため、textarea(本文入力欄)の有無に置き換えた。
const EMAIL_PATTERN = /メールアドレス|メール|e-?mail/i;
const NAME_PATTERN = /氏名|お名前|担当者|full[\s-]*name|your[\s-]*name/i;

/**
 * fetch + Cheerio のみで「このページに入力可能な“問い合わせフォームらしい”フォームが
 * あるか」を判定する。FormStarterapp同様、ブラウザを起動せずに済むケース
 * （静的HTMLのフォーム）をここで先に確定させ、JS描画が必要なサイトだけ
 * Playwrightにフォールバックする。
 */
export function looksLikeContactForm($: cheerio.CheerioAPI, form: AnyNode): boolean {
  const fields = $(form).find(FILLABLE_INPUT_SELECTOR).toArray();
  if (fields.length === 0) return false;
  if (fields.some((field) => $(field).is("textarea"))) return true;

  const hints = fields
    .map((field) => {
      const $field = $(field);
      return [$field.attr("type"), $field.attr("name"), $field.attr("id"), $field.attr("placeholder")]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
  return EMAIL_PATTERN.test(hints) || NAME_PATTERN.test(hints);
}

export class StaticFormChecker implements StaticFormCheckerPort {
  async hasFillableForm(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return false;
      const html = await res.text();
      const $ = cheerio.load(html);
      return $("form")
        .toArray()
        .some((form) => looksLikeContactForm($, form));
    } catch {
      return false;
    }
  }
}
