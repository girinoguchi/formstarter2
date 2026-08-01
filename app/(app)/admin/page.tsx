"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { useAuth } from "../../../src/ui/providers/auth-provider";
import {
  useAdminUsers,
  useCreateUser,
  useDeleteUser,
  useToggleUserAdmin,
} from "../../../src/ui/hooks/use-admin-users";

export default function AdminUsersPage() {
  const { id: currentUserId } = useAuth();
  const { data: users, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const toggleAdmin = useToggleUserAdmin();
  const deleteUser = useDeleteUser();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate() {
    setFormError(null);
    try {
      await createUser.mutateAsync({ username: username.trim(), password, isAdmin });
      setUsername("");
      setPassword("");
      setIsAdmin(false);
      setIsDialogOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "作成に失敗しました");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除します。よろしいですか？`)) return;
    await deleteUser.mutateAsync(id);
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ユーザー管理</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>ユーザーを追加</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ユーザーを追加</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">ユーザー名</Label>
                <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">パスワード（6文字以上）</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="new-isadmin" checked={isAdmin} onCheckedChange={(v) => setIsAdmin(v === true)} />
                <Label htmlFor="new-isadmin" className="font-normal">
                  管理者権限を付与する
                </Label>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!username.trim() || password.length < 6 || createUser.isPending}
              >
                {createUser.isPending ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">読み込み中...</p>}
          {users && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ユーザー名</TableHead>
                  <TableHead>管理者</TableHead>
                  <TableHead>作成日時</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      {user.username}
                      {user.id === currentUserId && <span className="ml-1 text-xs text-muted-foreground">（自分）</span>}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={user.isAdmin}
                        disabled={user.id === currentUserId || toggleAdmin.isPending}
                        onCheckedChange={(v) =>
                          toggleAdmin.mutate({ id: user.id, isAdmin: v === true })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.createdAt).toLocaleString("ja-JP")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={user.id === currentUserId || deleteUser.isPending}
                        onClick={() => handleDelete(user.id, user.username)}
                      >
                        削除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
