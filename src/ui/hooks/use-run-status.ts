"use client";

import { useQuery } from "@tanstack/react-query";

import type { LogLevel } from "../../domain/value-objects/log-level";
import type { RunStatus } from "../../domain/value-objects/run-status";
import type { ScreenshotStage } from "../../domain/value-objects/screenshot-stage";

export interface RunDetailDto {
  id: string;
  targetId: string;
  status: RunStatus;
  errorStep: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  screenshots: readonly { id: string; stage: ScreenshotStage; filePath: string; createdAt: string }[];
  logs: readonly { id: string; level: LogLevel; step: string; message: string; createdAt: string }[];
}

async function fetchRun(runId: string): Promise<RunDetailDto> {
  const res = await fetch(`/api/runs/${runId}`);
  if (!res.ok) throw new Error("実行状況の取得に失敗しました");
  const body = (await res.json()) as { run: RunDetailDto };
  return body.run;
}

export interface RunSummaryDto {
  id: string;
  status: RunStatus;
  createdAt: string;
  finishedAt: string | null;
}

async function fetchTargetRuns(targetId: string): Promise<RunSummaryDto[]> {
  const res = await fetch(`/api/targets/${targetId}/runs`);
  if (!res.ok) throw new Error("実行履歴の取得に失敗しました");
  const body = (await res.json()) as { runs: RunSummaryDto[] };
  return body.runs;
}

/** そのターゲットの実行履歴（新しい順）。詳細ページで最新Runを自動選択するのに使う。 */
export function useTargetRuns(targetId: string) {
  return useQuery({
    queryKey: ["targetRuns", targetId],
    queryFn: () => fetchTargetRuns(targetId),
  });
}

export function useRunStatus(runId: string | null) {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchRun(runId as string),
    enabled: runId !== null,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (!run) return 1500;
      return run.finishedAt === null ? 1500 : false;
    },
  });
}
