import { NextResponse } from "next/server";

import { getProfileRepository } from "../../../../../src/lib/di";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getProfileRepository().setActive(id);
  return NextResponse.json({ ok: true });
}
