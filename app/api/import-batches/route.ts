import { NextRequest, NextResponse } from "next/server";

import { getTargetRepository } from "../../../src/lib/di";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const batches = await getTargetRepository().listImportBatches(profileId);
  return NextResponse.json({ batches });
}
