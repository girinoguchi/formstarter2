import { describe, expect, it } from "vitest";

import {
  coreCompanyName,
  isExcludedUrl,
  titleMatchesCompany,
  toOrigin,
} from "./list-search-filter";

describe("isExcludedUrl", () => {
  it("企業サイトは残す", () => {
    expect(isExcludedUrl("https://example.co.jp/company")).toBe(false);
  });

  it("SNS・まとめ・求人媒体・ポータルを落とす", () => {
    for (const url of [
      "https://prtimes.jp/main/html/rd/p/1.html",
      "https://ja.wikipedia.org/wiki/x",
      "https://www.facebook.com/foo",
      "https://tenshoku.mynavi.jp/foo",
      "https://tabelog.com/tokyo/",
    ]) {
      expect(isExcludedUrl(url), url).toBe(true);
    }
  });

  it("サブドメインも落とす", () => {
    expect(isExcludedUrl("https://recruit.wantedly.com/foo")).toBe(true);
  });

  // 営業先にならない組織種別。ドメイン列挙では追いつかないのでサフィックスで落とす。
  it("自治体・官公庁・学校・非営利団体のドメインを落とす", () => {
    for (const url of [
      "https://www.city.example.lg.jp/",
      "https://www.mlit.go.jp/",
      "https://www.u-tokyo.ac.jp/",
      "https://example.ed.jp/",
      "https://example.or.jp/",
    ]) {
      expect(isExcludedUrl(url), url).toBe(true);
    }
  });

  // 「.co.jp なのに .or.jp を含む」のような部分一致で誤爆しないこと。
  it("似た文字列を含むだけの企業ドメインは落とさない", () => {
    expect(isExcludedUrl("https://major.co.jp/")).toBe(false);
    expect(isExcludedUrl("https://note-taking.co.jp/")).toBe(false);
  });

  it("URLとして壊れているものは落とす", () => {
    expect(isExcludedUrl("これはURLではない")).toBe(true);
  });
});

describe("toOrigin", () => {
  it("パス・クエリを落としてオリジンにする", () => {
    expect(toOrigin("https://example.co.jp/company/about?a=1#x")).toBe("https://example.co.jp");
  });

  it("解釈できない文字列はそのまま返す", () => {
    expect(toOrigin("not a url")).toBe("not a url");
  });
});

describe("titleMatchesCompany", () => {
  it("タイトルに社名が含まれれば一致とする", () => {
    expect(titleMatchesCompany("トヨタ自動車株式会社 | 公式サイト", "トヨタ自動車株式会社")).toBe(true);
  });

  // 検索結果のタイトルでは法人格が省略されることが多い。
  it("法人格が省略されていても一致とする", () => {
    expect(titleMatchesCompany("トヨタ自動車 公式企業サイト", "トヨタ自動車株式会社")).toBe(true);
    expect(titleMatchesCompany("ギリ | 会社概要", "株式会社ギリ")).toBe(true);
  });

  it("空白の違いを無視する", () => {
    expect(titleMatchesCompany("日本　電産　トップページ", "日本電産株式会社")).toBe(true);
  });

  it("英語の法人格も無視する", () => {
    expect(titleMatchesCompany("Example Robotics - Home", "Example Robotics Inc.")).toBe(true);
  });

  // 2026-08-09の検証で、架空の社名にcpalms.orgが割り当たった件の回帰テスト。
  // 誤ったURLを渡すのは「見つからない」より悪い。
  it("無関係なタイトルは一致としない", () => {
    expect(titleMatchesCompany("CPALMS.org", "存在しない架空の会社ZZZ9999")).toBe(false);
    expect(titleMatchesCompany("企業情報データベース", "株式会社ギリ")).toBe(false);
  });

  it("社名が空なら一致としない", () => {
    expect(titleMatchesCompany("何かのページ", "株式会社")).toBe(false);
  });
});

describe("coreCompanyName", () => {
  it("法人格と空白を取り除く", () => {
    expect(coreCompanyName("株式会社 ギリ")).toBe("ギリ");
    expect(coreCompanyName("Example Corp.")).toBe("Example");
  });
});
