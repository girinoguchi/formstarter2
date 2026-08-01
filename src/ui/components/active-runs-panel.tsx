"use client";

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { useActiveRuns } from "../hooks/use-active-runs";
import { RunStatusBadge } from "./run-status-badge";

export function ActiveRunsPanel({ profileId }: { profileId: string | null }) {
  const { data: runs } = useActiveRuns(profileId, "FILL");

  if (!runs || runs.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-muted-foreground">開いているタブ（{runs.length}件）</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          一覧の「入力」を押した分だけタブが開きます。内容を確認し、送信したらタブを閉じてください。
        </p>
        <ul className="flex flex-col gap-2">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{run.windowLabel ?? run.targetUrl}</span>
              <RunStatusBadge status={run.status} />
              <Link href={`/targets/${run.targetId}`} className="text-primary hover:underline">
                {run.targetCompanyName ?? run.targetUrl}
              </Link>
              {run.status === "AWAITING_SEND" && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  タブで送信ボタンを押し、確認できたらタブを閉じてください
                </span>
              )}
              {run.status === "SENT" && (
                <span className="text-xs text-green-700 dark:text-green-400">
                  送信完了を検知しました。内容を確認できたらタブを閉じてください
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
