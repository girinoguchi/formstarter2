import { NextRequest, NextResponse } from "next/server";

import { getExplorePool, getTargetRepository } from "../../../src/lib/di";
import type { TargetStatus } from "../../../src/domain/value-objects/run-status";
import { TARGET_STATUSES } from "../../../src/domain/value-objects/run-status";
import { requireOwnedProfile, requireSession } from "../../../src/lib/ownership";

export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("profileId");
  const statusParam = searchParams.get("status");
  const search = searchParams.get("search") ?? undefined;

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireOwnedProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const status =
    statusParam && (TARGET_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as TargetStatus)
      : undefined;

  const targets = await getTargetRepository().list({ profileId, status, search });
  return NextResponse.json({ targets });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const profileId = typeof body.profileId === "string" ? body.profileId : "";

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireOwnedProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : null;
  const [target] = await getTargetRepository().createMany([{ url, companyName, profileId }]);

  if (target) getExplorePool().enqueueMany([target.id]);

  return NextResponse.json({ target }, { status: 201 });
}
