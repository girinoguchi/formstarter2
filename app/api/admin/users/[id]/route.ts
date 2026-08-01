import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../../src/lib/auth";
import { getUserRepository } from "../../../../../src/lib/di";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const body = await request.json();
  const isAdmin = Boolean(body.isAdmin);

  if (id === guard.user.id && !isAdmin) {
    return NextResponse.json({ error: "自分自身の管理者権限は外せません" }, { status: 400 });
  }

  await getUserRepository().updateIsAdmin(id, isAdmin);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (id === guard.user.id) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }

  await getUserRepository().remove(id);
  return NextResponse.json({ ok: true });
}
