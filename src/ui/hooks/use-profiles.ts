"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ProfileSummary {
  id: string;
  name: string;
  /** 自分が今選んでいるプロジェクトか（ユーザーごとの状態）。 */
  isActive: boolean;
  /** 自分が作成したものか。falseなら管理者に割り当てられて使っているだけ。 */
  isOwner: boolean;
}

export interface ProfileMember {
  userId: string;
  username: string;
  isAdmin: boolean;
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

/** このプロジェクトを使えるユーザー。作成者のみ取得・変更できる。 */
export function useProfileMembers(profileId: string | null) {
  return useQuery({
    queryKey: ["profiles", profileId, "members"],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<ProfileMember[]> => {
      const res = await fetch(`/api/profiles/${profileId}/members`);
      if (!res.ok) throw new Error("割り当ての取得に失敗しました");
      const body = (await res.json()) as { members: ProfileMember[] };
      return body.members;
    },
  });
}

export function useAddProfileMember(profileId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/profiles/${profileId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "追加に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles", profileId, "members"] }),
  });
}

export function useRemoveProfileMember(profileId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(
        `/api/profiles/${profileId}/members?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "解除に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles", profileId, "members"] }),
  });
}
