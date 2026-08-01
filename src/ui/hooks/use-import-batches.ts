"use client";

import { useQuery } from "@tanstack/react-query";

export interface ImportBatchListItem {
  id: string;
  fileName: string;
  importedAt: string;
  targetCount: number;
}

async function fetchImportBatches(profileId: string): Promise<ImportBatchListItem[]> {
  const res = await fetch(`/api/import-batches?profileId=${encodeURIComponent(profileId)}`);
  if (!res.ok) throw new Error("取り込んだCSV一覧の取得に失敗しました");
  const body = (await res.json()) as { batches: ImportBatchListItem[] };
  return body.batches;
}

export function useImportBatches(profileId: string | null) {
  return useQuery({
    queryKey: ["import-batches", profileId],
    queryFn: () => fetchImportBatches(profileId as string),
    enabled: profileId !== null,
  });
}
