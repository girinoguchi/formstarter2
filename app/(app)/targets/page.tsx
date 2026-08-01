"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { TARGET_STATUSES, type TargetStatus } from "../../../src/domain/value-objects/run-status";
import { ActiveRunsPanel } from "../../../src/ui/components/active-runs-panel";
import { ExploringIndicator } from "../../../src/ui/components/exploring-indicator";
import { TargetImportForm } from "../../../src/ui/components/target-import-form";
import { TargetTable } from "../../../src/ui/components/target-table";
import { useImportBatches } from "../../../src/ui/hooks/use-import-batches";
import { useAddTarget, useResetTargets, useTargets } from "../../../src/ui/hooks/use-targets";
import { useActivateProfile, useProfileList } from "../../../src/ui/hooks/use-profiles";
import { statusLabel } from "../../../src/ui/lib/status-labels";
import { useAuth } from "../../../src/ui/providers/auth-provider";

const ALL_STATUSES_VALUE = "ALL";
const FAILED_LIKE_STATUSES = new Set(["FAILED", "NOT_SENDABLE", "BLOCKED"]);
const PAGE_SIZE = 50;

export default function TargetsPage() {
  const { isAdmin } = useAuth();
  const { data: profiles } = useProfileList();
  const [profileId, setProfileId] = useState<string | null>(null);
  const activateProfile = useActivateProfile();

  useEffect(() => {
    if (profileId === null && profiles && profiles.length > 0) {
      const active = profiles.find((p) => p.isActive) ?? profiles[0];
      if (active) setProfileId(active.id);
    }
  }, [profileId, profiles]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TargetStatus | "">("");
  const { data: targets, isLoading, isError } = useTargets({
    profileId,
    search: search || undefined,
    status: statusFilter || undefined,
  });
  // フォーム発見率は検索/ステータス絞り込みの影響を受けないプロジェクト全体の指標にしたいため、
  // 表示用の一覧とは別に絞り込み無しで取得する（絞り込み無しの場合は同一クエリとしてキャッシュ共有される）。
  const { data: allTargets } = useTargets({ profileId });

  const [page, setPage] = useState(1);
  const filterKey = `${profileId ?? ""}:${search}:${statusFilter}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }
  const totalPages = targets ? Math.max(1, Math.ceil(targets.length / PAGE_SIZE)) : 1;
  const currentPage = Math.min(page, totalPages);
  const pagedTargets = targets?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const [newUrl, setNewUrl] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const addTarget = useAddTarget();
  const resetTargets = useResetTargets();
  const { data: importBatches } = useImportBatches(profileId);

  const [openCount, setOpenCount] = useState("3");
  const [isOpeningBatch, setIsOpeningBatch] = useState(false);
  const [openBatchMessage, setOpenBatchMessage] = useState<string | null>(null);

  async function handleProfileChange(id: string) {
    setProfileId(id);
    await activateProfile.mutateAsync(id);
  }

  async function handleAddUrl() {
    if (!newUrl.trim() || !profileId) return;
    await addTarget.mutateAsync({ url: newUrl.trim(), profileId });
    setNewUrl("");
  }

  async function handleResetAll() {
    if (!profileId) return;
    if (!confirm("このプロジェクトの全ターゲット（実行履歴・スクリーンショットを含む）を削除します。よろしいですか？")) return;
    try {
      await resetTargets.mutateAsync(profileId);
      setImportMessage("全件削除しました");
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleOpenBatch() {
    if (!profileId) return;
    const count = Number(openCount);
    if (!Number.isInteger(count) || count < 1) return;

    setIsOpeningBatch(true);
    setOpenBatchMessage(null);
    try {
      const res = await fetch("/api/targets/open-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, count }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "開始に失敗しました");
      setOpenBatchMessage(
        body.opened === 0
          ? "送信可能な対象がありませんでした"
          : `${body.opened}件のタブを開きます（送信可能: ${body.available}件中）`,
      );
    } catch (e) {
      setOpenBatchMessage(e instanceof Error ? e.message : "開始に失敗しました");
    } finally {
      setIsOpeningBatch(false);
    }
  }

  const failedCount = targets?.filter((t) => FAILED_LIKE_STATUSES.has(t.status)).length ?? 0;

  // フォーム発見率＝送信可能なフォームが見つかった件数(contactPageUrlが確定した件数)/総件数。
  // ステータスだけで判定すると探索と入力どちらの失敗か曖昧になるため、EXPLOREで
  // フォームが見つかった時点で確定するcontactPageUrlの有無を直接の判定材料にする。
  const discoveredCount = allTargets?.filter((t) => t.contactPageUrl !== null).length ?? 0;
  const totalCount = allTargets?.length ?? 0;
  const discoveryRate = totalCount > 0 ? ((discoveredCount / totalCount) * 100).toFixed(1) : null;

  if (profiles && profiles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="mb-4 text-2xl font-semibold">リスト設定・送信実行</h1>
        <p className="text-sm text-muted-foreground">
          先に
          <Link href="/profile" className="mx-1 text-primary hover:underline">
            送信内容設定
          </Link>
          でプロジェクトを作成してください。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">リスト設定・送信実行</h1>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold">URL追加（追加先プロジェクトを選択）</h2>

          <Select value={profileId ?? undefined} onValueChange={handleProfileChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="プロジェクトを選択" />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com"
              className="max-w-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
            />
            <Button onClick={handleAddUrl} disabled={!newUrl.trim() || !profileId}>
              追加
            </Button>
            {profileId && (
              <TargetImportForm
                profileId={profileId}
                onImported={({ importedCount, skippedLineCount }) => {
                  setImportMessage(
                    `${importedCount}件インポートしました${skippedLineCount > 0 ? `（${skippedLineCount}行スキップ）` : ""}`,
                  );
                }}
              />
            )}
            {isAdmin && (
              <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={handleResetAll}>
                全件リセット
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            CSV: 1行1URL、またはカンマ・タブ区切り。UTF-8で保存。取込むと選択中のプロジェクトに追加されます。
          </p>
          {importMessage && <p className="text-xs text-muted-foreground">{importMessage}</p>}
          {importBatches && importBatches.length > 0 && (
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">取り込んだCSV</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{importBatches[0].fileName}</Badge>
                <span className="text-muted-foreground">{importBatches[0].targetCount}件</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardContent>
          <p className="mb-4 text-sm font-semibold text-primary">使い方</p>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <HowToStep n={1} title="URLを追加" desc="追加・CSV取込どちらでも" />
            <span className="text-muted-foreground">→</span>
            <HowToStep n={2} title="自動で探索" desc="ウィンドウは開かず裏で確認" />
            <span className="text-muted-foreground">→</span>
            <HowToStep
              n={3}
              title="「入力」を押す"
              desc="「送信可能」な行のみ。1件ずつでも「まとめて開く」で件数指定でも"
            />
            <span className="text-muted-foreground">→</span>
            <HowToStep n={4} title="送信" desc="開いたタブで内容確認して送信" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent>
          <p className="mb-3 text-sm font-semibold">まとめて開く</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">送信可能なものを</span>
            <Input
              type="number"
              min={1}
              max={50}
              value={openCount}
              onChange={(e) => setOpenCount(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">件だけタブで開く</span>
            <Button onClick={handleOpenBatch} disabled={isOpeningBatch || !profileId}>
              {isOpeningBatch ? "開いています..." : "開く"}
            </Button>
            {openBatchMessage && <span className="text-sm text-muted-foreground">{openBatchMessage}</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            指定した件数だけ、同じウィンドウ内にタブが開きます。大量にある場合も指定した件数以上は開きません。
          </p>
        </CardContent>
      </Card>

      {discoveryRate !== null && (
        <Card className="mb-6">
          <CardContent>
            <p className="text-xs text-muted-foreground">フォーム発見率（送信可能件数/総件数）</p>
            <p className="text-2xl font-semibold tabular-nums">{discoveryRate}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {discoveredCount}/{totalCount}件
            </p>
          </CardContent>
        </Card>
      )}

      <ExploringIndicator profileId={profileId} />
      <ActiveRunsPanel profileId={profileId} />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">一覧（プロジェクトごと）</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm whitespace-nowrap text-muted-foreground">表示フィルター</span>
          <Select
            value={statusFilter || ALL_STATUSES_VALUE}
            onValueChange={(value) => setStatusFilter(value === ALL_STATUSES_VALUE ? "" : (value as TargetStatus))}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES_VALUE}>すべて</SelectItem>
              {TARGET_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="search"
            placeholder="URL・会社名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          {isAdmin && (
            <>
              <Button variant="outline" asChild>
                <a href={`/api/runs/export${profileId ? `?profileId=${profileId}` : ""}`}>
                  CSVエクスポート（会社名・メール・WEB）
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/api/runs/export?failedOnly=1${profileId ? `&profileId=${profileId}` : ""}`}>
                  送信失敗一覧CSV（{failedCount}件）
                </a>
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        表示順は取り込んだ順です。フォーム探索の結果・スコア・理由は「詳細」で確認できます。「送信可能」になった行の「入力」を押すと、その場でタブが開いて入力された状態を確認できます。
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">読み込み中...</p>}
      {isError && <p className="text-sm text-destructive">一覧の取得に失敗しました</p>}
      {pagedTargets && <TargetTable targets={pagedTargets} />}

      {targets && targets.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {targets.length}件中 {(currentPage - 1) * PAGE_SIZE + 1}〜
            {Math.min(currentPage * PAGE_SIZE, targets.length)}件を表示
          </p>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="前へ"
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage((p) => Math.max(1, p - 1));
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive size="default" className="pointer-events-none">
                  {currentPage} / {totalPages}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text="次へ"
                  aria-disabled={currentPage === totalPages}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
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

function HowToStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
