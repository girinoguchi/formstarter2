import { NextRequest, NextResponse } from "next/server";

import { getRunOrchestrator, getRunRepository, getTargetRepository } from "../../../../src/lib/di";

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

  // Target.statusはタブが開いている間もREADYのままのため（「送信待ち」の誤解を招く表示を
  // 避けるための設計）、READY一覧には既にタブが開いているターゲットも混ざる。事前に除外
  // しないと、たまたま先頭に並んでいるものが全部既に開いていた場合、バッチ全体が重複防止
  // ガードで弾かれて0件になってしまう実バグがあった。
  const openTabTargetIds = new Set(await getRunRepository().listTargetIdsWithOpenTab());
  const freshTargets = readyTargets.filter((t) => !openTabTargetIds.has(t.id));
  const targetIds = freshTargets.slice(0, count).map((t) => t.id);

  const orchestrator = getRunOrchestrator();
  let opened = 0;
  for (const targetId of targetIds) {
    try {
      // execute()はRun行の作成までしか待たない（fire-and-forget）ため、
      // ここでのawaitは新規タブの起動に軽い間隔を持たせる程度の意味しかない。
      await orchestrator.execute(targetId);
      opened += 1;
    } catch (error) {
      // 上で事前除外しているため通常ここには来ないが、念のため1件の失敗で
      // バッチ全体を止めないようにする。
      console.error(`[open-batch] failed to open target ${targetId}:`, error);
    }
  }

  return NextResponse.json({ opened, available: freshTargets.length });
}
