import { NextRequest, NextResponse } from "next/server";

import { getTargetRepository } from "../../../../src/lib/di";
import { requireAccessibleProfile, requireSession } from "../../../../src/lib/ownership";

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const profileId = typeof body.profileId === "string" ? body.profileId : "";

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireAccessibleProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await getTargetRepository().removeAllForProfile(profileId, guard.user.id);
  return NextResponse.json({ ok: true });
}
