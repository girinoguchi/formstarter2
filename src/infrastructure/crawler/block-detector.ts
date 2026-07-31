import type { BlockCheckInput, BlockDetector } from "../../domain/ports/block-detector.port";

// 401/403: 明示的な拒否。429: レート制限。503: Cloudflare等がチャレンジページを
// このステータスで返すことが多い（JS実行後にトップページへ自動遷移する構成が典型）。
const BLOCKED_STATUS_CODES = new Set([401, 403, 429, 503]);

const BLOCK_TEXT_PATTERN =
  /access denied|just a moment|checking your browser|attention required|unusual traffic|are you a human|verify you are human|please verify|captcha|forbidden|rate limit/i;

/**
 * 静的fetch(HttpContactPageFinder)が403等で弾かれても、実ブラウザ(Playwright)なら
 * 通ることも多いため、ここでは判定材料にしない——実際にheadlessブラウザで
 * アクセスした結果（HTTPステータス＋ページ内容）だけをBLOCKEDの根拠にする。
 */
export class HeuristicBlockDetector implements BlockDetector {
  isBlocked(input: BlockCheckInput): boolean {
    if (input.status !== null && BLOCKED_STATUS_CODES.has(input.status)) return true;

    const text = `${input.title ?? ""} ${input.bodyText ?? ""}`;
    return BLOCK_TEXT_PATTERN.test(text);
  }
}
