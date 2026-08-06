import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../src/lib/auth";
import { getProfileRepository } from "../../../src/lib/di";
import { requireSession } from "../../../src/lib/ownership";

export async function GET() {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const profiles = await getProfileRepository().list(guard.user.id);
  return NextResponse.json({ profiles });
}

// プロジェクトを作れるのは管理者だけ。作業者は管理者が作ったものを割り当てられて使う
// （送信内容設定の画面自体も管理者限定なので、UIとAPIで判定を揃えている）。
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await getProfileRepository().create(name, guard.user.id);
  return NextResponse.json({ profile }, { status: 201 });
}
