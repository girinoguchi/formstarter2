import type { Frame, Page } from "playwright";

import type { BrowserSession } from "../../domain/ports/browser-session.port";

export class PlaywrightBrowserPage implements BrowserSession {
  constructor(private readonly page: Page) {}

  get currentUrl(): string {
    return this.page.url();
  }

  async goto(url: string, options?: { timeoutMs?: number }): Promise<void> {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: options?.timeoutMs });
  }

  async content(): Promise<string> {
    return this.page.content();
  }

  /**
   * frameUrlが指定されていれば、そのURLに一致する子フレーム（iframe）を返す。
   * クロスオリジンiframeでもPlaywrightはCDP経由でアクセスするため、ページJSの
   * 同一オリジンポリシーの影響を受けずに中身を操作できる。
   */
  private resolveTarget(frameUrl?: string): Page | Frame {
    if (!frameUrl) return this.page;
    const frame = this.page.frames().find((f) => f.url() === frameUrl);
    if (!frame) throw new Error(`Frame not found: ${frameUrl}`);
    return frame;
  }

  async listFrameUrls(): Promise<readonly string[]> {
    const topUrl = this.page.url();
    return this.page
      .frames()
      .map((f) => f.url())
      .filter((url) => url && url !== topUrl && url !== "about:blank");
  }

  async evaluate<T, Arg = undefined>(
    fn: (arg: Arg) => T,
    arg?: Arg,
    options?: { frameUrl?: string },
  ): Promise<T> {
    // Playwrightのevaluateはpage-context関数の引数型を厳密なUnboxed<Arg>で推論しようとして
    // このポート越しの汎用シグネチャとは噛み合わないため、境界でのみ型を橋渡しする。
    type PlaywrightEvaluate = (fn: (arg: Arg) => T | Promise<T>, arg: Arg) => Promise<T>;
    const target = this.resolveTarget(options?.frameUrl);
    const evaluate = target.evaluate.bind(target) as unknown as PlaywrightEvaluate;
    return evaluate(fn, arg as Arg);
  }

  async fill(selector: string, value: string, options?: { timeoutMs?: number; frameUrl?: string }): Promise<void> {
    await this.resolveTarget(options?.frameUrl).fill(selector, value, { timeout: options?.timeoutMs });
  }

  async check(selector: string, options?: { timeoutMs?: number; frameUrl?: string }): Promise<void> {
    await this.resolveTarget(options?.frameUrl).check(selector, { timeout: options?.timeoutMs });
  }

  async uncheck(selector: string): Promise<void> {
    await this.page.uncheck(selector);
  }

  async selectOption(
    selector: string,
    value: string,
    options?: { timeoutMs?: number; frameUrl?: string },
  ): Promise<void> {
    await this.resolveTarget(options?.frameUrl).selectOption(selector, value, { timeout: options?.timeoutMs });
  }

  async click(selector: string, options?: { frameUrl?: string }): Promise<void> {
    await this.resolveTarget(options?.frameUrl).click(selector);
  }

  async isVisible(selector: string, options?: { frameUrl?: string }): Promise<boolean> {
    return this.resolveTarget(options?.frameUrl).isVisible(selector);
  }

  async textContent(selector: string): Promise<string | null> {
    return this.page.textContent(selector);
  }

  async screenshot(): Promise<Buffer> {
    return this.page.screenshot();
  }

  async close(): Promise<void> {
    await this.page.close();
  }

  async waitForClose(): Promise<void> {
    if (this.page.isClosed()) return;
    // Playwrightのwaits系メソッドは既定で約30秒のタイムアウトを持つため、
    // timeout: 0（無制限）を明示しないと「タブがまだ開いているのにタイムアウトで
    // 解決してしまう」——「開いているタブ」一覧が実際より早く空になる不具合になる。
    await this.page.waitForEvent("close", { timeout: 0 });
  }

  onNavigation(callback: (info: { url: string; title: string; bodyText: string }) => void): void {
    this.page.on("load", () => {
      void (async () => {
        try {
          const title = await this.page.title();
          const bodyText = await this.page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? "");
          callback({ url: this.page.url(), title, bodyText });
        } catch {
          // ページが閉じられた直後/遷移中の競合等は無視する（観測用途のため取りこぼしを許容する）。
        }
      })();
    });
  }
}
