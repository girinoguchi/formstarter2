import { NextRequest, NextResponse } from "next/server";

import { getTargetRepository } from "../../../src/lib/di";
import { requireAccessibleProfile, requireSession } from "../../../src/lib/ownership";

export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const profileId = request.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireAccessibleProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const batches = await getTargetRepository().listImportBatches(profileId, guard.user.id);
  return NextResponse.json({ batches });
}
