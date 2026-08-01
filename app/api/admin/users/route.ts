import { NextRequest, NextResponse } from "next/server";

import { hashPassword, requireAdmin } from "../../../../src/lib/auth";
import { getUserRepository } from "../../../../src/lib/di";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const users = await getUserRepository().list();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const isAdmin = Boolean(body.isAdmin);

  if (!username || !password) {
    return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "パスワードは6文字以上にしてください" }, { status: 400 });
  }

  const existing = await getUserRepository().findByUsername(username);
  if (existing) {
    return NextResponse.json({ error: "そのユーザー名は既に使われています" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await getUserRepository().create({ username, passwordHash, isAdmin });
  return NextResponse.json({ user }, { status: 201 });
}
