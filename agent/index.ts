import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import net from "node:net";
import { homedir } from "node:os";
import path from "node:path";

import "dotenv/config";
import WebSocket from "ws";

import { decodeFrame, encodeFrame, FRAME_TYPE_CLOSE, FRAME_TYPE_DATA, FRAME_TYPE_OPEN } from "../src/infrastructure/browser/agent-protocol";
import {
  CHROME_EXITED_EARLY,
  parseChromeProcessLines,
  resolveChromeDebugPort,
  type ChromeProcessInfo,
} from "./chrome-launcher";

/**
 * formstarter2のローカルエージェント。顧客本人のPC上で実行する。
 *
 * 1. ローカルChromeを実Chromeプロセスとして起動する（--remote-debugging-portのみ、
 *    人間が普段使うのと同じ起動——playwright-session-manager.tsが以前VPS側で
 *    やっていたのと同じ理由: Cloudflare Turnstile等がCDP接続の存在自体を検知するため、
 *    自動化ツールが管理するプロセスにしない）。
 * 2. 既存のログインAPI（/api/auth/login）でアカウントにログインし、セッションCookieを取得。
 * 3. そのCookieを使ってVPSへWebSocket接続（/agent-ws）。VPS側はCookieを検証してownerId
 *    （＝このエージェントがどのアカウントのものか）を特定する。
 * 4. VPSから送られてくる「open」を受けたら、ローカルChromeのCDPポートへTCP接続し、
 *    以降はバイト列をそのまま中継する（CDP/HTTPの中身は一切解釈しない）。
 *
 * 送信ボタンは常に本人が手動で押す設計のため、フォーム入力が終わればVPS側が
 * detach()し、以降このエージェントは単にChromeを起動したままにしておくだけになる。
 */

const SERVER_URL = requireEnv("FORMSTARTER_SERVER_URL");
const USERNAME = requireEnv("FORMSTARTER_USERNAME");
const PASSWORD = requireEnv("FORMSTARTER_PASSWORD");

const PREFERRED_DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9422);

/**
 * 実際に中継先として使うポート。起動時に確定させる。
 *
 * 定数にできないのは、既に起動しているエージェント用Chromeを見つけた場合に、その
 * プロセスが実際に開いているポートへ合わせる必要があるため。アプリ更新で既定ポートが
 * 変わっても（実際に9433→9422の変更があった）、古いChromeが残っていれば繋ぎ先はそちらになる。
 */
let chromeDebugPort = PREFERRED_DEBUG_PORT;

/**
 * Chromeプロファイルの置き場所。tmpdirはOSに削除されうる（macOSは/var/foldersを定期的に
 * 掃除し、Linuxは再起動で/tmpが消える）ため、ログイン状態を保持できるユーザー領域に置く。
 */
function defaultProfileDir(): string {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
    return path.join(base, "formstarter2-agent", "chrome-profile");
  }
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Application Support", "formstarter2-agent", "chrome-profile");
  }
  const base = process.env.XDG_DATA_HOME ?? path.join(homedir(), ".local", "share");
  return path.join(base, "formstarter2-agent", "chrome-profile");
}

const CHROME_PROFILE_DIR = process.env.CHROME_PROFILE_DIR ?? defaultProfileDir();

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。agent/.env.example を参考に agent/.env を作成してください。`);
    process.exit(1);
  }
  return value;
}

/**
 * Chrome実行ファイルの探索先。顧客のPC構成は読めないため、環境変数での明示指定を
 * 最優先にしたうえで、OSごとの一般的な設置場所を広めに見る。
 * Windowsはシステム全体インストールとユーザー単位インストールの両方が普通にあり、
 * 後者（LOCALAPPDATA配下）を見ないと「Chromeはあるのに見つからない」が起きる。
 */
function chromeExecutableCandidates(): readonly string[] {
  const explicit = process.env.CHROME_EXECUTABLE;
  if (explicit) return [explicit];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
    const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [
      path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    ];
  }

  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    ];
  }

  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
  ];
}

function findChromeExecutable(): string {
  const candidates = chromeExecutableCandidates();
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "Google Chromeの実行ファイルが見つかりませんでした。Chromeをインストールするか、" +
        "環境変数 CHROME_EXECUTABLE に実行ファイルのパスを指定してください。\n" +
        `探索した場所:\n${candidates.map((c) => `  - ${c}`).join("\n")}`,
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

let chromeProcess: ChildProcess | null = null;

const execFileAsync = promisify(execFile);

/**
 * 指定ポートでCDPが応答するか。
 *
 * タイムアウトは必須。ハングしたChromeはポートを掴んだまま応答を返さず、TCP接続自体は
 * 成立してしまうため、素のfetchだとここで永久に待ち続けてエージェントが無言で固まる。
 */
async function isDebugPortAlive(port: number, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * このエージェント用プロファイルを使っているChromeプロセスを、コマンドラインから探す。
 * ポートが分からなくても見つけられるようにするのが目的——アプリ更新で既定ポートが
 * 変わったり、前回異常終了したChromeが残っていたりすると、ポート決め打ちでは検出できない。
 */
async function findChromeProcessesUsingProfile(): Promise<readonly ChromeProcessInfo[]> {
  try {
    const { stdout } =
      process.platform === "win32"
        ? await execFileAsync("powershell.exe", [
            "-NoProfile",
            "-Command",
            'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }',
          ])
        : await execFileAsync("ps", ["-Ao", "pid=,command="]);
    return parseChromeProcessLines(stdout, CHROME_PROFILE_DIR);
  } catch {
    // psやpowershellが使えない環境では検出を諦め、通常の起動フローに任せる。
    return [];
  }
}

function isAlive(pid: number): boolean {
  try {
    // シグナル0は存在確認のみで、プロセスには何も送らない。
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * SIGTERMで終わらなければSIGKILLまで上げる。ハングしたChromeはSIGTERMを処理できないことが
 * あり（応答不能＝シグナルハンドラも回らない）、そのままだとプロファイルを掴んだままになる。
 */
async function killPids(pids: readonly number[]): Promise<void> {
  if (pids.length === 0) return;

  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]);
      } else {
        process.kill(pid, "SIGTERM");
      }
    } catch {
      // 既に終了している場合は無視する。
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (process.platform === "win32") return; // taskkill /F は既に強制終了。
  const survivors = pids.filter(isAlive);
  if (survivors.length === 0) return;

  for (const pid of survivors) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 競合で既に消えていれば無視する。
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

/**
 * 前回の異常終了で残ったロックを消す。これが残っていると、Chromeは新規起動せず
 * 「既存のブラウザ セッションで開いています」と既存プロセスへ転送して即終了するため、
 * デバッグポートが永久に開かない。
 */
async function clearProfileLocks(): Promise<void> {
  try {
    for (const name of await readdir(CHROME_PROFILE_DIR)) {
      if (name.startsWith("Singleton")) {
        await rm(path.join(CHROME_PROFILE_DIR, name), { force: true });
      }
    }
  } catch {
    // プロファイル未作成なら何もしなくてよい。
  }
}

/** 既定ポートが他のアプリに使われている場合に備え、空きポートを1つ確保する。 */
async function findFreePort(preferred: number): Promise<number> {
  for (let port = preferred; port < preferred + 20; port += 1) {
    const free = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => server.close(() => resolve(true)));
      server.listen(port, "127.0.0.1");
    });
    if (free) return port;
  }
  return preferred;
}

async function spawnChrome(port: number): Promise<void> {
  await mkdir(CHROME_PROFILE_DIR, { recursive: true });
  const executable = findChromeExecutable();

  chromeProcess = spawn(
    executable,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${CHROME_PROFILE_DIR}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore", detached: false },
  );

  // 「既存セッションへ転送して即終了」を検知するため、終了を監視する。これを見ないと
  // 原因が分からないまま待ち時間だけ消費して落ちる。
  let exitedEarly = false;
  chromeProcess.once("exit", () => {
    exitedEarly = true;
  });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await isDebugPortAlive(port)) return;
    if (exitedEarly) {
      throw new Error(CHROME_EXITED_EARLY);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chromeのデバッグポート(${port})が起動しませんでした`);
}

