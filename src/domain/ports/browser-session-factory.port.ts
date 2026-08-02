import type { BrowserSession } from "./browser-session.port";

export interface AcquiredBrowserSession {
  session: BrowserSession;
  /**
   * このタブに対応するCDP target id（Chromeのタブに対して安定したID、ナビゲーションを
   * 跨いでも変わらない）。detach後にPlaywright接続を持たない状態でタブの生死・遷移を
   * 軽量に追跡するために使う（詳細はplaywright-session-managerのコメント参照）。
   * 取得できなかった場合はnull。
   */
  cdpTargetId: string | null;
  release(): Promise<void>;
  /**
   * タブ（ブラウザ）自体は閉じたままにせず、自動化ツール側からの接続だけを切り離す。
   * Cloudflare Turnstile等のBot対策がCDP接続の存在自体を検知し、人間が手動で
   * チェックしても検証失敗させるケースを実データで確認したため、確認画面に到達し
   * 人間の最終操作を待つ直前に呼ぶ想定（詳細はplaywright-session-managerのコメント参照）。
   */
  detach(): Promise<void>;
}

export interface OpenBrowserTarget {
  id: string;
  url: string;
  title: string;
}

/**
 * headedブラウザのコンテキストを払い出すポート。実装（PlaywrightSessionManager）は
 * 並列実行時、上限内で複数コンテキストを同時保持できる想定（Step13で対応）。
 */
export interface BrowserSessionFactory {
  /**
   * ownerIdはheaded（PlaywrightSessionManager）実装のみが必須で使う——アカウントごとに
   * 顧客自身のPC上のChromeへエージェント経由で中継するため、どのユーザーのエージェントに
   * つなぐかを指定する必要がある。headless（HeadlessPlaywrightSessionManager、EXPLORE専用）
   * はローカルのPlaywright管理ブラウザをそのまま使うためownerIdを必要としない——
   * オプショナルにしているのはそちらの実装を無修正のままにするため。
   */
  acquire(windowLabel: string, ownerId?: string): Promise<AcquiredBrowserSession>;
  /**
   * 現在開いているタブ一覧を、CDPセッションを新たに張らない軽量なHTTPメタデータ取得
   * だけで返す（Cloudflare Turnstile対策としてCDP接続を増やさないための設計）。
   * detach済みのタブの生死・URL遷移をポーリングで追跡するために使う。
   */
  listOpenTargets(ownerId?: string): Promise<readonly OpenBrowserTarget[]>;
}
