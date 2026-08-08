/**
 * ローカルChromeを「使える状態」にするまでの判断部分。
 *
 * 実際のプロセス操作（ps実行・kill・spawn）はagent/index.tsが渡す。ここを純粋な判断に
 * 切り出しているのは、顧客PCで実際に起きる異常系——古いChromeが別ポートで残っている、
 * 応答しないChromeがプロファイルを掴んでいる、起動直後に既存セッションへ転送される——を
 * テストで再現できるようにするため。実プロセスを起動しないと確認できない作りだと、
 * 壊れたことに気づけない。
 */

export interface ChromeProcessInfo {
  pid: number;
  /** コマンドラインに --remote-debugging-port が無ければnull。 */
  port: number | null;
}

/** spawnしたChromeが、ポートを開く前に終了したことを表す。 */
export const CHROME_EXITED_EARLY = "CHROME_EXITED_EARLY";

export interface ChromeLauncherDeps {
  preferredPort: number;
  isDebugPortAlive(port: number): Promise<boolean>;
  findChromeProcessesUsingProfile(): Promise<readonly ChromeProcessInfo[]>;
  killPids(pids: readonly number[]): Promise<void>;
  clearProfileLocks(): Promise<void>;
  findFreePort(preferred: number): Promise<number>;
  /** ポートが応答するまで待つ。開く前に終了した場合はCHROME_EXITED_EARLYでthrowする。 */
  spawnChrome(port: number): Promise<void>;
  log(message: string): void;
}

/**
 * 中継先として使うCDPポートを確定させる。解決順は次のとおり。
 *   1. 既定ポートが生きていればそのまま使う
 *   2. プロファイルを使っているChromeのポートが生きていれば、そちらに合わせる
 *      （アプリ更新で既定ポートが変わっても、残っている旧Chromeに繋がるようにする）
 *   3. 掴んでいるだけで応答しないChromeは終了させ、ロックを消してから起動する
 */
export async function resolveChromeDebugPort(deps: ChromeLauncherDeps): Promise<number> {
  if (await deps.isDebugPortAlive(deps.preferredPort)) {
    deps.log(`既に起動中のChromeを再利用します（ポート${deps.preferredPort}）。`);
    return deps.preferredPort;
  }

  const existing = await deps.findChromeProcessesUsingProfile();
  for (const { port } of existing) {
    if (port !== null && port !== deps.preferredPort && (await deps.isDebugPortAlive(port))) {
      deps.log(`起動中のChromeを見つけました。ポート${port}に接続します。`);
      return port;
    }
  }

  if (existing.length > 0) {
    // プロファイルは掴んでいるのにCDPで応答しない。このまま起動しても既存セッションへ
    // 転送されて終わるので、先に片付ける。専用プロファイルなので通常のChromeは巻き込まない。
    deps.log("応答しないChromeがプロファイルを使用中のため、終了させます。");
    await deps.killPids(existing.map((e) => e.pid));
  }
  await deps.clearProfileLocks();

  const port = await deps.findFreePort(deps.preferredPort);
  try {
    await deps.spawnChrome(port);
    deps.log(`ローカルChromeを起動しました（ポート${port}）。`);
    return port;
  } catch (error) {
    if ((error as Error).message !== CHROME_EXITED_EARLY) throw error;
  }

  // 起動直後に終了した＝まだ何かがプロファイルを掴んでいる。もう一度だけ片付けて試す。
  deps.log("Chromeが既存セッションへ転送されたため、後始末してから再試行します。");
  await deps.killPids((await deps.findChromeProcessesUsingProfile()).map((e) => e.pid));
  await deps.clearProfileLocks();

  const retryPort = await deps.findFreePort(deps.preferredPort);
  await deps.spawnChrome(retryPort);
  deps.log(`ローカルChromeを起動しました（ポート${retryPort}）。`);
  return retryPort;
}

/**
 * `ps -Ao pid=,command=`（Windowsはpowershellの`ProcessId CommandLine`）の出力から、
 * このプロファイルを使っているChromeのブラウザ本体だけを拾う。
 *
 * --type= を持つ行はGPU/レンダラ等の子プロセス。これらもプロファイルパスを含むため、
 * 除外しないとブラウザ本体以外を大量に掴んで誤ったkill対象になる。
 */
export function parseChromeProcessLines(
  stdout: string,
  profileDir: string,
): readonly ChromeProcessInfo[] {
  const results: ChromeProcessInfo[] = [];

  for (const line of stdout.split("\n")) {
    if (!line.includes(profileDir)) continue;
    if (/--type=/.test(line)) continue;

    const pid = Number(line.trim().split(/\s+/)[0]);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    const portMatch = line.match(/--remote-debugging-port=(\d+)/);
    results.push({ pid, port: portMatch ? Number(portMatch[1]) : null });
  }

  return results;
}
