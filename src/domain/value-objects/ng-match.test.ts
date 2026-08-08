import { describe, expect, it } from "vitest";

import { extractNgCheckHost, isNgUrl } from "./ng-match";

describe("isNgUrl", () => {
  it("登録したドメインに一致するURLを止める", () => {
    expect(isNgUrl("https://example.com/contact", ["example.com"])).toBe(true);
  });

  // NGリストには裸のドメインを登録する運用が主。サブドメインやパス付きで
  // すり抜けると「送ってはいけない相手に送る」事故になるため、広めに止める。
  it("サブドメイン・パス付きでも止める", () => {
    expect(isNgUrl("https://www.example.com/inquiry/form", ["example.com"])).toBe(true);
  });

  it("URLで登録した場合、そのドメインの他ページも止める", () => {
    expect(isNgUrl("https://example.com/other", ["https://example.com/contact"])).toBe(true);
  });

  it("無関係なドメインは止めない", () => {
    expect(isNgUrl("https://safe-site.jp/contact", ["example.com", "blocked.co.jp"])).toBe(false);
  });

  it("大文字small文字の違いを無視する", () => {
    expect(isNgUrl("https://EXAMPLE.com/contact", ["example.com"])).toBe(true);
    expect(isNgUrl("https://example.com/contact", ["EXAMPLE.COM"])).toBe(true);
  });

  it("前後の空白が入った登録値でも一致する", () => {
    expect(isNgUrl("https://example.com/", ["  example.com  "])).toBe(true);
  });

  it("空文字の登録値は無視する（全件ブロックしない）", () => {
    expect(isNgUrl("https://example.com/", ["", "   "])).toBe(false);
  });

  it("NGリストが空なら何も止めない", () => {
    expect(isNgUrl("https://example.com/", [])).toBe(false);
  });

  it("スキームなしで登録された値にも一致する", () => {
    expect(isNgUrl("http://www.moasis.jp/contact.aspx", ["moasis.jp"])).toBe(true);
  });
});

describe("extractNgCheckHost", () => {
  it("URLからホスト名を取り出す", () => {
    expect(extractNgCheckHost("https://www.Example.com/contact")).toBe("www.example.com");
  });

  it("スキームが無くてもホスト名として解釈する", () => {
    expect(extractNgCheckHost("example.com/contact")).toBe("example.com");
  });

  it("URLとして解釈できない入力はそのまま小文字で返す（入力途中の値など）", () => {
    // 空白を含む文字列はホスト名として解釈できずnew URLが失敗する。
    expect(extractNgCheckHost("Contact Us")).toBe("contact us");
  });
});
