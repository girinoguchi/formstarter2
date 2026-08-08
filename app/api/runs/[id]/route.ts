import { NextResponse } from "next/server";

import { getRunRepository } from "../../../../src/lib/di";
import { requireOwnedRun, requireSession } from "../../../../src/lib/ownership";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  const owned = await requireOwnedRun(id, guard.user.id);
  if (!owned) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const run = await getRunRepository().findDetailById(id);
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ run });
}
