import * as cheerio from "cheerio";

import type { ContactPageFinder, ContactPageFinderResult } from "../../domain/ports/contact-page-finder.port";
import { CONTACT_LINK_KEYWORDS } from "../../config/constants";
import { isSameSite } from "./same-site";

type Landmark = "header" | "nav" | "footer" | "other";

const LANDMARK_SCORE: Record<Landmark, number> = {
  header: 1,
  nav: 1,
  footer: 0.9,
  other: 0.6,
};

function matchesKeyword(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;
  return CONTACT_LINK_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

/**
 * fetch + Cheerio によるブラウザ不要の一次探索。header/nav/footer優先でリンクを
 * キーワードスコアリングし、見つからなければ sitemap.xml もあたる。
 */
export class HttpContactPageFinder implements ContactPageFinder {
  async findContactPage(siteUrl: string): Promise<ContactPageFinderResult> {
    let html: string;
    try {
      const res = await fetch(siteUrl, { redirect: "follow" });
      if (!res.ok) return this.findViaSitemap(siteUrl);
      html = await res.text();
    } catch {
      return { contactPageUrl: null, confidence: 0 };
    }

    const $ = cheerio.load(html);
    let best: { url: string; score: number } | null = null;

    $("a[href]").each((_, el) => {
      const $el = $(el);
      const href = $el.attr("href");
      // href="#" 単体は素通りさせる(hrefが同一ページ内アンカー="#contact"等の
      // ワンページサイトの「お問い合わせ」セクションへのスクロールリンクであるケースが
      // 実データ(ag-int.com等)で見つかった。new URL()でsiteUrl基準に解決すれば
      // 素直にそのページ自体を指すURLになる——別ページへの遷移を要しない。
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const text = $el.text();
      if (!matchesKeyword(text) && !matchesKeyword(href)) return;

      let location: Landmark = "other";
      if ($el.closest("header").length > 0) location = "header";
      else if ($el.closest("nav").length > 0) location = "nav";
      else if ($el.closest("footer").length > 0) location = "footer";

      const score = LANDMARK_SCORE[location];
      if (best && score <= best.score) return;

      try {
        const resolved = new URL(href, siteUrl).toString();
        // 別ドメインのリンク(SNSプラットフォームの定型ヘルプページ等)を
        // 実際の問い合わせページと誤認しないよう、同一サイトの候補のみ受け付ける。
        if (!isSameSite(resolved, siteUrl)) return;
        best = { url: resolved, score };
      } catch {
        // 不正なURLは無視
      }
    });

    if (best) {
      const found: { url: string; score: number } = best;
      return { contactPageUrl: found.url, confidence: found.score };
    }

    return this.findViaSitemap(siteUrl);
  }

  private async findViaSitemap(siteUrl: string): Promise<ContactPageFinderResult> {
    try {
      const sitemapUrl = new URL("/sitemap.xml", siteUrl).toString();
      const res = await fetch(sitemapUrl);
      if (!res.ok) return { contactPageUrl: null, confidence: 0 };

      const xml = await res.text();
      const locs = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/gi)).map((m) => m[1]?.trim()).filter(Boolean);
      const match = locs.find((loc): loc is string => !!loc && matchesKeyword(loc));

      if (match) return { contactPageUrl: match, confidence: 0.4 };
    } catch {
      // sitemapが無い/取得失敗は許容し、見つからなかった扱いにする
    }
    return { contactPageUrl: null, confidence: 0 };
  }
}
