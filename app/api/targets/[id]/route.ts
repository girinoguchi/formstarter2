import { NextResponse } from "next/server";

import { getTargetRepository } from "../../../../src/lib/di";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = await getTargetRepository().findById(id);
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ target });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getTargetRepository().softDelete(id);
  return NextResponse.json({ ok: true });
}
