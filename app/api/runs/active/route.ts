import { NextRequest, NextResponse } from "next/server";

import { getRunOrchestrator, getRunRepository } from "../../../../src/lib/di";
import type { RunKind } from "../../../../src/domain/value-objects/run-kind";

// UIの「開いているタブ」パネルがこのエンドポイントを2秒おきにポーリングしている
// ことに相乗りして、detach済みタブの生死・遷移の追跡（reconcileOpenTabs）も
// ここで行う——別途タイマーを持たずに済ませるための意図的な選択。
export async function GET(request: NextRequest) {
  const profileId = request.nextUrl.searchParams.get("profileId") ?? undefined;
  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind = kindParam === "EXPLORE" || kindParam === "FILL" ? (kindParam as RunKind) : undefined;

  await getRunOrchestrator()
    .reconcileOpenTabs()
    .catch((error: unknown) => {
      console.error("[api/runs/active] reconcileOpenTabs failed:", error);
    });

  const runs = await getRunRepository().listActive({ profileId, kind });
  return NextResponse.json({ runs });
}
