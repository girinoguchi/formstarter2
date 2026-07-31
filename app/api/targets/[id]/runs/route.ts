import { NextResponse } from "next/server";

import { getRunRepository } from "../../../../../src/lib/di";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runs = await getRunRepository().listByTarget(id);
  return NextResponse.json({ runs });
}
