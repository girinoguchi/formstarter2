"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAdminUsers } from "../hooks/use-admin-users";
import {
  useAddProfileMember,
  useProfileMembers,
  useRemoveProfileMember,
} from "../hooks/use-profiles";

/**
 * このプロジェクトを使える作業者の割り当て。作業者は送信内容を編集できず、
 * 割り当てられたプロジェクトを「リスト設定・送信実行」で選んで使うだけになる。
 */
export function ProfileMembers({ profileId }: { profileId: string }) {
  const { data: members } = useProfileMembers(profileId);
  const { data: users } = useAdminUsers();
  const addMember = useAddProfileMember(profileId);
  const removeMember = useRemoveProfileMember(profileId);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(members?.map((m) => m.userId) ?? []);
  const candidates = users?.filter((u) => !assignedIds.has(u.id)) ?? [];

  async function handleAdd() {
    if (!selectedUserId) return;
    setError(null);
    try {
      await addMember.mutateAsync(selectedUserId);
      setSelectedUserId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await removeMember.mutateAsync(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解除に失敗しました");
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">このプロジェクトを使える人</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          割り当てた作業者は、この送信内容を使ってフォーム送信できます。送信内容の編集はできません。
        </p>
      </div>

      <ul className="space-y-2">
        {members?.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm text-foreground">{member.username}</span>
              <Badge variant={member.isAdmin ? "default" : "secondary"}>
                {member.isAdmin ? "管理者" : "作業者"}
              </Badge>
            </span>
            {member.isAdmin ? (
              // 作成者を外すと誰も送信内容を編集できなくなるため、管理者は解除させない。
              <span className="shrink-0 text-xs text-muted-foreground">作成者</span>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(member.userId)}
                disabled={removeMember.isPending}
                className="shrink-0 gap-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <UserMinus size={14} />
                解除
              </Button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder={candidates.length > 0 ? "ユーザーを選択" : "追加できる人がいません"} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.username}
                {user.isAdmin ? "（管理者）" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!selectedUserId || addMember.isPending} className="gap-1.5">
          <UserPlus size={14} />
          割り当てる
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </Card>
  );
}
