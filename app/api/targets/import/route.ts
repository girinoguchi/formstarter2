import { NextRequest, NextResponse } from "next/server";

import { getCsvImportService, getExplorePool } from "../../../../src/lib/di";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const profileId = formData.get("profileId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (typeof profileId !== "string" || !profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }

  const csvText = await file.text();
  const result = await getCsvImportService().importFromCsvText(file.name, csvText, profileId);

  // CSVを読み込んだ瞬間（インポート直後）に自動で全件を探索キューへ投入する（可視タブは開かない）。
  // 送信可能と確認できたものだけが「READY」になり、一覧の「入力」ボタンで開けるようになる。
  getExplorePool().enqueueMany(result.targets.map((t) => t.id));

  return NextResponse.json(result, { status: 201 });
}
