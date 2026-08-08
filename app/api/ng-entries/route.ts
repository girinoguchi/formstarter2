import { NextRequest, NextResponse } from "next/server";

import { getNgEntryRepository } from "../../../src/lib/di";
import { requireSession } from "../../../src/lib/ownership";

/** NGリスト（アカウント単位）。全プロジェクトの取り込み・送信に効く。 */
export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const params = request.nextUrl.searchParams;
  const search = (params.get("q") ?? "").trim();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, Number.parseInt(params.get("pageSize") ?? "50", 10) || 50),
  );

  const { items, total } = await getNgEntryRepository().list({
    ownerId: guard.user.id,
    search: search || undefined,
    page,
    pageSize,
  });

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (!value) {
    return NextResponse.json({ error: "ドメインまたはURLを入力してください" }, { status: 400 });
  }

  const created = await getNgEntryRepository().add(guard.user.id, value);
  if (!created) {
    return NextResponse.json({ error: "既に登録されています" }, { status: 409 });
  }
  return NextResponse.json({ entry: created }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const body = await request.json();
  const ids = Array.isArray(body.ids) ? body.ids.filter((v: unknown) => typeof v === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  const removed = await getNgEntryRepository().remove(guard.user.id, ids);
  return NextResponse.json({ removed });
}
