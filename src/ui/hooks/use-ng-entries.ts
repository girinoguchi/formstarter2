"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface NgEntry {
  id: string;
  value: string;
  createdAt: string;
}

export interface NgEntryPage {
  items: NgEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export function useNgEntries({
  search,
  page,
  pageSize,
}: {
  search: string;
  page: number;
  pageSize: number;
}) {
  return useQuery({
    queryKey: ["ng-entries", search, page, pageSize],
    queryFn: async (): Promise<NgEntryPage> => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set("q", search);
      const res = await fetch(`/api/ng-entries?${params.toString()}`);
      if (!res.ok) throw new Error("NGリストの取得に失敗しました");
      return res.json();
    },
  });
}

export function useAddNgEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const res = await fetch("/api/ng-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "追加に失敗しました");
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ng-entries"] }),
  });
}

export function useDeleteNgEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/ng-entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "削除に失敗しました");
      return body as { removed: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ng-entries"] }),
  });
}

export function useImportNgEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ng-entries/import", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "取込に失敗しました");
      return body as { addedCount: number; duplicateCount: number; skippedLineCount: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ng-entries"] }),
  });
}
