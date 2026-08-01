import { jwtVerify } from "jose";

/**
 * middleware.ts（Edge Runtime）専用。bcryptjsはEdgeで動かないため、
 * ここではJWT検証のみを行いbcryptを一切importしない
 * （FormStarterappのlib/auth-edge.tsと同じ分離方針）。
 */
export const SESSION_COOKIE_NAME = "session";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
