import type { FieldClassification } from "../entities/field-classification";
import type { Run } from "../entities/run";
import type { LogLevel } from "../value-objects/log-level";
import type { RunKind } from "../value-objects/run-kind";
import type { RunStatus } from "../value-objects/run-status";
import type { ScreenshotStage } from "../value-objects/screenshot-stage";

export type RunUpdatablePatch = Partial<
  Pick<
    Run,
    | "contactPageUrl"
    | "formSelector"
    | "windowLabel"
    | "errorStep"
    | "errorMessage"
    | "startedAt"
    | "finishedAt"
    | "closedAt"
    | "sentAt"
    | "cdpTargetId"
  >
>;

export interface ScreenshotRecord {
  id: string;
  stage: ScreenshotStage;
  filePath: string;
  createdAt: Date;
}

export interface RunLogRecord {
  id: string;
  level: LogLevel;
  step: string;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface RunDetail extends Run {
  screenshots: readonly ScreenshotRecord[];
  logs: readonly RunLogRecord[];
}

export interface ActiveRunSummary extends Run {
  targetUrl: string;
  targetCompanyName: string | null;
}

export interface RunExportRow extends Run {
  targetUrl: string;
  targetCompanyName: string | null;
  screenshotPaths: readonly string[];
}

export interface RunRepository {
  create(targetId: string, kind: RunKind): Promise<Run>;
  updateStatus(runId: string, status: RunStatus, patch?: RunUpdatablePatch): Promise<void>;
  /** 人間がタブを閉じたことを記録する。「開いているタブ」一覧はこの時刻以降表示しなくなる。 */
  markClosed(runId: string): Promise<void>;
  /** 送信完了ページへの遷移を自動検知したことを記録し、statusをSENTへ進める（Runのみ）。 */
  markSent(runId: string): Promise<void>;
  appendLog(
    runId: string,
    level: LogLevel,
    step: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  addScreenshot(runId: string, stage: ScreenshotStage, filePath: string): Promise<void>;
  addFieldClassifications(runId: string, classifications: readonly FieldClassification[]): Promise<void>;
  findById(runId: string): Promise<Run | null>;
  findDetailById(runId: string): Promise<RunDetail | null>;
  listByTarget(targetId: string): Promise<readonly Run[]>;
  /**
   * 指定ターゲットに対して、まだ人間に閉じられていないFILL Run（AWAITING_SEND/SENT且つ
   * closedAtがnull）があるかどうか。Target.statusはタブが開いている間もREADYのままにして
   * いるため（誤解を招く「送信待ち」表示を避けるため）、statusだけでは重複実行を防げない
   * ——この判定を別途Runテーブルで行う。
   */
  hasOpenTab(targetId: string): Promise<boolean>;
  /**
   * 既にタブが開いたまま（AWAITING_SEND/SENT且つclosedAtがnull）のFILL Runを持つ
   * ターゲットidを一括取得する。「まとめて開く」がREADY一覧から候補を選ぶ際、
   * 1件ずつhasOpenTabを呼ぶ代わりにこれで事前に除外する——除外せずに選ぶと、
   * 既にタブが開いているものばかり先頭に並んでいる場合、バッチ全体が
   * 重複防止ガードで弾かれて0件になってしまう実バグがあった。
   */
  listTargetIdsWithOpenTab(): Promise<readonly string[]>;
  /**
   * 実行中、または「送信待ち」等ブラウザが開いたままになっている可能性のあるRunを一覧する。
   * kindでEXPLORE（可視タブなし）/FILL（可視タブあり）を絞り込める。
   */
  listActive(filter?: { profileId?: string; ownerId?: string; kind?: RunKind }): Promise<readonly ActiveRunSummary[]>;
  /** CSVエクスポート用にRunを新しい順で一覧する。profileIdで対象プロジェクトに絞り込み、
   *  failedOnlyで送信不可・失敗・ブロック済みのみに絞り込める（「送信失敗一覧CSV」用）。 */
  listForExport(filter?: { profileId?: string; failedOnly?: boolean }): Promise<readonly RunExportRow[]>;
}
