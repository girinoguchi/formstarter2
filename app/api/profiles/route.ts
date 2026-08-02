import { NextRequest, NextResponse } from "next/server";

import { getProfileRepository } from "../../../src/lib/di";
import { requireSession } from "../../../src/lib/ownership";

export async function GET() {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const profiles = await getProfileRepository().list(guard.user.id);
  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await getProfileRepository().create(name, guard.user.id);
  return NextResponse.json({ profile }, { status: 201 });
}
