"use client";

import { useMutation } from "@tanstack/react-query";

export interface ResolvedCompanyUrl {
  name: string;
  url: string | null;
}

export function useResolveCompanyUrls() {
  return useMutation({
    mutationFn: async (names: string[]) => {
      const res = await fetch("/api/list-search/resolve-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "URLの検索に失敗しました");
      return body as { results: ResolvedCompanyUrl[]; skippedCount: number };
    },
  });
}

/**
 * 企業名・URLの2列CSVとしてダウンロードさせる。
 * BOMを付けるのはExcelで開いたときに日本語が文字化けしないようにするため
 * （既存の実行結果エクスポートと同じ方針）。
 */
export function downloadCsv(fileName: string, rows: readonly { name: string; url: string | null }[]): void {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const csv = [
    ["企業名", "URL"].join(","),
    ...rows.map((r) => [escape(r.name), escape(r.url ?? "")].join(",")),
  ].join("\r\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** 1行1社のCSVから企業名（先頭列）を取り出す。 */
export function parseCompanyNames(csvText: string): string[] {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim().replace(/^"|"$/g, "") ?? "")
    .filter((name) => name !== "");
}
