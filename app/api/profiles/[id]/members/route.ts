import { NextRequest, NextResponse } from "next/server";

import { getProfileRepository } from "../../../../../src/lib/di";
import { requireSession } from "../../../../../src/lib/ownership";

/**
 * プロジェクトを「使える人」の割り当て。操作できるのは作成者だけで、
 * リポジトリ側はownerIdが合わないと黙って何もしないため、ここで先に404を返す。
 */

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const members = await getProfileRepository().listMembers(id, guard.user.id);
  if (!members) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ members });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (!(await getProfileRepository().listMembers(id, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  await getProfileRepository().addMember(id, userId, guard.user.id);
  const members = await getProfileRepository().listMembers(id, guard.user.id);
  return NextResponse.json({ members }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  if (!(await getProfileRepository().listMembers(id, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const userId = new URL(request.url).searchParams.get("userId")?.trim() ?? "";
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  await getProfileRepository().removeMember(id, userId, guard.user.id);
  const members = await getProfileRepository().listMembers(id, guard.user.id);
  return NextResponse.json({ members });
}