async function ensureLocalChrome(): Promise<void> {
  chromeDebugPort = await resolveChromeDebugPort({
    preferredPort: PREFERRED_DEBUG_PORT,
    isDebugPortAlive,
    findChromeProcessesUsingProfile,
    killPids,
    clearProfileLocks,
    findFreePort,
    spawnChrome,
    log: (message) => console.log(message),
  });
}

async function login(): Promise<string> {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`ログインに失敗しました (HTTP ${res.status})`);
  }
  const setCookie = res.headers.get("set-cookie");
  const match = setCookie?.match(/session=([^;]+)/);
  if (!match) {
    throw new Error("ログイン応答にセッションCookieが含まれていませんでした");
  }
  return match[1];
}

function wsUrlFor(serverUrl: string): string {
  const url = new URL(serverUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/agent-ws";
  return url.toString();
}

function connectRelay(sessionCookie: string, attempt = 0): void {
  const ws = new WebSocket(wsUrlFor(SERVER_URL), { headers: { Cookie: `session=${sessionCookie}` } });
  const localSockets = new Map<number, net.Socket>();

  ws.on("open", () => {
    console.log("VPSへの中継接続を確立しました。");
    attempt = 0;
  });

  ws.on("message", (data: Buffer) => {
    const frame = decodeFrame(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));

    if (frame.type === FRAME_TYPE_OPEN) {
      const socket = net.connect(chromeDebugPort, "127.0.0.1");
      localSockets.set(frame.streamId, socket);

      socket.on("data", (chunk) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encodeFrame({ type: FRAME_TYPE_DATA, streamId: frame.streamId, payload: chunk }));
        }
      });
      const cleanup = () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encodeFrame({ type: FRAME_TYPE_CLOSE, streamId: frame.streamId }));
        }
        localSockets.delete(frame.streamId);
      };
      socket.on("close", cleanup);
      socket.on("error", cleanup);
      return;
    }

    const socket = localSockets.get(frame.streamId);
    if (!socket) return;

    if (frame.type === FRAME_TYPE_DATA) {
      socket.write(frame.payload);
    } else if (frame.type === FRAME_TYPE_CLOSE) {
      socket.end();
      localSockets.delete(frame.streamId);
    }
  });

  const reconnect = () => {
    for (const socket of localSockets.values()) socket.destroy();
    localSockets.clear();
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    console.log(`VPSとの接続が切れました。${delay / 1000}秒後に再接続します…`);
    setTimeout(() => {
      void main(attempt + 1);
    }, delay);
  };
  ws.on("close", reconnect);
  ws.on("error", (error) => {
    console.error("中継接続エラー:", error.message);
  });
}

async function main(attempt = 0): Promise<void> {
  await ensureLocalChrome();
  try {
    const sessionCookie = await login();
    connectRelay(sessionCookie, attempt);
  } catch (error) {
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    console.error("VPSへの接続に失敗しました:", (error as Error).message, `${delay / 1000}秒後に再試行します…`);
    setTimeout(() => void main(attempt + 1), delay);
  }
}

process.on("SIGINT", () => {
  console.log("\n終了します（Chromeは開いたままにします）。");
  process.exit(0);
});

void main();
