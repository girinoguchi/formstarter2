import type { BlockCheckInput, BlockCheckResult, BlockDetector } from "../../domain/ports/block-detector.port";

// 401/403: 明示的な拒否。429: レート制限。503: Cloudflare等がチャレンジページを
// このステータスで返すことが多い（JS実行後にトップページへ自動遷移する構成が典型）。
const BLOCKED_STATUS_CODES = new Set([401, 403, 429, 503]);

const BOT_PROTECTION_TEXT_PATTERN =
  /access denied|just a moment|checking your browser|attention required|unusual traffic|are you a human|verify you are human|please verify|captcha|forbidden|rate limit/i;

/**
 * 「営業お断り」等の営業禁止文言の検知パターン。FormStarterappの実運用で磨かれた
 * パターン（表記揺れ吸収含む）をそのまま踏襲する——このツールも営業目的の自動送信
 * ツールである以上、同じ誤爆リスク・同じ回避すべきワードの傾向を持つため。
 */
const SALES_PROHIBITED_PATTERNS: readonly (RegExp | string)[] = [
  "営業お断り",
  "セールスお断り",
  "勧誘お断り",
  "売り込みお断り",
  "営業目的のご連絡はご遠慮",
  "広告・宣伝目的のご連絡はご遠慮",
  "迷惑行為",
  "一切お断り",
  /(営業|セールス|勧誘|売り込み|売込み|押し売り|テレアポ|飛び込み)[^\s。、]{0,20}(目的|連絡|問い合わせ|問合せ|お問い合わせ|お問合せ|メール|電話|行為)[^\s。、]{0,20}(お断り|ご遠慮|お控え|禁止|不可|しません|しないでください)/,
  /(営業|セールス|勧誘|売り込み|売込み)[^\s。、]{0,10}(お断り|ご遠慮|禁止|不可)/,
  /(業者|代理店)[^\s。、]{0,10}(営業|セールス|勧誘|売り込み)[^\s。、]{0,20}(お断り|ご遠慮|禁止)/,
  /(広告|宣伝|PR|販促)[^\s。、]{0,20}(目的|連絡|メール)[^\s。、]{0,20}(お断り|ご遠慮|禁止|不可)/,
  /no\s+(sales|solicitation|unsolicited|cold[\s-]?call)/i,
  /(sales|solicitation)\s+(is\s+)?(prohibited|not\s+accepted|forbidden)/i,
  /we\s+do\s+not\s+accept\s+(unsolicited|sales|cold[\s-]?call)/i,
];

function findSalesProhibitedMatch(text: string): string | null {
  for (const pattern of SALES_PROHIBITED_PATTERNS) {
    if (typeof pattern === "string") {
      if (text.includes(pattern)) return pattern;
    } else {
      const match = text.match(pattern);
      if (match) return match[0];
    }
  }
  return null;
}

/**
 * 静的fetch(HttpContactPageFinder)が403等で弾かれても、実ブラウザ(Playwright)なら
 * 通ることも多いため、ここでは判定材料にしない——実際にheadlessブラウザで
 * アクセスした結果（HTTPステータス＋ページ内容）だけをBLOCKEDの根拠にする。
 */
export class HeuristicBlockDetector implements BlockDetector {
  check(input: BlockCheckInput): BlockCheckResult {
    if (input.status !== null && BLOCKED_STATUS_CODES.has(input.status)) {
      return { blocked: true, kind: "BOT_PROTECTION", reason: `HTTPステータス ${input.status} を検知` };
    }

    const text = `${input.title ?? ""} ${input.bodyText ?? ""}`;
    const botMatch = text.match(BOT_PROTECTION_TEXT_PATTERN);
    if (botMatch) {
      return { blocked: true, kind: "BOT_PROTECTION", reason: `Bot対策ページの文言を検知: 「${botMatch[0]}」` };
    }

    const salesMatch = findSalesProhibitedMatch(text);
    if (salesMatch) {
      return { blocked: true, kind: "SALES_PROHIBITED", reason: `営業禁止文言を検知: 「${salesMatch}」` };
    }

    return { blocked: false };
  }
}
