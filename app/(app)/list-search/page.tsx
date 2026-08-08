"use client";

import { Download } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  downloadCsv,
  parseCompanyNames,
  useKeywordSearch,
  useResolveCompanyUrls,
  type ListSearchItem,
  type ResolvedCompanyUrl,
} from "../../../src/ui/hooks/use-list-search";

export default function ListSearchPage() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<ListSearchItem[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const search = useKeywordSearch();

  const [resolved, setResolved] = useState<ResolvedCompanyUrl[]>([]);
  const [resolveMessage, setResolveMessage] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const resolve = useResolveCompanyUrls();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSearch() {
    if (!keyword.trim()) return;
    setSearchError(null);
    try {
      const body = await search.mutateAsync(keyword.trim());
      setResults(body.results);
      setSearched(true);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "検索に失敗しました");
    }
  }

  async function handleResolveFile(file: File) {
    setResolveError(null);
    setResolveMessage(null);
    const names = parseCompanyNames(await file.text());
    if (names.length === 0) {
      setResolveError("CSVから企業名を読み取れませんでした");
      return;
    }
    try {
      const body = await resolve.mutateAsync(names);
      setResolved(body.results);
      const found = body.results.filter((r) => r.url).length;
      setResolveMessage(
        `${body.results.length}社中${found}社のURLが見つかりました` +
          (body.skippedCount > 0 ? `（上限超過の${body.skippedCount}社は未処理）` : ""),
      );
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "URLの検索に失敗しました");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold">リスト検索</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        検索した結果はCSVでダウンロードできます。送信対象にするときは、そのCSVを「リスト設定・送信実行」で取り込んでください。
      </p>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold">キーワードから探す</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例: 東京 製造業 部品"
              className="max-w-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!keyword.trim() || search.isPending}>
              {search.isPending ? "検索中..." : "検索"}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={results.length === 0}
              onClick={() => downloadCsv(`list-search-${Date.now()}.csv`, results)}
            >
              <Download size={14} />
              CSVダウンロード
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            入力した語に「お問い合わせ」「会社概要」などを補った複数パターンで検索します。SNS・求人媒体・ポータル・報道・官公庁・学校のドメインは除外し、同じ会社は1件にまとめます。
          </p>
          {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          {searched && !search.isPending && (
            <p className="text-sm text-muted-foreground">{results.length}件見つかりました</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <h2 className="text-base font-semibold">企業名のCSVからURLを探す</h2>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleResolveFile(file);
              }}
            />
            <Label htmlFor="resolve" className="sr-only">
              企業名CSV
            </Label>
            <Button
              id="resolve"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={resolve.isPending}
            >
              {resolve.isPending ? "検索中..." : "企業名CSVを選択"}
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={resolved.length === 0}
              onClick={() => downloadCsv(`resolved-urls-${Date.now()}.csv`, resolved)}
            >
              <Download size={14} />
              CSVダウンロード
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            1行1社、先頭列を企業名として読み取ります。1社ずつ公式サイトを検索するため件数に応じて時間がかかります（上限300社）。
          </p>
          {resolveError && <p className="text-sm text-destructive">{resolveError}</p>}
          {resolveMessage && <p className="text-sm text-muted-foreground">{resolveMessage}</p>}
        </CardContent>
      </Card>

      {resolved.length > 0 && (
        <ResultTable
          title="企業名から見つけたURL"
          rows={resolved.map((r) => ({ name: r.name, url: r.url }))}
        />
      )}
      {results.length > 0 && <ResultTable title="検索結果" rows={results} />}
    </div>
  );
}

function ResultTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { name: string; url: string | null }[];
}) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-lg font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">{rows.length}件</span>
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>企業名</TableHead>
            <TableHead>URL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.url ?? "none"}-${index}`}>
              <TableCell className="max-w-[280px] truncate">{row.name}</TableCell>
              <TableCell className="max-w-[360px] truncate">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
