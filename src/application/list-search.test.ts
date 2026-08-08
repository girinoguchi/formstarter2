import { describe, expect, it, vi } from "vitest";

import type { WebSearchClient, WebSearchResult } from "../domain/ports/web-search.port";

import { ListSearchService, MAX_COMPANY_NAMES, rejectSharedDomains } from "./list-search";

/** クエリ→返す結果、の対応表で検索APIを差し替える。表に無いクエリは0件。 */
function fakeClient(byQuery: Record<string, WebSearchResult[]> = {}) {
  const calls: { query: string; page: number; num?: number }[] = [];
  const client: WebSearchClient = {
    search: vi.fn(async (query: string, page: number, num?: number) => {
      calls.push({ query, page, num });
      const key = Object.keys(byQuery).find((k) => query.includes(k));
      return key && page === 1 ? byQuery[key] : [];
    }),
  };
  return { client, calls };
}

describe("ListSearchService.searchByKeyword", () => {
  it("言い換え5パターン × 3ページを取得する", async () => {
    const { client, calls } = fakeClient();

    await new ListSearchService(client).searchByKeyword("東京 製造業");

    expect(calls).toHaveLength(15);
    expect(new Set(calls.map((c) => c.page))).toEqual(new Set([1, 2, 3]));
  });

  it("除外ドメインを落とし、同じ会社を1件にまとめる", async () => {
    const { client } = fakeClient({
      "東京 製造業": [
        { title: "A社 概要", link: "https://a.co.jp/about" },
        { title: "A社 問い合わせ", link: "https://a.co.jp/contact" },
        { title: "求人", link: "https://tenshoku.mynavi.jp/a" },
        { title: "B社", link: "https://b.co.jp/" },
      ],
    });

    const items = await new ListSearchService(client).searchByKeyword("東京 製造業");

    expect(items).toEqual([
      { name: "A社 概要", url: "https://a.co.jp" },
      { name: "B社", url: "https://b.co.jp" },
    ]);
  });

  // 1本でも落ちると全体が失敗する作りだと、十数リクエストを投げる検索は成立しない。
  it("一部の検索が0件でも結果を返す", async () => {
    const client: WebSearchClient = {
      search: vi.fn(async (_q: string, page: number) =>
        page === 1 ? [{ title: "A社", link: "https://a.co.jp/" }] : [],
      ),
    };

    const items = await new ListSearchService(client).searchByKeyword("テスト");

    expect(items).toEqual([{ name: "A社", url: "https://a.co.jp" }]);
  });
});

describe("ListSearchService.resolveCompanyUrls", () => {
  it("「公式サイト」付きで見つかればそれを使い、2回目の検索はしない", async () => {
    const { client, calls } = fakeClient({
      '"A社" 公式サイト': [{ title: "A社", link: "https://a.co.jp/index.html" }],
    });

    const results = await new ListSearchService(client).resolveCompanyUrls(["A社"]);

    expect(results).toEqual([{ name: "A社", url: "https://a.co.jp" }]);
    expect(calls).toHaveLength(1);
  });

  it("見つからなければ社名のみで引き直す", async () => {
    const client: WebSearchClient = {
      search: vi.fn(async (query: string) =>
        query.includes("公式サイト") ? [] : [{ title: "B社", link: "https://b.co.jp/" }],
      ),
    };

    const results = await new ListSearchService(client).resolveCompanyUrls(["B社"]);

    expect(results).toEqual([{ name: "B社", url: "https://b.co.jp" }]);
    expect(client.search).toHaveBeenCalledTimes(2);
  });

  it("どちらでも見つからなければurlはnull", async () => {
    const { client } = fakeClient();

    expect(await new ListSearchService(client).resolveCompanyUrls(["C社"])).toEqual([
      { name: "C社", url: null },
    ]);
  });

  it("除外ドメインしか出なければ採用しない", async () => {
    const { client } = fakeClient({ '"D社"': [{ title: "求人", link: "https://wantedly.com/d" }] });

    expect(await new ListSearchService(client).resolveCompanyUrls(["D社"])).toEqual([
      { name: "D社", url: null },
    ]);
  });

  it("入力の並び順どおりに返す（並列実行でも崩れない）", async () => {
    const client: WebSearchClient = {
      search: vi.fn(async (query: string) => {
        const match = query.match(/"([^"]+)"/);
        const name = match?.[1] ?? "";
        // 後ろの会社ほど早く返る状況を作り、順序が入れ替わらないことを見る。
        await new Promise((resolve) => setTimeout(resolve, name === "1社" ? 20 : 0));
        return [{ title: name, link: `https://${encodeURIComponent(name)}.example/` }];
      }),
    };

    const results = await new ListSearchService(client).resolveCompanyUrls(["1社", "2社", "3社"]);

    expect(results.map((r) => r.name)).toEqual(["1社", "2社", "3社"]);
  });

  it("上限を超える分は処理しない（コストと時間の上限）", async () => {
    const { client } = fakeClient();
    const names = Array.from({ length: MAX_COMPANY_NAMES + 10 }, (_, i) => `会社${i}`);

    const results = await new ListSearchService(client).resolveCompanyUrls(names);

    expect(results).toHaveLength(MAX_COMPANY_NAMES);
  });

  it("空配列を渡しても壊れない", async () => {
    const { client } = fakeClient();

    expect(await new ListSearchService(client).resolveCompanyUrls([])).toEqual([]);
  });
});

describe("rejectSharedDomains", () => {
  // 地図・企業データベースはタイトルに社名を載せるため一致判定をすり抜ける。
  // ドメインの列挙では際限がないので、「複数の会社に同じドメイン」を手がかりにする。
  it("複数の会社に同じドメインが割り当たったら落とす", () => {
    const rejected = rejectSharedDomains([
      { name: "A社", url: "https://navitime.co.jp" },
      { name: "B社", url: "https://navitime.co.jp" },
      { name: "C社", url: "https://c.co.jp" },
    ]);

    expect(rejected).toEqual([
      { name: "A社", url: null },
      { name: "B社", url: null },
      { name: "C社", url: "https://c.co.jp" },
    ]);
  });

  it("1社しか使っていないドメインは残す", () => {
    const rows = [
      { name: "A社", url: "https://a.co.jp" },
      { name: "B社", url: "https://b.co.jp" },
    ];

    expect(rejectSharedDomains(rows)).toEqual(rows);
  });

  // 同じ会社名が2行あるだけなら集約サイトの証拠にならない。
  it("同一社名の重複では落とさない", () => {
    const rows = [
      { name: "A社", url: "https://a.co.jp" },
      { name: "A社", url: "https://a.co.jp" },
    ];

    expect(rejectSharedDomains(rows)).toEqual(rows);
  });

  it("見つからなかった行はそのまま", () => {
    const rows = [{ name: "A社", url: null }];

    expect(rejectSharedDomains(rows)).toEqual(rows);
  });
});
