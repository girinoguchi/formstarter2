import { NextRequest, NextResponse } from "next/server";

import { createSessionToken, setSessionCookie, verifyPassword } from "../../../../src/lib/auth";
import { getUserRepository } from "../../../../src/lib/di";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "ユーザー名とパスワードを入力してください" }, { status: 400 });
  }

  const user = await getUserRepository().findByUsername(username);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "ユーザー名またはパスワードが違います" }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  await setSessionCookie(token);

  return NextResponse.json({ user: { id: user.id, username: user.username } });
}
