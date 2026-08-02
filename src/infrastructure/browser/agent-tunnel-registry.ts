import net from "node:net";

import type { WebSocket } from "ws";

import { decodeFrame, encodeFrame, FRAME_TYPE_CLOSE, FRAME_TYPE_DATA, FRAME_TYPE_OPEN } from "./agent-protocol";

/**
 * アカウントごとに、その顧客のPC上で動くローカルエージェント経由でChromeのCDPポートへ
 * バイトを中継する。ownerIdごとに専用のlocalhost TCPサーバー（Playwright側が
 * connectOverCDP()する相手）を1つ持ち、そこへの接続をWebSocket（エージェント）越しに
 * 多重化して転送する。中継はCDP/HTTPの中身を一切解釈しない——生バイトを右から左に
 * 流すだけ（agent-protocol.tsのフレームヘッダのみ扱う）。
 *
 * globalThisにキャッシュするのは、Next.jsのdev（ホットリロード）でモジュールが
 * 再評価されても、生きているTCPサーバー・WebSocket接続・ストリーム状態を失わないため
 * （playwright-session-manager.tsの__sharedChromeReadyと同じ意図）。
 */

interface OwnerTunnelState {
  server: net.Server;
  port: number;
  ws: WebSocket | null;
  nextStreamId: number;
  streams: Map<number, net.Socket>;
}

export interface AgentTunnelRegistry {
  /** エージェントのWebSocket接続を登録する。同じownerIdで既存の接続があれば入れ替える。 */
  registerAgent(ownerId: string, ws: WebSocket): Promise<number>;
  /** ownerIdに対応する中継用ローカルポートを返す。エージェント未接続ならエラー。 */
  getLocalPort(ownerId: string): number;
}

const globalForAgentTunnel = globalThis as unknown as {
  __agentTunnelStates?: Map<string, OwnerTunnelState>;
};

function getStates(): Map<string, OwnerTunnelState> {
  if (!globalForAgentTunnel.__agentTunnelStates) {
    globalForAgentTunnel.__agentTunnelStates = new Map();
  }
  return globalForAgentTunnel.__agentTunnelStates;
}

function destroyAllStreams(state: OwnerTunnelState): void {
  for (const socket of state.streams.values()) {
    socket.destroy();
  }
  state.streams.clear();
}

function sendFrame(ws: WebSocket, frame: { type: 1 | 2 | 3; streamId: number; payload?: Buffer }): void {
  try {
    ws.send(encodeFrame(frame));
  } catch {
    // wsが閉じかけている等で送信できなくても、対応するsocket側のclose/errorで後始末される。
  }
}

function createOwnerState(ownerId: string): Promise<OwnerTunnelState> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const state = getStates().get(ownerId);
      if (!state || !state.ws) {
        socket.destroy();
        return;
      }

      const streamId = state.nextStreamId++;
      state.streams.set(streamId, socket);
      sendFrame(state.ws, { type: FRAME_TYPE_OPEN, streamId });

      socket.on("data", (chunk: Buffer) => {
        const current = getStates().get(ownerId);
        if (!current?.ws) {
          socket.destroy();
          return;
        }
        sendFrame(current.ws, { type: FRAME_TYPE_DATA, streamId, payload: chunk });
      });

      const cleanup = () => {
        const current = getStates().get(ownerId);
        if (current?.ws) sendFrame(current.ws, { type: FRAME_TYPE_CLOSE, streamId });
        current?.streams.delete(streamId);
      };
      socket.on("close", cleanup);
      socket.on("error", cleanup);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("agent-tunnel-registry: failed to bind ephemeral port"));
        return;
      }
      resolve({ server, port: address.port, ws: null, nextStreamId: 1, streams: new Map() });
    });
  });
}

function wireAgentSocket(ownerId: string, state: OwnerTunnelState, ws: WebSocket): void {
  ws.on("message", (data: Buffer) => {
    let frame;
    try {
      frame = decodeFrame(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
    } catch {
      return;
    }
    const socket = state.streams.get(frame.streamId);
    if (!socket) return;

    if (frame.type === FRAME_TYPE_DATA) {
      socket.write(frame.payload);
    } else if (frame.type === FRAME_TYPE_CLOSE) {
      socket.end();
      state.streams.delete(frame.streamId);
    }
    // FRAME_TYPE_OPEN はエージェント側からは送られてこない想定（VPS側だけが接続の起点）。
  });

  const onDisconnect = () => {
    const current = getStates().get(ownerId);
    if (current && current.ws === ws) {
      current.ws = null;
      destroyAllStreams(current);
    }
  };
  ws.on("close", onDisconnect);
  ws.on("error", onDisconnect);
}

export function getAgentTunnelRegistry(): AgentTunnelRegistry {
  return {
    async registerAgent(ownerId: string, ws: WebSocket): Promise<number> {
      let state = getStates().get(ownerId);
      if (!state) {
        state = await createOwnerState(ownerId);
        getStates().set(ownerId, state);
      } else if (state.ws) {
        // 同一アカウントの新しい接続に入れ替える（1アカウント1エージェントの前提）。
        state.ws.removeAllListeners();
        state.ws.terminate();
        destroyAllStreams(state);
      }

      state.ws = ws;
      wireAgentSocket(ownerId, state, ws);
      return state.port;
    },

    getLocalPort(ownerId: string): number {
      const state = getStates().get(ownerId);
      if (!state || !state.ws || state.ws.readyState !== 1 /* WebSocket.OPEN */) {
        throw new Error(
          `ローカルエージェントが接続されていません（アカウント: ${ownerId}）。ローカルエージェントを起動してください。`,
        );
      }
      return state.port;
    },
  };
}
