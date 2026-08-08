import type { BrowserSession } from "./browser-session.port";

export interface ContactPageFinderResult {
  contactPageUrl: string | null;
  confidence: number;
}

export interface ContactPageFinder {
  /**
   * sessionはPlaywrightフォールバック実装のみが使う。fetch+Cheerioの静的実装
   * （HttpContactPageFinder）はブラウザセッションなしで呼び出せるようoptional。
   */
  findContactPage(siteUrl: string, session?: BrowserSession): Promise<ContactPageFinderResult>;

  /**
   * 指定ページ内の問い合わせ系リンクをスコア順に列挙する。問い合わせページが窓口の
   * 一覧だった場合に1階層だけ深追いするためのもので、静的実装のみが持つ
   * （Playwright実装はページ遷移を伴うため、この用途では使わない）。
   */
  listContactLinks?(pageUrl: string, limit?: number): Promise<readonly string[]>;
}
