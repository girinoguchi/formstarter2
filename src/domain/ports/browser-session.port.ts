/**
 * Playwright の Page を薄く抽象化したポート。domain/application 層が
 * playwright パッケージへ直接依存しないようにするための境界。
 *
 * frameUrl: 対象要素が同一ページ内のiframe（クロスオリジンでも可——Playwrightは
 * ページJSのSOP制約を受けずフレーム内部を操作できる）にある場合、そのiframeの
 * URLを指定するとフレームスコープで操作する。省略時はトップページを対象にする。
 */
export interface BrowserSession {
  readonly currentUrl: string;

  /** statusはBot対策(Cloudflare等)の検知に使う。ナビゲーションがリダイレクトのみ等でレスポンスを伴わない場合はnull。 */
  goto(url: string, options?: { timeoutMs?: number }): Promise<{ status: number | null }>;
  content(): Promise<string>;
  evaluate<T, Arg = undefined>(fn: (arg: Arg) => T, arg?: Arg, options?: { frameUrl?: string }): Promise<T>;
  /** 同一ページ内の子フレーム（iframe）のURL一覧。クロスオリジンiframe内フォームの探索に使う。 */
  listFrameUrls(): Promise<readonly string[]>;

  fill(selector: string, value: string, options?: { timeoutMs?: number; frameUrl?: string }): Promise<void>;
  check(selector: string, options?: { timeoutMs?: number; frameUrl?: string }): Promise<void>;
  uncheck(selector: string): Promise<void>;
  selectOption(
    selector: string,
    value: string,
    options?: { timeoutMs?: number; frameUrl?: string },
  ): Promise<void>;
  click(selector: string, options?: { frameUrl?: string }): Promise<void>;
  isVisible(selector: string, options?: { frameUrl?: string }): Promise<boolean>;
  textContent(selector: string): Promise<string | null>;

  screenshot(): Promise<Buffer>;
  close(): Promise<void>;
  /** 人間がこのタブ（ウィンドウ）を閉じるまで待つ。「開いているタブ」一覧から消すタイミングに使う。 */
  waitForClose(): Promise<void>;
  /**
   * ページ遷移（フルナビゲーション）のたびに、遷移後のURL/タイトル/本文を渡してcallbackを呼ぶ。
   * 人間が送信ボタンを押した後の「送信完了ページ」への遷移を観測するためだけに使う
   * ——このコールバックから能動的に何かを操作することはない。
   */
  onNavigation(callback: (info: { url: string; title: string; bodyText: string }) => void): void;
}
