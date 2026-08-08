import type { WebSearchClient, WebSearchResult } from "../../domain/ports/web-search.port";

/** Serper.dev（Google検索API）。FormStarterappと同じサービス・同じパラメータを使う。 */
export class SerperWebSearch implements WebSearchClient {
  constructor(private readonly apiKey: string) {}

  async search(query: string, page: number, num = 10): Promise<readonly WebSearchResult[]> {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": this.apiKey, "Content-Type": "application/json" },
        // gl/hlで日本の検索結果に寄せる（営業リストの対象が国内企業のため）。
        body: JSON.stringify({ q: query, num, page, gl: "jp", hl: "ja" }),
      });
      if (!res.ok) return [];

      const data = (await res.json()) as { organic?: WebSearchResult[] };
      return data.organic ?? [];
    } catch {
      return [];
    }
  }
}
