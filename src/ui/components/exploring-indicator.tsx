"use client";

import { useActiveRuns } from "../hooks/use-active-runs";

/**
 * 探索(EXPLORE)は可視タブを持たないため、開いているタブパネルとは別に
 * 「今何件バックグラウンドで探索中か」だけを軽量に示す。CSVインポート直後の
 * 大量探索の進行状況を、ウィンドウを一切開かずに把握できるようにするため。
 */
export function ExploringIndicator({ profileId }: { profileId: string | null }) {
  const { data: runs } = useActiveRuns(profileId, "EXPLORE");

  if (!runs || runs.length === 0) return null;

  return (
    <p className="mb-4 text-sm text-muted-foreground">
      問い合わせフォームを探索中: {runs.length}件（ウィンドウは開きません。見つかり次第「送信可能」になります）
    </p>
  );
}
