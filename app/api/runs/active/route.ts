import { NextRequest, NextResponse } from "next/server";

import { getRunOrchestrator, getRunRepository } from "../../../../src/lib/di";
import type { RunKind } from "../../../../src/domain/value-objects/run-kind";
import { requireOwnedProfile, requireSession } from "../../../../src/lib/ownership";

// UIの「開いているタブ」パネルがこのエンドポイントを2秒おきにポーリングしている
// ことに相乗りして、detach済みタブの生死・遷移の追跡（reconcileOpenTabs）も
// ここで行う——別途タイマーを持たずに済ませるための意図的な選択。
export async function GET(request: NextRequest) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const profileId = request.nextUrl.searchParams.get("profileId");
  const kindParam = request.nextUrl.searchParams.get("kind");
  const kind = kindParam === "EXPLORE" || kindParam === "FILL" ? (kindParam as RunKind) : undefined;

  // profileId省略で全ユーザー分の実行中Runが見えてしまう（アカウント分離の抜け穴）ため必須にする。
  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!(await requireOwnedProfile(profileId, guard.user.id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await getRunOrchestrator()
    .reconcileOpenTabs(guard.user.id)
    .catch((error: unknown) => {
      console.error("[api/runs/active] reconcileOpenTabs failed:", error);
    });

  const runs = await getRunRepository().listActive({ profileId, ownerId: guard.user.id, kind });
  return NextResponse.json({ runs });
}
