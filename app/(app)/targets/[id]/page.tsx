"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { RunErrorPanel } from "../../../../src/ui/components/run-error-panel";
import { RunLogViewer } from "../../../../src/ui/components/run-log-viewer";
import { RunStatusBadge } from "../../../../src/ui/components/run-status-badge";
import { ScreenshotGallery } from "../../../../src/ui/components/screenshot-gallery";
import { useTarget } from "../../../../src/ui/hooks/use-targets";
import { useRunStatus, useTargetRuns } from "../../../../src/ui/hooks/use-run-status";
import { statusLabel } from "../../../../src/ui/lib/status-labels";

export default function TargetDetailPage() {
  const params = useParams<{ id: string }>();
  const targetId = params.id;

  const { data: target, isLoading, refetch: refetchTarget } = useTarget(targetId);
  const { data: runHistory } = useTargetRuns(targetId);
  const [runId, setRunId] = useState<string | null>(null);
  const { data: run, isFetching: isRunFetching } = useRunStatus(runId);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 過去にこのターゲットを実行したことがあれば、最新Runを自動表示する
  // （このセッションで「実行」を押した場合を除く——押した場合はそちらを優先）。
  useEffect(() => {
    if (runId === null && runHistory && runHistory.length > 0) {
      setRunId(runHistory[0].id);
    }
  }, [runId, runHistory]);

  async function handleRun() {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/targets/${targetId}/run`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "実行開始に失敗しました");
      setRunId(body.runId);
      refetchTarget();
    } catch (e) {
      setError(e instanceof Error ? e.message : "実行開始に失敗しました");
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) return <p className="px-6 py-10 text-sm text-muted-foreground">読み込み中...</p>;
  if (!target) return <p className="px-6 py-10 text-sm text-destructive">ターゲットが見つかりません</p>;

  const isRunActive = run != null && run.finishedAt === null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">{target.companyName ?? target.url}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{target.url}</p>

      <div className="mb-6 flex items-center gap-3">
        <RunStatusBadge status={run?.status ?? target.status} />
        <Button onClick={handleRun} disabled={isStarting || isRunActive}>
          {isStarting || isRunActive ? "実行中..." : "実行"}
        </Button>
        {isRunFetching && isRunActive && <span className="text-xs text-muted-foreground">更新中...</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {runHistory && runHistory.length > 1 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">実行履歴</h2>
          <ul className="flex flex-wrap gap-2">
            {runHistory.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setRunId(r.id)}
                  className={cn(
                    "rounded border px-2 py-1 text-xs",
                    r.id === runId ? "border-primary bg-primary/10" : "border-border",
                  )}
                >
                  {new Date(r.createdAt).toLocaleString("ja-JP")}（{statusLabel(r.status)}）
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {run && (
        <>
          <RunErrorPanel run={run} />

          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">スクリーンショット</h2>
            <ScreenshotGallery screenshots={run.screenshots} />
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">ログ</h2>
            <RunLogViewer logs={run.logs} />
          </section>
        </>
      )}
    </div>
  );
}
