import type { BrowserSession } from "../../domain/ports/browser-session.port";
import type { ContactPageFinder, ContactPageFinderResult } from "../../domain/ports/contact-page-finder.port";
import { CONTACT_LINK_KEYWORDS } from "../../config/constants";

interface EvaluateResult {
  href: string;
  score: number;
}

/**
 * JS描画/SPAサイト向けのレンダリング後DOMフォールバック。既にsiteUrlへ
 * 遷移済みのBrowserSessionを受け取り、そのDOMからリンクを探索する。
 */
export class PlaywrightContactPageFinder implements ContactPageFinder {
  async findContactPage(_siteUrl: string, session: BrowserSession): Promise<ContactPageFinderResult> {
    const result = await session.evaluate<EvaluateResult | null, readonly string[]>((keywords) => {
      function matchesKeyword(text: string): boolean {
        const normalized = text.trim().toLowerCase();
        if (!normalized) return false;
        return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
      }

      function landmarkScore(el: Element): number {
        if (el.closest("header")) return 1;
        if (el.closest("nav")) return 1;
        if (el.closest("footer")) return 0.9;
        return 0.6;
      }

      // 別ドメインのリンク(SNSプラットフォームの定型ヘルプページ等)を実際の
      // 問い合わせページと誤認しないよう、同一サイトの候補のみ受け付ける
      // (自社サイトを持たずSNSプロフィールを登録しているターゲットで、Metaの
      // "Contact Uploading & Non-Users"のようなfacebook.com/help配下の定型リンクが
      // 「contact」に一致し誤ってREADYになる実バグがあった)。
      function isSameSite(candidateHref: string): boolean {
        try {
          const candidateHost = new URL(candidateHref).hostname.replace(/^www\./, "");
          const siteHost = location.hostname.replace(/^www\./, "");
          return (
            candidateHost === siteHost ||
            candidateHost.endsWith(`.${siteHost}`) ||
            siteHost.endsWith(`.${candidateHost}`)
          );
        } catch {
          return false;
        }
      }

      let best: EvaluateResult | null = null;
      const anchors = Array.from(document.querySelectorAll("a[href]"));

      for (const anchor of anchors) {
        const href = anchor.getAttribute("href");
        // href="#contact"等の同一ページ内アンカー(ワンページサイトの「お問い合わせ」
        // セクションへのスクロールリンク)は素通りさせる。anchor.hrefは絶対URL解決済みなので
        // そのまま使える(このページ自体を指す)。
        if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

        const text = anchor.textContent ?? "";
        if (!matchesKeyword(text) && !matchesKeyword(href)) continue;

        const resolvedHref = (anchor as HTMLAnchorElement).href;
        if (!isSameSite(resolvedHref)) continue;

        const score = landmarkScore(anchor);
        if (best && score <= best.score) continue;

        best = { href: resolvedHref, score };
      }

      return best;
    }, CONTACT_LINK_KEYWORDS);

    if (!result) return { contactPageUrl: null, confidence: 0 };
    return { contactPageUrl: result.href, confidence: result.score };
  }
}
