import { NextRequest, NextResponse } from "next/server";

import { getRunRepository } from "../../../../src/lib/di";
import type { RunKind } from "../../../../src/domain/value-objects/run-kind";

export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId") ?? undefined;
  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind = kindParam === "EXPLORE" || kindParam === "FILL" ? (kindParam as RunKind) : undefined;
  const runs = await getRunRepository().listActive({ profileId, kind });
  return NextResponse.json({ runs });
}
