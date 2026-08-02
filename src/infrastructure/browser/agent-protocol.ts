// VPS(server.ts / agent-tunnel-registry.ts)とローカルエージェント(agent/index.ts)の両方から
// 相対importで共有するバイナリフレームのコーデック。CDP/HTTPの中身は一切解釈しない、
// 複数のTCPストリームを1本のWebSocket上で多重化するための最小限のヘッダのみを扱う。
//
// フレーム形式:
//   byte 0      : type (1=open, 2=data, 3=close)
//   bytes 1..4  : streamId (uint32, big-endian)
//   bytes 5..end: payload（open/closeは空でよい）

export const FRAME_TYPE_OPEN = 1;
export const FRAME_TYPE_DATA = 2;
export const FRAME_TYPE_CLOSE = 3;

export type FrameType = typeof FRAME_TYPE_OPEN | typeof FRAME_TYPE_DATA | typeof FRAME_TYPE_CLOSE;

export interface AgentFrame {
  type: FrameType;
  streamId: number;
  payload: Buffer;
}

const HEADER_LENGTH = 5;
const EMPTY_PAYLOAD = Buffer.alloc(0);

export function encodeFrame(frame: { type: FrameType; streamId: number; payload?: Buffer }): Buffer {
  const payload = frame.payload ?? EMPTY_PAYLOAD;
  const buf = Buffer.allocUnsafe(HEADER_LENGTH + payload.length);
  buf.writeUInt8(frame.type, 0);
  buf.writeUInt32BE(frame.streamId, 1);
  payload.copy(buf, HEADER_LENGTH);
  return buf;
}

export function decodeFrame(buf: Buffer): AgentFrame {
  if (buf.length < HEADER_LENGTH) {
    throw new Error(`agent-protocol: frame too short (${buf.length} bytes)`);
  }
  const type = buf.readUInt8(0);
  if (type !== FRAME_TYPE_OPEN && type !== FRAME_TYPE_DATA && type !== FRAME_TYPE_CLOSE) {
    throw new Error(`agent-protocol: unknown frame type ${type}`);
  }
  const streamId = buf.readUInt32BE(1);
  const payload = buf.subarray(HEADER_LENGTH);
  return { type, streamId, payload };
}
