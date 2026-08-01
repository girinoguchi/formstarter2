/**
 * RunのerrorStep（コード上の識別子）を人間が読める日本語理由に変換する。
 * application層（CSVエクスポート）とui層（実行詳細のエラーパネル）の両方から
 * 参照するため、フレームワーク非依存のdomain/value-objectsに置く。
 */
export const ERROR_STEP_LABELS: Record<string, string> = {
  SITE_UNREACHABLE: "サイトにアクセスできませんでした（タイムアウト/DNS等）",
  CONTACT_PAGE_NOT_FOUND: "問い合わせページが見つかりませんでした",
  NO_FORM_FOUND: "フォームが見つかりませんでした",
  IFRAME_CROSS_ORIGIN: "フォームがクロスオリジンiframe内にあり解析できませんでした",
  VALIDATION_FAILED: "再試行してもバリデーションエラーが解消しませんでした",
  PROFILE_NOT_CONFIGURED: "入力プロフィールが未設定です",
  FIELD_FILL_FAILED: "一部の必須フィールドに入力できませんでした（非表示要素等）",
  NOT_READY: "送信可能なURLが未確定です（先に探索が必要）",
  SITE_BLOCKED: "Bot対策（Cloudflare等）によりアクセスを拒否/ブロックされました",
};

export function errorStepLabel(errorStep: string | null | undefined): string {
  if (!errorStep) return "";
  return ERROR_STEP_LABELS[errorStep] ?? errorStep;
}

const ERROR_MESSAGE_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /ERR_NAME_NOT_RESOLVED/, label: "ドメインが見つかりません（存在しない/閉鎖済みの可能性）" },
  { pattern: /ERR_CONNECTION_REFUSED/, label: "接続が拒否されました" },
  { pattern: /ERR_EMPTY_RESPONSE/, label: "サーバーから応答がありませんでした" },
  { pattern: /ERR_CONNECTION_(TIMED_OUT|CLOSED|RESET)/, label: "サーバーへの接続がタイムアウト/切断されました" },
  { pattern: /ERR_CERT_|SSL/, label: "SSL証明書に問題があります" },
  { pattern: /Timeout \d+ms exceeded/, label: "ページの読み込みがタイムアウトしました" },
  { pattern: /Execution context was destroyed/, label: "ページ遷移により処理が中断されました" },
];

/**
 * PlaywrightのエラーメッセージはCall log付きで数行にわたる生のスタックトレースなので、
 * CSV/一覧に出す用に既知パターンだけ短い日本語へ要約する。未知パターンは1行目のみを使う
 * （推測で決めつけず、元のメッセージの最初の行という事実だけを残す）。
 */
export function summarizeErrorMessage(errorMessage: string | null | undefined): string {
  if (!errorMessage) return "";
  const known = ERROR_MESSAGE_PATTERNS.find(({ pattern }) => pattern.test(errorMessage));
  if (known) return known.label;
  return errorMessage.split("\n")[0]?.trim() ?? "";
}
