"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { TargetStatus } from "../../domain/value-objects/run-status";

export interface TargetListItem {
  id: string;
  url: string;
  companyName: string | null;
  status: TargetStatus;
  contactPageUrl: string | null;
  profileId: string;
  createdAt: string;
  updatedAt: string;
}

interface UseTargetsOptions {
  profileId: string | null;
  status?: TargetStatus;
  search?: string;
}

async function fetchTargets(options: UseTargetsOptions): Promise<TargetListItem[]> {
  const params = new URLSearchParams();
  params.set("profileId", options.profileId as string);
  if (options.status) params.set("status", options.status);
  if (options.search) params.set("search", options.search);

  const res = await fetch(`/api/targets?${params.toString()}`);
  if (!res.ok) throw new Error("ターゲット一覧の取得に失敗しました");
  const body = (await res.json()) as { targets: TargetListItem[] };
  return body.targets;
}

export function useTargets(options: UseTargetsOptions) {
  return useQuery({
    queryKey: ["targets", options],
    queryFn: () => fetchTargets(options),
    enabled: options.profileId !== null,
  });
}

async function fetchTarget(id: string): Promise<TargetListItem> {
  const res = await fetch(`/api/targets/${id}`);
  if (!res.ok) throw new Error("ターゲットの取得に失敗しました");
  const body = (await res.json()) as { target: TargetListItem };
  return body.target;
}

export function useTarget(id: string) {
  return useQuery({
    queryKey: ["target", id],
    queryFn: () => fetchTarget(id),
  });
}

async function importCsv({
  file,
  profileId,
}: {
  file: File;
  profileId: string;
}): Promise<{ importedCount: number; skippedLineCount: number }> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("profileId", profileId);

  const res = await fetch("/api/targets/import", { method: "POST", body: formData });
  if (!res.ok) throw new Error("CSVインポートに失敗しました");
  return res.json();
}

export function useImportCsv() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importCsv,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}

async function addSingleTarget({ url, profileId }: { url: string; profileId: string }) {
  const res = await fetch("/api/targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, profileId }),
  });
  if (!res.ok) throw new Error("追加に失敗しました");
  return res.json();
}

export function useAddTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addSingleTarget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}

async function resetTargets(profileId: string) {
  const res = await fetch("/api/targets/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileId }),
  });
  if (!res.ok) throw new Error("リセットに失敗しました");
  return res.json();
}

export function useResetTargets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetTargets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
  });
}
