import { NextResponse } from "next/server";

import { getRunOrchestrator } from "../../../../../src/lib/di";
import { requireOwnedTarget, requireSession } from "../../../../../src/lib/ownership";

/**
 * target.contactPageUrl が未確定（＝まだ探索していない、または探索が
 * 見つけられなかった）なら探索（EXPLORE・可視タブなし）から、既に確定済み
 * （READY・またはFILLで一度READYまで到達済み）なら入力（FILL・可視タブあり）から
 * 再開する。ボタン側は「実行」「再実行」の区別のみでよく、内部でどちらのフェーズかを判定する。
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  const { id } = await params;

  const target = await requireOwnedTarget(id, guard.user.id);
  if (!target) {
    return NextResponse.json({ error: "target not found" }, { status: 404 });
  }

  try {
    const run = target.contactPageUrl
      ? await getRunOrchestrator().execute(id)
      : await getRunOrchestrator().explore(id);
    return NextResponse.json({ runId: run.id }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to start run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
