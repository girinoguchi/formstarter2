import type { BrowserSession } from "./browser-session.port";

export interface AcquiredBrowserSession {
  session: BrowserSession;
  release(): Promise<void>;
}

/**
 * headedブラウザのコンテキストを払い出すポート。実装（PlaywrightSessionManager）は
 * 並列実行時、上限内で複数コンテキストを同時保持できる想定（Step13で対応）。
 */
export interface BrowserSessionFactory {
  acquire(windowLabel: string): Promise<AcquiredBrowserSession>;
}
