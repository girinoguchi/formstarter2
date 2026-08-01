"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface AdminUser {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
}

async function fetchUsers(): Promise<AdminUser[]> {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("ユーザー一覧の取得に失敗しました");
  const body = (await res.json()) as { users: AdminUser[] };
  return body.users;
}

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: fetchUsers });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { username: string; password: string; isAdmin: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "作成に失敗しました");
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useToggleUserAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isAdmin }: { id: string; isAdmin: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "変更に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "削除に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
