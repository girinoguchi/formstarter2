"use client";

import { useQuery } from "@tanstack/react-query";

import type { RunKind } from "../../domain/value-objects/run-kind";
import type { RunStatus } from "../../domain/value-objects/run-status";

export interface ActiveRunDto {
  id: string;
  targetId: string;
  targetUrl: string;
  targetCompanyName: string | null;
  status: RunStatus;
  windowLabel: string | null;
  finishedAt: string | null;
}

async function fetchActiveRuns(profileId: string | null, kind?: RunKind): Promise<ActiveRunDto[]> {
  const params = new URLSearchParams();
  if (profileId) params.set("profileId", profileId);
  if (kind) params.set("kind", kind);

  const res = await fetch(`/api/runs/active?${params.toString()}`);
  if (!res.ok) throw new Error("実行中一覧の取得に失敗しました");
  const body = (await res.json()) as { runs: ActiveRunDto[] };
  return body.runs;
}

/** kindを省略するとEXPLORE/FILL両方を返す。「開いているタブ」表示にはkind:"FILL"を渡すこと。 */
export function useActiveRuns(profileId: string | null, kind?: RunKind) {
  return useQuery({
    queryKey: ["runs", "active", profileId, kind],
    queryFn: () => fetchActiveRuns(profileId, kind),
    refetchInterval: 2000,
    enabled: profileId !== null,
  });
}
