import { chromium, type Browser } from "playwright";

import type {
  AcquiredBrowserSession,
  BrowserSessionFactory,
  OpenBrowserTarget,
} from "../../domain/ports/browser-session-factory.port";
import { getAgentTunnelRegistry } from "./agent-tunnel-registry";
import { PlaywrightBrowserPage } from "./playwright-browser-page";

const globalForBrowser = globalThis as unknown as {
  __playwrightHeadlessBrowser?: Promise<Browser>;
  __playwrightHeadlessContext?: Promise<import("playwright").BrowserContext>;
};

// FormStarterapp（lib/playwrightPool.ts）で実測済みのLinux VPS向け起動引数をそのまま踏襲する
// （EXPLORE専用のheadlessブラウザ用。headedはもう顧客PC上のローカルエージェントが
// 起動するため、このファイルではLinux固有の起動引数は使わない）。
function getPlatformLaunchArgs(): string[] {
  if (process.platform !== "linux") return [];
  return [
    // rootで実行するVPS上ではsandboxが使えず、--no-sandboxが無いとChromeが起動時に
    // 即クラッシュする（実測: "Running as root without --no-sandbox is not supported"）。
    "--no-sandbox",
    // Linux VPSでは/dev/shmが64MB制限のことが多く、無いとディスクI/Oにフォールバックして激遅になる。
    "--disable-dev-shm-usage",
    // 実GPUなし・Xvfb環境ではデフォルトだとWebGLがSwiftShaderにフォールバックし、
    // それ自体がheadless検知シグナルになる。Mesa/llvmpipeのsoftware rasterizerを
    // 使わせることで自然なGPU情報を返させる。
    "--ignore-gpu-blocklist",
    "--enable-gpu-rasterization",
  ];
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

interface CdpListEntry {
  id: string;
  type: string;
  url: string;
  title: string;
}

async function listCdpTargets(port: number): Promise<readonly CdpListEntry[]> {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return (await res.json()) as CdpListEntry[];
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
  const list = await listCdpTargets(port);
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
 * そこで実Chromeを完全に独立したOSプロセスとして起動し、必要な間だけ connectOverCDP() で
 * 接続する。確認画面に到達し人間の最終操作（Turnstile解決・送信）を待つ段階になったら、
 * この接続をclose()して切り離す——検証済みだが、connectOverCDP()経由のBrowser.close()は
 * 「実際のChromeプロセスを終了させず、このPlaywright接続だけを切断する」動作になる。
 * 切り離した後のタブは自動化の痕跡が一切ない、ただのChromeタブになる。
 *
 * SaaS化に伴い、このChromeは顧客本人のPC上でローカルエージェント（agent/）が起動する
 * （送信ボタンは必ず本人が手動で押すため）。VPS側のこのクラスはChromeを自前でspawnせず、
 * agent-tunnel-registryが管理する「そのownerId専用の中継ポート」に対してCDP接続するだけ
 * ——中継の向こう側で本当にChromeが動いているかはagent-tunnel-registry.getLocalPort()が
 * 保証する（未接続ならエラーになる）。上記のdetach前提・複数ターゲット独立接続の性質は
 * トンネル越しでも変わらない（Chrome側からはローカル接続と区別がつかない）。
 */

// 探索専用の非表示ブラウザ。人間に見せる必要がない「見つかるかどうか」の確認だけをここで
// 行い、送信可能と判定できたときだけheaded側のタブを開く——無関係なウィンドウを画面に出さ
// ないための分離。EXPLOREは人間の最終操作（Turnstile解決等）まで進まないため、Bot対策の
// CDP検知を気にする必要がなく、Playwright標準のchromium.launch()のままでよい。
function getSharedHeadlessBrowser(): Promise<Browser> {
  if (!globalForBrowser.__playwrightHeadlessBrowser) {
    globalForBrowser.__playwrightHeadlessBrowser = chromium.launch({
      headless: true,
      args: getPlatformLaunchArgs(),
    });
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
  async acquire(windowLabel: string, ownerId?: string): Promise<AcquiredBrowserSession> {
    if (!ownerId) {
      throw new Error("PlaywrightSessionManager.acquire()にはownerIdが必須です");
    }
    const port = getAgentTunnelRegistry().getLocalPort(ownerId);
    // エージェントが繋がった直後・顧客PC側のChromeがまだ起動しきっていないケースを
    // カバーするため、疎通するまで軽くポーリングする（旧ensureSharedChromeProcessの
    // waitForDebuggerReady呼び出しと同じ役割）。
    await waitForDebuggerReady(port);
    await ensureAtLeastOneTab(port);

    // OSレベルのウィンドウタイトルはPlaywrightから制御できないため、
    // windowLabelはUI側の active-runs-panel での表示判別にのみ使う（Step13）。
    void windowLabel;

    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();

    // 新しいタブのCDP target idは、そのページに紐づくCDPSessionへ直接
    // Target.getTargetInfo（targetId省略時は「このセッション自身のtarget」を返す）を
    // 投げて取得する——「まとめて開く」等で複数タブをほぼ同時に作成すると、作成前後の
    // 一覧を差分で比較する方式（旧実装）は他のタブの作成と競合し、誤ったtarget idを
    // 掴んでしまう実バグがあった（3件開いて1件だけ閉じたら全部消える、という形で発覚）。
    // このページ自身のセッションに直接問い合わせれば、他タブの作成タイミングと無関係に
    // 常に正しいidが取れる。
    const cdpSession = await context.newCDPSession(page);
    const { targetInfo } = await cdpSession.send("Target.getTargetInfo");
    const cdpTargetId = targetInfo.targetId;
    await cdpSession.detach().catch(() => {});

    return {
      session: new PlaywrightBrowserPage(page),
      cdpTargetId,
      release: async () => {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
      },
      detach: async () => {
        await browser.close();
      },
    };
  }

  /**
   * CDPセッションを新たに張らない軽量なHTTP GET(/json/list)だけで現在開いているタブを
   * 返す。detachしたタブの生死・タイトル変化をポーリングで追跡するために使う——
   * Cloudflare Turnstile対策としてCDP接続を増やさない設計を崩さないための意図的な選択。
   *
   * エージェントが未接続の場合はgetLocalPort()がエラーを投げ、そのまま呼び出し側
   * （reconcileOpenTabs）に伝播する——空配列を返してしまうと「全部閉じられた」と
   * 誤判定してしまうため、失敗は必ずエラーとして伝える。
   */
  async listOpenTargets(ownerId?: string): Promise<readonly OpenBrowserTarget[]> {
    if (!ownerId) {
      throw new Error("PlaywrightSessionManager.listOpenTargets()にはownerIdが必須です");
    }
    const port = getAgentTunnelRegistry().getLocalPort(ownerId);
    const targets = await listCdpTargets(port);
    return targets.filter((t) => t.type === "page").map((t) => ({ id: t.id, url: t.url, title: t.title }));
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
      cdpTargetId: null,
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

  // EXPLOREは追跡対象にならないため呼ばれない想定——インターフェースを満たすためだけに存在する。
  async listOpenTargets(): Promise<readonly OpenBrowserTarget[]> {
    return [];
  }
}
