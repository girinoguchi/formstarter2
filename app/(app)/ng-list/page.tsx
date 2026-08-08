"use client";

import { useRef, useState } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import {
  useAddNgEntry,
  useDeleteNgEntries,
  useImportNgEntries,
  useNgEntries,
} from "../../../src/ui/hooks/use-ng-entries";

const PAGE_SIZE = 50;

type Tab = "register" | "list";

export default function NgListPage() {
  const [tab, setTab] = useState<Tab>("register");
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

  async function handleAdd() {
    const value = newValue.trim();
    if (!value) return;
    setMessage(null);
    try {
      await addEntry.mutateAsync(value);
      setNewValue("");
      setMessage(`「${value}」を登録しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "登録に失敗しました");
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
        `${addedCount}件登録しました` +
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
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="mb-6 text-xl font-bold text-gray-800">NGリスト</h1>

        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <div className="flex border-b border-border">
            {(["register", "list"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "border-b-2 px-6 py-3.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700",
                )}
              >
                {t === "register" ? "NGリストの登録" : `登録中のNGリスト（${total}件）`}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === "register" ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">URLまたはドメインを入力</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="example.com または https://example.com"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      className="max-w-sm"
                    />
                    <Button onClick={handleAdd} disabled={!newValue.trim() || addEntry.isPending}>
                      NGリストへ登録
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ドメインだけの登録で、その配下のURLもまとめて止まります（例: example.com →
                    https://www.example.com/contact もブロック）。
                  </p>
                </div>

                <div className="space-y-2 border-t border-border pt-6">
                  <p className="text-sm font-medium text-gray-700">CSVで一括登録</p>
                  <p className="text-xs text-muted-foreground">
                    1行1件、1列目のドメイン・URLを読み取ります。既存のNGリストは消えず、追加のみ行います。
                  </p>
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
                    {importEntries.isPending ? "取込中..." : "CSVファイルを選択"}
                  </Button>
                </div>

                {message && <p className="text-xs text-muted-foreground">{message}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Input
                    type="search"
                    placeholder="ドメイン・URLで検索"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
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

                {message && <p className="text-xs text-muted-foreground">{message}</p>}

                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
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
                            <Checkbox
                              checked={selected.has(entry.id)}
                              onCheckedChange={() => toggle(entry.id)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{entry.value}</TableCell>
                          <TableCell className="text-xs text-muted-foreground tabular-nums">
                            {new Date(entry.createdAt).toLocaleString("ja-JP")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {totalPages > 1 && (
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
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="w-64 shrink-0 space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              ?
            </div>
            <span className="text-sm font-semibold text-gray-800">HELP</span>
          </div>
          <div className="space-y-2 text-xs leading-relaxed text-gray-600">
            <p>
              すでにお取引がある企業様や最近リード獲得された企業様をNGリストに登録しておくと事前にリスト被りを防げます。
            </p>
            <p>ここに登録したドメイン・URLは、リストに追加しても自動で「ブロック済み」になり、探索も送信もされません。</p>
            <p className="text-muted-foreground">
              判断は主にドメインで行っています。URLは正しく入力してください。
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-white p-5">
          <span className="text-sm font-semibold text-gray-800">お問い合わせ</span>
          <p className="text-xs leading-relaxed text-gray-600">
            ご不明点やご要望がございましたらお気軽にお問い合わせください。
          </p>
          <Link
            href="/contact"
            className="block rounded-lg bg-primary px-4 py-2 text-center text-xs font-medium text-white transition-colors hover:bg-primary/90"
          >
            お問い合わせフォームへ
          </Link>
        </div>
      </aside>
    </div>
  );
}
