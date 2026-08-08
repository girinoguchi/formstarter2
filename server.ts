import { createServer } from "node:http";
import { parse } from "node:url";

import next from "next";
import { WebSocketServer, type WebSocket } from "ws";

import { getAgentTunnelRegistry } from "./src/infrastructure/browser/agent-tunnel-registry";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./src/lib/auth-edge";

/**
 * Next.jsのカスタムサーバー。通常のHTTPリクエストは`next()`のrequestHandlerへそのまま
 * 委譲し、`/agent-ws`へのWebSocketアップグレードだけをここで横取りして、顧客PC上の
 * ローカルエージェントとVPS側のPlaywrightコードを中継する（agent-tunnel-registry.ts）。
 *
 * next()単体（next dev/next start）はリクエスト・レスポンスの往復しか扱えず、
 * WebSocketのような持続的接続をAPI Route内で保持できないため、これが必要になる
 * （Next.js公式の「カスタムサーバー」パターン）。
 */

const dev = process.env.NODE_ENV !== "production";
// 既定値は3000ではなく3300。開発機では他プロジェクトが3000〜3002を使っていることが多く、
// EADDRINUSEで起動できないため、このプロジェクト専用の番号を確保している。
// VPSではsystemd（deploy/systemd/formstarter2-app.service）がPORTを明示指定するので影響しない。
const port = Number(process.env.PORT) || 3300;

const app = next({ dev });
const handle = app.getRequestHandler();

function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res, parse(req.url ?? "", true));
  });

  const wss = new WebSocketServer({ noServer: true });
  // Next.js自身もWebSocketを使う——開発時のHMR（/_next/webpack-hmr）がそれで、
  // ここで切ってしまうとブラウザ側のdevクライアントが繋がらず、ホットリロードも
  // 画面の操作も効かなくなる。/agent-ws以外はNext.jsのハンドラへそのまま委譲する。
  const upgradeNext = app.getUpgradeHandler();

  httpServer.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "", true);
    if (pathname !== "/agent-ws") {
      void upgradeNext(req, socket, head);
      return;
    }

    const token = parseSessionCookie(req.headers.cookie);
    void (async () => {
      const verified = token ? await verifySessionToken(token) : null;
      if (!verified) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        void getAgentTunnelRegistry().registerAgent(verified.userId, ws);
      });
    })();
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (agent relay: /agent-ws)`);
  });
});
