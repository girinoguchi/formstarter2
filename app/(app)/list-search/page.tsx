"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  downloadCsv,
  parseCompanyNames,
  useResolveCompanyUrls,
  type ResolvedCompanyUrl,
} from "../../../src/ui/hooks/use-list-search";

export default function ListSearchPage() {
  const [resolved, setResolved] = useState<ResolvedCompanyUrl[]>([]);
  const [resolveFileName, setResolveFileName] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const resolve = useResolveCompanyUrls();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setResolveFileName(file.name);
    const names = parseCompanyNames(await file.text());
    if (names.length === 0) {
      setError("CSVから企業名を読み取れませんでした");
      return;
    }
    try {
      const body = await resolve.mutateAsync(names);
      setResolved(body.results);
      setSkippedCount(body.skippedCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "URLの検索に失敗しました");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const foundCount = resolved.filter((r) => r.url).length;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">リスト検索</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          企業名だけのCSVを読み込ませると、1社ずつ公式サイトURLを検索してCSVで返します。
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-white p-6">
        <div className="space-y-2">
          <Label htmlFor="resolve-csv">企業名CSV（1行1社、先頭列を企業名として読み取ります）</Label>
          <div className="flex items-center gap-3">
            <input
              id="resolve-csv"
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,text/csv"
              disabled={resolve.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted/30 disabled:opacity-50"
            />
            {resolve.isPending && (
              <span className="text-sm text-muted-foreground">
                検索中...（件数によっては数十秒かかります）
              </span>
            )}
          </div>
          {resolveFileName && !resolve.isPending && (
            <p className="text-xs text-muted-foreground">読み込んだファイル: {resolveFileName}</p>
          )}
          <p className="text-xs text-muted-foreground">見つからなかった企業はURL欄が空欄になります。</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {skippedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          企業名が300社を超えていたため、先頭300社のみ処理しました。
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {resolved.length} 社中 {foundCount} 社のURLが見つかりました
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(`resolved-urls-${Date.now()}.csv`, resolved)}
              >
                CSVダウンロード
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResolved([]);
                  setResolveFileName(null);
                  setSkippedCount(0);
                }}
              >
                クリア
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">企業名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">URL</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((row, index) => (
                  <tr
                    key={`${row.url ?? "none"}-${index}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="max-w-[320px] truncate px-4 py-3">{row.name}</td>
                    <td className="max-w-[460px] truncate px-4 py-3">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {row.url}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">見つかりませんでした</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
