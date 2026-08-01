import type { BrowserSession } from "./browser-session.port";

export interface AcquiredBrowserSession {
  session: BrowserSession;
  release(): Promise<void>;
  /**
   * タブ（ブラウザ）自体は閉じたままにせず、自動化ツール側からの接続だけを切り離す。
   * Cloudflare Turnstile等のBot対策がCDP接続の存在自体を検知し、人間が手動で
   * チェックしても検証失敗させるケースを実データで確認したため、確認画面に到達し
   * 人間の最終操作を待つ直前に呼ぶ想定（詳細はplaywright-session-managerのコメント参照）。
   */
  detach(): Promise<void>;
}

/**
 * headedブラウザのコンテキストを払い出すポート。実装（PlaywrightSessionManager）は
 * 並列実行時、上限内で複数コンテキストを同時保持できる想定（Step13で対応）。
 */
export interface BrowserSessionFactory {
  acquire(windowLabel: string): Promise<AcquiredBrowserSession>;
}
