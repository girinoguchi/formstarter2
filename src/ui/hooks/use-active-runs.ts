"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

async function markSent(runId: string) {
  const res = await fetch(`/api/runs/${runId}/mark-sent`, { method: "POST" });
  if (!res.ok) throw new Error("送信済みへの更新に失敗しました");
  return res.json();
}

/**
 * 確認画面到達後はCDP接続をdetachしており自動検知ができないため、人間が実際に
 * 送信ボタンを押したことをこのボタン経由で能動的に伝える運用にしている。
 */
export function useMarkSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markSent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs", "active"] });
      queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}
