import { NextRequest, NextResponse } from "next/server";

import { MAX_COMPANY_NAMES } from "../../../../src/application/list-search";
import { getListSearchService } from "../../../../src/lib/di";
import { requireSession } from "../../../../src/lib/ownership";

/** 企業名の件数が多いと時間がかかるため、実行時間の上限を延ばす。 */
export const maxDuration = 300;

/** 企業名の一覧から、それぞれの公式サイトURLを引く。 */
export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const service = getListSearchService();
  if (!service) {
    return NextResponse.json(
      { error: "SERPER_API_KEY が設定されていないため、リスト検索は利用できません" },
      { status: 503 },
    );
  }

  const body = await request.json();
  const names = Array.isArray(body.names)
    ? body.names.filter((v: unknown): v is string => typeof v === "string" && v.trim() !== "")
    : [];

  if (names.length === 0) {
    return NextResponse.json({ error: "企業名が読み取れませんでした" }, { status: 400 });
  }

  const results = await service.resolveCompanyUrls(names.map((n: string) => n.trim()));
  return NextResponse.json({
    results,
    // 上限を超えた分は処理していないことを画面で伝えるために返す。
    skippedCount: Math.max(0, names.length - MAX_COMPANY_NAMES),
  });
}
