import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "../../../src/lib/auth";
import { getProfileRepository } from "../../../src/lib/di";

export async function GET() {
  const profiles = await getProfileRepository().list();
  return NextResponse.json({ profiles });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const profile = await getProfileRepository().create(name);
  return NextResponse.json({ profile }, { status: 201 });
}
