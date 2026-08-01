import { NextResponse } from "next/server";

import { getRunRepository, getTargetRepository } from "../../../../../src/lib/di";

/**
 * 確認画面到達後はCDP接続をdetachしており（Cloudflare Turnstile等のBot対策回避のため）、
 * 送信完了ページへの自動遷移検知ができない。そのため人間が実際に送信ボタンを押したら
 * このAPIを呼んでもらい、Run/Targetを能動的にSENTへ進める。
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const run = await getRunRepository().findById(id);
  if (!run) {
    return NextResponse.json({ error: "run not found" }, { status: 404 });
  }

  await getRunRepository().markSent(id);
  await getRunRepository().markClosed(id);
  await getTargetRepository().updateStatus(run.targetId, "SENT");

  return NextResponse.json({ ok: true });
}
