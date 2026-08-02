import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

import "dotenv/config";
import WebSocket from "ws";

import { decodeFrame, encodeFrame, FRAME_TYPE_CLOSE, FRAME_TYPE_DATA, FRAME_TYPE_OPEN } from "../src/infrastructure/browser/agent-protocol";

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
const CHROME_DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT ?? 9422);
const CHROME_PROFILE_DIR = path.join(tmpdir(), "formstarter2-agent-chrome-profile");

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`環境変数 ${name} が設定されていません。agent/.env.example を参考に agent/.env を作成してください。`);
    process.exit(1);
  }
  return value;
}

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
    throw new Error("実Chromeの実行ファイルが見つかりませんでした。Google Chromeをインストールしてください。");
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

async function ensureLocalChrome(): Promise<void> {
  try {
    const res = await fetch(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/version`);
    if (res.ok) {
      console.log("既に起動中のChromeを再利用します。");
      return;
    }
  } catch {
    // 未起動なら起動する。
  }

  await mkdir(CHROME_PROFILE_DIR, { recursive: true });
  const executable = findChromeExecutable();
  chromeProcess = spawn(
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
  console.log("ローカルChromeを起動しました。");
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
      const socket = net.connect(CHROME_DEBUG_PORT, "127.0.0.1");
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
