import { NextRequest, NextResponse } from "next/server";

import { getRunOrchestrator, getTargetRepository } from "../../../../src/lib/di";

/**
 * 「送信可能」になっているターゲットのうち、指定件数だけをheadedタブで開く。
 * 1000件あっても指定した件数だけしか開かないようにする——「全件開く」を
 * 一度撤去したのは無制限にタブが増える体験を避けるためだったが、件数を
 * 明示的に指定できるなら同じ問題は起きないため、上限付きで復活させる。
 * 開くタブは全ターゲットで共有しているheadedブラウザの新しいタブ
 * （PlaywrightSessionManager）——新しいウィンドウにはならない。
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  const count = Number(body.count);

  if (!profileId) {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 });
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return NextResponse.json({ error: "件数は1〜50の整数で指定してください" }, { status: 400 });
  }

  const readyTargets = await getTargetRepository().list({ profileId, status: "READY" });
  const targetIds = readyTargets.slice(0, count).map((t) => t.id);

  const orchestrator = getRunOrchestrator();
  for (const targetId of targetIds) {
    // execute()はRun行の作成までしか待たない（fire-and-forget）ため、
    // ここでのawaitは新規タブの起動に軽い間隔を持たせる程度の意味しかない。
    await orchestrator.execute(targetId);
  }

  return NextResponse.json({ opened: targetIds.length, available: readyTargets.length });
}
