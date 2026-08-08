"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { errorStepLabel } from "../../domain/value-objects/error-step";
import type { TargetListItem } from "../hooks/use-targets";
import { RunStatusBadge } from "./run-status-badge";

interface TargetTableProps {
  targets: readonly TargetListItem[];
}

const RUNNING_LIKE_STATUSES = new Set(["QUEUED", "RUNNING"]);
const FAILED_LIKE_STATUSES = new Set(["FAILED", "NOT_SENDABLE", "BLOCKED", "NEEDS_REVIEW"]);

export function TargetTable({ targets }: TargetTableProps) {
  const queryClient = useQueryClient();
  const [runningId, setRunningId] = useState<string | null>(null);

  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">ターゲットがありません。CSVをインポートしてください。</p>;
  }

  async function handleRunOne(id: string) {
    setRunningId(id);
    try {
      await fetch(`/api/targets/${id}/run`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["targets"] });
      queryClient.invalidateQueries({ queryKey: ["runs", "active"] });
    } finally {
      setRunningId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>URL</TableHead>
          <TableHead>会社名</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>更新日時</TableHead>
          <TableHead></TableHead>
          <TableHead>詳細</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {targets.map((target) => (
          <TableRow key={target.id}>
            <TableCell className="max-w-[260px]">
              <a
                href={target.url}
                target="_blank"
                rel="noopener noreferrer"
                title={target.url}
                className="block truncate text-primary hover:underline"
              >
                {target.url}
              </a>
            </TableCell>
            <TableCell className="max-w-[140px] truncate">{target.companyName ?? "—"}</TableCell>
            <TableCell className="max-w-[280px] align-top">
              <RunStatusBadge status={target.status} />
              {/* NGリストで弾いたものはRunが無く、直近Runの失敗理由では説明できないため個別に出す。 */}
              {target.blockReason && (
                <p
                  className="mt-1 line-clamp-2 whitespace-normal text-xs text-muted-foreground"
                  title={target.blockReason}
                >
                  {target.blockReason}
                </p>
              )}
              {FAILED_LIKE_STATUSES.has(target.status) && target.latestErrorStep && (
                <p
                  className="mt-1 line-clamp-2 whitespace-normal text-xs text-muted-foreground"
                  title={errorStepLabel(target.latestErrorStep)}
                >
                  {errorStepLabel(target.latestErrorStep)}
                </p>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(target.updatedAt).toLocaleString("ja-JP")}
            </TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunOne(target.id)}
                disabled={runningId === target.id || RUNNING_LIKE_STATUSES.has(target.status)}
              >
                {target.contactPageUrl ? "開く" : target.status === "PENDING" ? "探索" : "再探索"}
              </Button>
            </TableCell>
            <TableCell>
              <Link href={`/targets/${target.id}`} className="text-primary hover:underline">
                詳細
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
