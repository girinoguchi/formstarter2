import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpContactPageFinder } from "./http-contact-page-finder";

/** URL→HTMLの対応表でfetchを差し替える。表に無いURLは404扱い。 */
function stubPages(pages: Record<string, string>) {
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = input.toString();
    const html = pages[url];
    if (html === undefined) return new Response("not found", { status: 404 });
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HttpContactPageFinder.listContactLinks", () => {
  // 2026-08-08の実データ調査で見つかった構成。「お問い合わせ」が窓口の一覧ページに
  // なっていて、フォームは1階層下にある（kcs.ne.jp/inquiry → /inquiry/biz、
  // antepost.co.jp/contact/ → /contact/inquiry）。これを辿れないと探索は失敗する。
  it("一覧ページ内の窓口リンクを列挙する", async () => {
    stubPages({
      "https://example.com/inquiry": `
        <html><body>
          <a href="/inquiry/biz">法人のお問い合わせ</a>
          <a href="/inquiry/recruit">採用に関するお問い合わせ</a>
          <a href="/company">会社概要</a>
        </body></html>`,
    });

    const links = await new HttpContactPageFinder().listContactLinks("https://example.com/inquiry");

    expect(links).toEqual([
      "https://example.com/inquiry/biz",
      "https://example.com/inquiry/recruit",
    ]);
  });

  // ヘッダー/ナビの「お問い合わせ」は今見ている一覧ページ自身を指すことが多い。
  // 本文の窓口リンクより先に来ると、実際のフォームに辿り着けなくなる。
  it("本文のリンクをヘッダー・ナビより優先する", async () => {
    stubPages({
      "https://example.com/contact/": `
        <html><body>
          <header><a href="/contact/">お問い合わせ</a></header>
          <nav><a href="/contact/top">お問い合わせトップ</a></nav>
          <main><a href="/contact/inquiry">お問い合わせフォームへ</a></main>
        </body></html>`,
    });

    const links = await new HttpContactPageFinder().listContactLinks("https://example.com/contact/");

    expect(links[0]).toBe("https://example.com/contact/inquiry");
  });

  it("自分自身を指すリンクは除外する（無限に同じページを見に行かない）", async () => {
    stubPages({
      "https://example.com/contact": `<html><body><a href="/contact">お問い合わせ</a></body></html>`,
    });

    const links = await new HttpContactPageFinder().listContactLinks("https://example.com/contact");

    expect(links).toEqual([]);
  });

  it("他ドメインへのリンクは除外する", async () => {
    stubPages({
      "https://example.com/contact": `
        <html><body>
          <a href="https://other-site.jp/contact">お問い合わせ</a>
          <a href="/contact/form">お問い合わせフォーム</a>
        </body></html>`,
    });

    const links = await new HttpContactPageFinder().listContactLinks("https://example.com/contact");

    expect(links).toEqual(["https://example.com/contact/form"]);
  });

  it("mailto: / tel: は除外する", async () => {
    stubPages({
      "https://example.com/contact": `
        <html><body>
          <a href="mailto:info@example.com">お問い合わせはメールで</a>
          <a href="tel:0312345678">お問い合わせ電話</a>
        </body></html>`,
    });

    expect(await new HttpContactPageFinder().listContactLinks("https://example.com/contact")).toEqual([]);
  });

  it("同じURLは重複させない", async () => {
    stubPages({
      "https://example.com/contact": `
        <html><body>
          <a href="/contact/form">お問い合わせ</a>
          <a href="/contact/form">お問い合わせフォーム</a>
        </body></html>`,
    });

    expect(await new HttpContactPageFinder().listContactLinks("https://example.com/contact")).toEqual([
      "https://example.com/contact/form",
    ]);
  });

  it("件数の上限を守る（無制限に深追いして探索を重くしない）", async () => {
    const anchors = Array.from({ length: 10 }, (_, i) => `<a href="/contact/${i}">お問い合わせ${i}</a>`).join("");
    stubPages({ "https://example.com/contact": `<html><body>${anchors}</body></html>` });

    const links = await new HttpContactPageFinder().listContactLinks("https://example.com/contact", 3);

    expect(links).toHaveLength(3);
  });

  it("取得できないページでは空を返す（探索全体を止めない）", async () => {
    stubPages({});

    expect(await new HttpContactPageFinder().listContactLinks("https://example.com/gone")).toEqual([]);
  });
});
