import { describe, expect, it } from "vitest";

import { parseCsvNgValues } from "./csv-ng-parser";

describe("parseCsvNgValues", () => {
  it("1行1件として読む", () => {
    const result = parseCsvNgValues("example.com\nblocked.co.jp\n");

    expect(result.values).toEqual(["example.com", "blocked.co.jp"]);
    expect(result.skippedLineCount).toBe(0);
  });

  // ターゲットCSVと違いhttp(s)始まりを要求しない。裸のドメイン登録が主な使い方で、
  // それを弾くとNGリストとして用をなさないため。
  it("裸のドメインを弾かない", () => {
    expect(parseCsvNgValues("example.com").values).toEqual(["example.com"]);
  });

  it("URL形式も読める", () => {
    expect(parseCsvNgValues("https://example.com/contact").values).toEqual([
      "https://example.com/contact",
    ]);
  });

  it("2列以上ある場合は1列目だけ読む", () => {
    expect(parseCsvNgValues("example.com,株式会社サンプル\n").values).toEqual(["example.com"]);
  });

  it("先頭のヘッダー行だけを落とす", () => {
    const result = parseCsvNgValues("domain\nexample.com\n");

    expect(result.values).toEqual(["example.com"]);
    expect(result.skippedLineCount).toBe(1);
  });

  it("2行目以降に見出し語と同じ値があっても落とさない", () => {
    // 「url」という名前のドメインは考えにくいが、先頭行以外を落とす根拠は無い。
    expect(parseCsvNgValues("example.com\nurl\n").values).toEqual(["example.com", "url"]);
  });

  it("空行はスキップ件数に数える", () => {
    const result = parseCsvNgValues("example.com\n,\nblocked.jp\n");

    expect(result.values).toEqual(["example.com", "blocked.jp"]);
    expect(result.skippedLineCount).toBe(1);
  });

  it("空のCSVでも壊れない", () => {
    expect(parseCsvNgValues("").values).toEqual([]);
  });
});
