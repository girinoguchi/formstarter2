export interface BlockCheckInput {
  status: number | null;
  title: string | null;
  bodyText: string | null;
}

export interface BlockCheckResult {
  blocked: boolean;
  /** BLOCKED判定の種類。RunのerrorStep選択に使う。 */
  kind?: "BOT_PROTECTION" | "SALES_PROHIBITED";
  /** RunLogに残す人間可読な検知理由（一致した文言など）。 */
  reason?: string;
}

/**
 * このサイトに自動アクセス/入力を続けるべきでないかどうかを判定するポート。
 * Cloudflare等のBot対策チャレンジと、「営業お断り」等の営業禁止文言の2種類を検知する
 * ——どちらも「これ以上自動化しない」という結論は同じだが、原因が異なるため
 * kind/reasonで区別してログ・errorStepに残す。
 */
export interface BlockDetector {
  check(input: BlockCheckInput): BlockCheckResult;
}
