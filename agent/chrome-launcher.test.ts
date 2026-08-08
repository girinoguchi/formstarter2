import { describe, expect, it, vi } from "vitest";

import {
  CHROME_EXITED_EARLY,
  parseChromeProcessLines,
  resolveChromeDebugPort,
  type ChromeLauncherDeps,
  type ChromeProcessInfo,
} from "./chrome-launcher";

const PROFILE = "/Users/me/Library/Application Support/formstarter2-agent/chrome-profile";

/**
 * 既定は「何も起動していない環境」。各テストは必要な差分だけ上書きする。
 * alivePortsに入れたポートだけがCDPで応答する、という模擬にしている。
 */
function makeDeps(
  overrides: Partial<ChromeLauncherDeps> & { alivePorts?: number[]; existing?: ChromeProcessInfo[] } = {},
) {
  const alivePorts = new Set(overrides.alivePorts ?? []);
  const existing = overrides.existing ?? [];

  // vi.mocked()で呼び出し検証できるよう、実装はすべてvi.fn()で用意する。
  const deps: ChromeLauncherDeps & { logs: string[] } = {
    preferredPort: 9422,
    isDebugPortAlive: vi.fn(async (port: number) => alivePorts.has(port)),
    findChromeProcessesUsingProfile: vi.fn(async () => existing),
    killPids: vi.fn(async () => {}),
    clearProfileLocks: vi.fn(async () => {}),
    findFreePort: vi.fn(async (preferred: number) => preferred),
    // spawnに成功したら、そのポートは応答するようになる。
    spawnChrome: vi.fn(async (port: number) => {
      alivePorts.add(port);
    }),
    logs: [] as string[],
    log: vi.fn(),
    ...overrides,
  };
  return deps;
}

describe("resolveChromeDebugPort", () => {
  it("既定ポートが生きていればそのまま再利用し、何も起動しない", async () => {
    const deps = makeDeps({ alivePorts: [9422] });

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9422);
    expect(vi.mocked(deps.spawnChrome)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.killPids)).not.toHaveBeenCalled();
  });

  // 2026-08-08の実障害の回帰テスト。エージェントの既定ポートを9433→9422に変えた後、
  // 9433で起動したままの古いChromeがプロファイルを掴んでいた。ポート決め打ちで探すと
  // 見つけられず、同じプロファイルで起動しようとしたChromeは既存セッションへ転送されて
  // 即終了するため、9422は永久に開かず「開く」ボタンが無反応になった。
  it("既定ポートが死んでいても、別ポートで動いている自分のChromeに接続先を合わせる", async () => {
    const deps = makeDeps({
      alivePorts: [9433],
      existing: [{ pid: 9811, port: 9433 }],
    });

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9433);
    // 生きているものを殺して起動し直すのは、開いているタブを失うので誤り。
    expect(vi.mocked(deps.killPids)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.spawnChrome)).not.toHaveBeenCalled();
  });

  it("プロファイルを掴んでいるが応答しないChromeは終了させ、ロックを消してから起動する", async () => {
    const deps = makeDeps({ existing: [{ pid: 55199, port: 9422 }] });

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9422);
    expect(vi.mocked(deps.killPids)).toHaveBeenCalledWith([55199]);
    expect(vi.mocked(deps.clearProfileLocks)).toHaveBeenCalled();
    expect(vi.mocked(deps.spawnChrome)).toHaveBeenCalledWith(9422);
  });

  it("既存プロセスが無ければ、kill せずに起動する", async () => {
    const deps = makeDeps();

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9422);
    expect(vi.mocked(deps.killPids)).not.toHaveBeenCalled();
    expect(vi.mocked(deps.spawnChrome)).toHaveBeenCalledWith(9422);
  });

  // 起動直後に終了する＝Chromeが「既存のブラウザ セッションで開いています」と
  // 転送したケース。掴んでいるプロセスをps経由では拾えないことがあるため、
  // 後始末してもう一度だけ試す。
  it("起動直後に終了した場合は、後始末して1回だけ再試行する", async () => {
    const deps = makeDeps();
    deps.spawnChrome = vi
      .fn()
      .mockRejectedValueOnce(new Error(CHROME_EXITED_EARLY))
      .mockResolvedValueOnce(undefined);

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9422);
    expect(vi.mocked(deps.spawnChrome)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.clearProfileLocks)).toHaveBeenCalledTimes(2);
  });

  it("再試行しても起動できなければエラーを投げる（無言で固まらせない）", async () => {
    const deps = makeDeps();
    deps.spawnChrome = vi.fn().mockRejectedValue(new Error(CHROME_EXITED_EARLY));

    await expect(resolveChromeDebugPort(deps)).rejects.toThrow(CHROME_EXITED_EARLY);
  });

  it("起動失敗（Chromeが見つからない等）はそのまま伝える", async () => {
    const deps = makeDeps();
    deps.spawnChrome = vi.fn().mockRejectedValue(new Error("Chromeの実行ファイルが見つかりません"));

    await expect(resolveChromeDebugPort(deps)).rejects.toThrow("Chromeの実行ファイルが見つかりません");
    // 原因が別なのに再試行して待たせない。
    expect(vi.mocked(deps.spawnChrome)).toHaveBeenCalledTimes(1);
  });

  it("既定ポートが他アプリに使われていれば、空きポートで起動する", async () => {
    const deps = makeDeps();
    deps.findFreePort = vi.fn(async () => 9425);

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9425);
    expect(vi.mocked(deps.spawnChrome)).toHaveBeenCalledWith(9425);
  });

  it("ポート不明の既存プロセスがあっても、生存確認に進んで起動できる", async () => {
    const deps = makeDeps({ existing: [{ pid: 100, port: null }] });

    await expect(resolveChromeDebugPort(deps)).resolves.toBe(9422);
    expect(vi.mocked(deps.killPids)).toHaveBeenCalledWith([100]);
  });
});

