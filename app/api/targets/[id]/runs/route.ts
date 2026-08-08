import { NextResponse } from "next/server";

import { getRunRepository } from "../../../../../src/lib/di";
import { requireOwnedTarget, requireSession } from "../../../../../src/lib/ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const target = await requireOwnedTarget(id, guard.user.id);
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const runs = await getRunRepository().listByTarget(id);
  return NextResponse.json({ runs });
}
