import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium, type Browser } from "playwright";

import type {
  AcquiredBrowserSession,
  BrowserSessionFactory,
} from "../../domain/ports/browser-session-factory.port";
import { PlaywrightBrowserPage } from "./playwright-browser-page";

const globalForBrowser = globalThis as unknown as {
  __playwrightHeadlessBrowser?: Promise<Browser>;
  __playwrightHeadlessContext?: Promise<import("playwright").BrowserContext>;
  __sharedChromeReady?: Promise<void>;
};

const CHROME_DEBUG_PORT = 9422;
const CHROME_PROFILE_DIR = path.join(tmpdir(), "formstarter-chrome-profile");

// macOS想定（このアプリはローカルの長時間稼働Node.jsプロセスとして開発機で動く前提）。
// 実行ファイルが見つからない環境（CI/Linux等）向けにwin32/linuxの一般的なパスも
// フォールバックとして並べておくが、動作確認は行っていない。
const CHROME_EXECUTABLE_CANDIDATES: readonly string[] =
  process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
    : process.platform === "linux"
      ? ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium"]
      : ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];

function findChromeExecutable(): string {
  const found = CHROME_EXECUTABLE_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "実Chromeの実行ファイルが見つかりませんでした。Google Chromeをインストールしてください。",
    );
  }
  return found;
}

async function waitForDebuggerReady(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // まだ起動中。少し待って再試行する。
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chromeのデバッグポート(${port})が起動しませんでした`);
}

/**
 * 人間がタブ・ウィンドウを全部閉じてタブ数0の状態になると、Playwrightの
 * connectOverCDP()自体が「Browser.setDownloadBehavior: Browser context management
 * is not supported」というプロトコルエラーで失敗する（実データで確認済み）。
 * connectOverCDP()を呼ぶ前に、CDPの生HTTPエンドポイント(/json/new)でタブを1つ
 * 確保しておくことでこれを回避する——このタブ自体はPlaywright経由ではなく
 * ブラウザ本体に対して直接作成するため、この制約を踏まない。
 */
async function ensureAtLeastOneTab(port: number): Promise<void> {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const list = (await res.json()) as unknown[];
  if (list.length === 0) {
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  }
}

/**
 * headedブラウザは Playwright の chromium.launch() では起動しない。
 *
 * Cloudflare Turnstile等のBot対策は「PlaywrightがCDPで接続していること自体」を検知し、
 * 人間が実際にチェックボックスを手動でクリックしても検証失敗させることを実データ
 * （next-standard.com）で確認した。launch()はPlaywright自身がプロセスを起動・管理する
 * ため自動化用の起動引数が付き、あとから取り除けない。
 *
 * そこで実Chromeを完全に独立したOSプロセスとして自前でspawnし（--remote-debugging-port
 * を開けるだけの、人間が普段使うのと同じ起動）、必要な間だけ connectOverCDP() で接続する。
 * 確認画面に到達し人間の最終操作（Turnstile解決・送信）を待つ段階になったら、この接続を
 * close()して切り離す——検証済みだが、connectOverCDP()経由のBrowser.close()は「実際の
 * Chromeプロセスを終了させず、このPlaywright接続だけを切断する」動作になる。切り離した後の
 * タブは自動化の痕跡が一切ない、ただのChromeタブになる。
 *
 * 複数ターゲットを同時に扱えるよう、対象ごとに独立したconnectOverCDP()接続を張る
 * （同じ実行ファイル・同じウィンドウを共有しつつ）。これも検証済みだが、同一ブラウザに
 * 対する複数の独立したCDP接続は互いに干渉しないため、あるターゲットの接続をdetachしても
 * 他ターゲットの接続・タブには影響しない——「全ターゲットで1つのウィンドウを共有する」
 * という既存の設計（ウィンドウ乱立を避ける）はそのまま維持できる。
 */
async function ensureSharedChromeProcess(): Promise<void> {
  if (!globalForBrowser.__sharedChromeReady) {
    globalForBrowser.__sharedChromeReady = (async () => {
      await mkdir(CHROME_PROFILE_DIR, { recursive: true });
      const executable = findChromeExecutable();
      spawn(
        executable,
        [
          `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
          `--user-data-dir=${CHROME_PROFILE_DIR}`,
          "--no-first-run",
          "--no-default-browser-check",
          "about:blank",
        ],
        { stdio: "ignore", detached: false },
      );
      await waitForDebuggerReady(CHROME_DEBUG_PORT);
    })();
  }
  return globalForBrowser.__sharedChromeReady;
}

// 探索専用の非表示ブラウザ。人間に見せる必要がない「見つかるかどうか」の確認だけをここで
// 行い、送信可能と判定できたときだけheaded側のタブを開く——無関係なウィンドウを画面に出さ
// ないための分離。EXPLOREは人間の最終操作（Turnstile解決等）まで進まないため、Bot対策の
// CDP検知を気にする必要がなく、Playwright標準のchromium.launch()のままでよい。
function getSharedHeadlessBrowser(): Promise<Browser> {
  if (!globalForBrowser.__playwrightHeadlessBrowser) {
    globalForBrowser.__playwrightHeadlessBrowser = chromium.launch({ headless: true });
  }
  return globalForBrowser.__playwrightHeadlessBrowser;
}

function getSharedHeadlessContext() {
  if (!globalForBrowser.__playwrightHeadlessContext) {
    globalForBrowser.__playwrightHeadlessContext = getSharedHeadlessBrowser().then((browser) => browser.newContext());
  }
  return globalForBrowser.__playwrightHeadlessContext;
}

export class PlaywrightSessionManager implements BrowserSessionFactory {
  async acquire(windowLabel: string): Promise<AcquiredBrowserSession> {
    await ensureSharedChromeProcess();
    await ensureAtLeastOneTab(CHROME_DEBUG_PORT);

    // OSレベルのウィンドウタイトルはPlaywrightから制御できないため、
    // windowLabelはUI側の active-runs-panel での表示判別にのみ使う（Step13）。
    void windowLabel;

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CHROME_DEBUG_PORT}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();

    return {
      session: new PlaywrightBrowserPage(page),
      release: async () => {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
      },
      detach: async () => {
        await browser.close();
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
      // EXPLOREは人間の最終操作まで進まないため呼ばれない想定だが、インターフェース
      // を満たすためだけに存在する（呼ばれてもreleaseと同様の後始末で問題ない）。
      detach: async () => {
        await page.close();
      },
    };
  }
}
