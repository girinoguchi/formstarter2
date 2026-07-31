"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { TargetListItem } from "../hooks/use-targets";
import { RunStatusBadge } from "./run-status-badge";

interface TargetTableProps {
  targets: readonly TargetListItem[];
}

const RUNNING_LIKE_STATUSES = new Set(["QUEUED", "RUNNING"]);

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
              <Link
                href={`/targets/${target.id}`}
                title={target.url}
                className="block truncate text-primary hover:underline"
              >
                {target.url}
              </Link>
            </TableCell>
            <TableCell className="max-w-[140px] truncate">{target.companyName ?? "—"}</TableCell>
            <TableCell>
              <RunStatusBadge status={target.status} />
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
                {target.contactPageUrl ? "入力" : target.status === "PENDING" ? "探索" : "再探索"}
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
