import { NextResponse } from "next/server";

import { getProfileRepository } from "../../../../../src/lib/di";
import { requireSession } from "../../../../../src/lib/ownership";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const existing = await getProfileRepository().findById(id, guard.user.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await getProfileRepository().setActive(id, guard.user.id);
  return NextResponse.json({ ok: true });
}
