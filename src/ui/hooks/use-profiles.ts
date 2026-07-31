"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProfileSummary {
  id: string;
  name: string;
  isActive: boolean;
}

async function fetchProfiles(): Promise<ProfileSummary[]> {
  const res = await fetch("/api/profiles");
  if (!res.ok) throw new Error("プロファイル一覧の取得に失敗しました");
  const body = (await res.json()) as { profiles: ProfileSummary[] };
  return body.profiles;
}

export function useProfileList() {
  return useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("作成に失敗しました");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function useRenameProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("名前の変更に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}

export function useActivateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/profiles/${id}/activate`, { method: "POST" });
      if (!res.ok) throw new Error("切り替えに失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });
}
