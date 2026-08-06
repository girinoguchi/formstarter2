import { NextRequest, NextResponse } from "next/server";

import { getCsvExportService } from "../../../../src/lib/di";
import { requireAccessibleProfile, requireSession } from "../../../../src/lib/ownership";

export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("profileId");
  const failedOnly = searchParams.get("failedOnly") === "1";

  // profileId省略で全ユーザー分がエクスポートできてしまう（アカウント分離の抜け穴）ため必須にする。
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireAccessibleProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const csv = await getCsvExportService().exportRunsAsCsv({ profileId, ownerId: guard.user.id, failedOnly });
  // ExcelでUTF-8の日本語が文字化けしないようBOMを付与する
  const body = "﻿" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${failedOnly ? "failed-runs" : "runs-export"}.csv"`,
    },
  });
}
