import { NextRequest, NextResponse } from "next/server";

import { parseCsvNgValues } from "../../../../src/infrastructure/csv/csv-ng-parser";
import { getNgEntryRepository } from "../../../../src/lib/di";
import { requireSession } from "../../../../src/lib/ownership";

/** NGリストのCSV一括取込。ターゲットCSVと違い既存を消さず、追加のみ行う。 */
export async function POST(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const { values, skippedLineCount } = parseCsvNgValues(await file.text());
  const addedCount = await getNgEntryRepository().addMany(guard.user.id, values);

  return NextResponse.json({
    addedCount,
    // 既に登録済み・CSV内で重複していた分。取り込んだのに増えない理由を画面で説明するため返す。
    duplicateCount: values.length - addedCount,
    skippedLineCount,
  });
}
