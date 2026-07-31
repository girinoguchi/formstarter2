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
}
