import { NextRequest, NextResponse } from "next/server";

import { getTargetRepository } from "../../../../src/lib/di";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const profileId = typeof body.profileId === "string" ? body.profileId : "";

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  await getTargetRepository().removeAllForProfile(profileId);
  return NextResponse.json({ ok: true });
}
