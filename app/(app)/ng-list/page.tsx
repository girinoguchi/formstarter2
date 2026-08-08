"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  useAddNgEntry,
  useDeleteNgEntries,
  useImportNgEntries,
  useNgEntries,
} from "../../../src/ui/hooks/use-ng-entries";

const PAGE_SIZE = 50;

export default function NgListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNgEntries({ search, page, pageSize: PAGE_SIZE });

  const [newValue, setNewValue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEntry = useAddNgEntry();
  const deleteEntries = useDeleteNgEntries();
  const importEntries = useImportNgEntries();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetToFirstPage(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function handleAdd() {
    const value = newValue.trim();
    if (!value) return;
    setMessage(null);
    try {
      await addEntry.mutateAsync(value);
      setNewValue("");
      setMessage(`「${value}」を追加しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "追加に失敗しました");
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setMessage(null);
    try {
      const { removed } = await deleteEntries.mutateAsync([...selected]);
      setSelected(new Set());
      setMessage(`${removed}件削除しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleImport(file: File) {
    setMessage(null);
    try {
      const { addedCount, duplicateCount, skippedLineCount } = await importEntries.mutateAsync(file);
      setMessage(
        `${addedCount}件追加しました` +
          (duplicateCount > 0 ? `（重複${duplicateCount}件は除外）` : "") +
          (skippedLineCount > 0 ? `（${skippedLineCount}行スキップ）` : ""),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "取込に失敗しました");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = items.length > 0 && items.every((e) => selected.has(e.id));

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">NGリスト</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        ここに登録したドメイン・URLは、リストに追加しても自動で「ブロック済み」になり、探索も送信もされません。
        全プロジェクトに共通で効きます。
      </p>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold">追加</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="example.com または https://example.com/contact"
              className="max-w-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={!newValue.trim() || addEntry.isPending}>
              追加
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importEntries.isPending}
            >
              {importEntries.isPending ? "取込中..." : "CSVで一括取込"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ドメインだけの登録で、その配下のURLもまとめて止まります（例: example.com →
            https://www.example.com/contact もブロック）。CSVは1行1件、1列目のみ読みます。既存のNGリストは消えず、追加のみ行います。
          </p>
          {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </CardContent>
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">
          登録済み <span className="text-sm font-normal text-muted-foreground">{total}件</span>
        </h2>
        <div className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="ドメイン・URLで検索"
            value={search}
            onChange={(e) => resetToFirstPage(e.target.value)}
            className="w-56"
          />
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={handleDeleteSelected}
            disabled={selected.size === 0 || deleteEntries.isPending}
          >
            選択した{selected.size}件を削除
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {search ? "該当する登録はありません。" : "まだ登録がありません。"}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={(checked) => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const e of items) {
                        if (checked === true) next.add(e.id);
                        else next.delete(e.id);
                      }
                      return next;
                    });
                  }}
                />
              </TableHead>
              <TableHead>ドメイン・URL</TableHead>
              <TableHead className="w-44">登録日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Checkbox checked={selected.has(entry.id)} onCheckedChange={() => toggle(entry.id)} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-normal">
                    {entry.value}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {new Date(entry.createdAt).toLocaleString("ja-JP")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive size="default" className="pointer-events-none">
                  {page} / {totalPages}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
