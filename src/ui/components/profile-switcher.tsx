"use client";

import { Check, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  useActivateProfile,
  useCreateProfile,
  useDeleteProfile,
  useProfileList,
  useRenameProfile,
  type ProfileSummary,
} from "../hooks/use-profiles";

export function ProfileSwitcher({
  activeId,
  onActiveChange,
}: {
  activeId: string | null;
  onActiveChange: (id: string) => void;
}) {
  const { data: profiles } = useProfileList();
  const activate = useActivateProfile();
  const create = useCreateProfile();
  const rename = useRenameProfile();
  const remove = useDeleteProfile();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const active: ProfileSummary | undefined = profiles?.find((p) => p.id === activeId);

  async function handleActivate(id: string) {
    await activate.mutateAsync(id);
    onActiveChange(id);
  }

  async function handleCreate() {
    if (!nameInput.trim()) return;
    const body = await create.mutateAsync(nameInput.trim());
    setCreateOpen(false);
    setNameInput("");
    onActiveChange(body.profile.id);
    await activate.mutateAsync(body.profile.id);
  }

  async function handleRename() {
    if (!activeId || !nameInput.trim()) return;
    await rename.mutateAsync({ id: activeId, name: nameInput.trim() });
    setRenameOpen(false);
  }

  async function handleDelete() {
    if (!activeId) return;
    await remove.mutateAsync(activeId);
    setDeleteOpen(false);
    const remaining = profiles?.filter((p) => p.id !== activeId) ?? [];
    if (remaining.length > 0) onActiveChange(remaining[0].id);
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex max-w-xs items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50">
          <span className="truncate">{active?.name ?? "プロジェクトなし"}</span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          {profiles?.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => handleActivate(p.id)} className="gap-2">
              {p.isActive ? <Check size={14} className="text-primary" /> : <span className="w-3.5" />}
              <span className="truncate">{p.name}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setNameInput("");
              setCreateOpen(true);
            }}
            className="gap-2 text-primary"
          >
            <Plus size={14} />
            新規プロジェクト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={!active}
          onClick={() => {
            setNameInput(active?.name ?? "");
            setRenameOpen(true);
          }}
          className="gap-1.5 rounded-lg text-gray-500 hover:text-gray-700"
        >
          <Pencil size={14} />
          名前を変更
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!active}
          onClick={() => setDeleteOpen(true)}
          className="gap-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={14} />
          削除
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新規プロジェクト</DialogTitle>
            <DialogDescription>新しいプロジェクト名を入力してください。</DialogDescription>
          </DialogHeader>
          <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="プロジェクト名" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={!nameInput.trim() || create.isPending}>
              作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>名前を変更</DialogTitle>
          </DialogHeader>
          <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="プロジェクト名" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleRename} disabled={!nameInput.trim() || rename.isPending}>
              変更する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>プロジェクトを削除</DialogTitle>
            <DialogDescription className="space-y-1 pt-1">
              <span className="block text-destructive/90">
                「{active?.name}」を削除します。この操作は取り消せません。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
