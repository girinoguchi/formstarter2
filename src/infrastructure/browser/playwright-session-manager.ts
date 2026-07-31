import { chromium, type Browser, type BrowserContext } from "playwright";

import type {
  AcquiredBrowserSession,
  BrowserSessionFactory,
} from "../../domain/ports/browser-session-factory.port";
import { PlaywrightBrowserPage } from "./playwright-browser-page";

const globalForBrowser = globalThis as unknown as {
  __playwrightBrowser?: Promise<Browser>;
  __playwrightContext?: Promise<BrowserContext>;
  __playwrightHeadlessBrowser?: Promise<Browser>;
  __playwrightHeadlessContext?: Promise<BrowserContext>;
};

// 開発時のホットリロードでheadedブラウザプロセスが増殖しないよう、
// prisma.ts と同じパターンで globalThis にキャッシュする。
function getSharedBrowser(): Promise<Browser> {
  if (!globalForBrowser.__playwrightBrowser) {
    globalForBrowser.__playwrightBrowser = chromium.launch({ headless: false });
  }
  return globalForBrowser.__playwrightBrowser;
}

// 探索専用の非表示ブラウザ。人間に見せる必要がない「見つかるかどうか」の
// 確認だけをここで行い、送信可能と判定できたときだけheaded側のタブを開く
// （PlaywrightSessionManager）——無関係なウィンドウを画面に出さないための分離。
function getSharedHeadlessBrowser(): Promise<Browser> {
  if (!globalForBrowser.__playwrightHeadlessBrowser) {
    globalForBrowser.__playwrightHeadlessBrowser = chromium.launch({ headless: true });
  }
  return globalForBrowser.__playwrightHeadlessBrowser;
}

function getSharedHeadlessContext(): Promise<BrowserContext> {
  if (!globalForBrowser.__playwrightHeadlessContext) {
    globalForBrowser.__playwrightHeadlessContext = getSharedHeadlessBrowser().then((browser) => browser.newContext());
  }
  return globalForBrowser.__playwrightHeadlessContext;
}

/**
 * 全ターゲットで1つのBrowserContextを共有する。同じContext内でnewPage()すると
 * headedモードでは「新しいウィンドウ」ではなく「同じウィンドウの新しいタブ」として開かれる
 * ——並列実行時にウィンドウが乱立するのを避けるための意図的な設計（Cookie等はターゲットが
 * 別ドメインである限り同一オリジンポリシーで分離されるため実害はない）。
 */
function getSharedContext(): Promise<BrowserContext> {
  if (!globalForBrowser.__playwrightContext) {
    globalForBrowser.__playwrightContext = getSharedBrowser().then((browser) => browser.newContext());
  }
  return globalForBrowser.__playwrightContext;
}

export class PlaywrightSessionManager implements BrowserSessionFactory {
  async acquire(windowLabel: string): Promise<AcquiredBrowserSession> {
    const context = await getSharedContext();
    const page = await context.newPage();

    // OSレベルのウィンドウタイトルはPlaywrightから制御できないため、
    // windowLabelはUI側の active-runs-panel での表示判別にのみ使う（Step13）。
    void windowLabel;

    return {
      session: new PlaywrightBrowserPage(page),
      release: async () => {
        // Contextは全ターゲットで共有しているため、ここで閉じるのは自分のタブ（page）のみ。
        await page.close();
      },
    };
  }
}

/**
 * 探索専用の非表示（headless）セッション。画面には一切出ない。
 * 「送信可能かどうか」を確認するためだけに使い、確認後は必ずreleaseする。
 */
export class HeadlessPlaywrightSessionManager implements BrowserSessionFactory {
  async acquire(windowLabel: string): Promise<AcquiredBrowserSession> {
    const context = await getSharedHeadlessContext();
    const page = await context.newPage();
    void windowLabel;

    return {
      session: new PlaywrightBrowserPage(page),
      release: async () => {
        await page.close();
      },
    };
  }
}
