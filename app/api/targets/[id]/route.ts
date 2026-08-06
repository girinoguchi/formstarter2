import { NextResponse } from "next/server";

import { getTargetRepository } from "../../../../src/lib/di";
import { requireAccessibleTarget, requireSession } from "../../../../src/lib/ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const target = await requireAccessibleTarget(id, guard.user.id);
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ target });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const target = await requireAccessibleTarget(id, guard.user.id);
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await getTargetRepository().softDelete(id);
  return NextResponse.json({ ok: true });
}
