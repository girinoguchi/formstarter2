export const STATUS_LABELS: Record<string, string> = {
  PENDING: "未実行",
  QUEUED: "待機中",
  RUNNING: "実行中",
  LAUNCHING_BROWSER: "ブラウザ起動中",
  LOADING_SITE: "サイト読み込み中",
  FINDING_CONTACT_PAGE: "問い合わせページ探索中",
  PARSING_FORM: "フォーム解析中",
  CLASSIFYING_FIELDS: "項目判定中",
  FILLING_FORM: "入力中",
  HANDLING_VALIDATION: "入力エラー対応中",
  REACHED_CONFIRMATION: "確認画面到達",
  READY: "送信可能",
  AWAITING_SEND: "送信待ち",
  SENT: "送信済み",
  NEEDS_REVIEW: "要確認",
  BLOCKED: "ブロック済み",
  NOT_SENDABLE: "送信不可",
  FAILED: "失敗",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
