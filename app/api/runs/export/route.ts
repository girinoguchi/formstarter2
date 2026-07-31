import { NextRequest, NextResponse } from "next/server";

import { getCsvExportService } from "../../../../src/lib/di";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const profileId = searchParams.get("profileId") ?? undefined;
  const failedOnly = searchParams.get("failedOnly") === "1";

  const csv = await getCsvExportService().exportRunsAsCsv({ profileId, failedOnly });
  // ExcelでUTF-8の日本語が文字化けしないようBOMを付与する
  const body = "﻿" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${failedOnly ? "failed-runs" : "runs-export"}.csv"`,
    },
  });
}