describe("parseChromeProcessLines", () => {
  it("ブラウザ本体のpidとポートを取り出す", () => {
    const stdout = ` 9811 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9433 --user-data-dir=${PROFILE}\n`;

    expect(parseChromeProcessLines(stdout, PROFILE)).toEqual([{ pid: 9811, port: 9433 }]);
  });

  // GPU/レンダラ等の子プロセスもプロファイルパスを含む。これを除外しないと
  // 大量のpidをkill対象にしてしまう。
  it("--type= を持つ子プロセスは除外する", () => {
    const stdout = [
      ` 9811 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9433 --user-data-dir=${PROFILE}`,
      ` 9823 /Applications/Google Chrome Helper --type=gpu-process --user-data-dir=${PROFILE}`,
      ` 9826 /Applications/Google Chrome Helper --type=utility --user-data-dir=${PROFILE}`,
    ].join("\n");

    expect(parseChromeProcessLines(stdout, PROFILE)).toEqual([{ pid: 9811, port: 9433 }]);
  });

  it("別プロファイル（利用者が普段使うChrome）は対象にしない", () => {
    const stdout = ` 4321 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome\n 4322 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/Users/me/Library/Application Support/Google/Chrome\n`;

    expect(parseChromeProcessLines(stdout, PROFILE)).toEqual([]);
  });

  it("--remote-debugging-port が無ければ port は null", () => {
    const stdout = ` 555 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=${PROFILE}\n`;

    expect(parseChromeProcessLines(stdout, PROFILE)).toEqual([{ pid: 555, port: null }]);
  });

  it("Windows（powershell）の出力形式も読める", () => {
    const winProfile = "C:\\Users\\me\\AppData\\Local\\formstarter2-agent\\chrome-profile";
    const stdout = `4321 "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9422 --user-data-dir=${winProfile}\n`;

    expect(parseChromeProcessLines(stdout, winProfile)).toEqual([{ pid: 4321, port: 9422 }]);
  });

  it("空行やヘッダー行が混ざっても壊れない", () => {
    const stdout = `\n  PID COMMAND\n 9811 chrome --user-data-dir=${PROFILE}\n`;

    expect(parseChromeProcessLines(stdout, PROFILE)).toEqual([{ pid: 9811, port: null }]);
  });
});
