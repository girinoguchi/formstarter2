import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../../src/lib/auth";
import { getTargetRepository } from "../../../../src/lib/di";

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const profileId = typeof body.profileId === "string" ? body.profileId : "";

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  await getTargetRepository().removeAllForProfile(profileId);
  return NextResponse.json({ ok: true });
}
