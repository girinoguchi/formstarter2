import { NextRequest, NextResponse } from "next/server";

import { getListSearchService } from "../../../src/lib/di";
import { requireSession } from "../../../src/lib/ownership";

/** キーワードから企業サイトの一覧を作る。結果はCSVとして持ち帰る想定で、保存はしない。 */
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
  const keyword = typeof body.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword) {
    return NextResponse.json({ error: "検索キーワードを入力してください" }, { status: 400 });
  }

  const results = await service.searchByKeyword(keyword);
  return NextResponse.json({ results, total: results.length });
}
