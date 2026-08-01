import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

import type { User } from "../domain/entities/user";
import { env } from "../config/env";
import { getUserRepository } from "./di";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth-edge";

export { SESSION_COOKIE_NAME };

// FormStarterappと同じくbcryptjs（コスト12）。Node runtime専用
// （API route / Server Component側でのみimportする——middleware.tsからは使わない）。
const BCRYPT_COST = 12;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7日

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.AUTH_SECRET);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

/** 現在ログイン中のユーザーを返す。未ログイン/トークン不正ならnull。 */
export async function getSession(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const verified = await verifySessionToken(token);
  if (!verified) return null;

  return getUserRepository().findById(verified.userId);
}

/**
 * admin専用API routeの先頭で呼ぶガード。管理者でなければ返り値のresponseを
 * そのままreturnさせる（未ログインは401、ログイン済みだが作業者は403）。
 * middleware.tsは未ログインの排除のみ担当し、isAdmin判定はここで行う
 * （FormStarterappの「各admin route個別にisAdminチェック」パターンを踏襲）。
 */
export async function requireAdmin(): Promise<{ user: User } | { response: Response }> {
  const user = await getSession();
  if (!user) {
    return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (!user.isAdmin) {
    return { response: Response.json({ error: "管理者のみ実行できます" }, { status: 403 }) };
  }
  return { user };
}
