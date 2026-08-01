import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";

import { looksLikeContactForm } from "./static-form-checker";

function formFrom(html: string) {
  const $ = cheerio.load(html);
  const form = $("form").get(0);
  if (!form) throw new Error("no <form> in fixture html");
  return { $, form };
}

describe("looksLikeContactForm", () => {
  it("accepts a form with a name and email field", () => {
    const { $, form } = formFrom(
      `<form><input type="text" name="your-name"><input type="email" name="your-email"><textarea name="message"></textarea></form>`,
    );
    expect(looksLikeContactForm($, form)).toBe(true);
  });

  // recolte-jp.com等: ヘッダー/フッター共通部品のサイト内検索フォームが1件だけの
  // text inputで「フォームが存在する」判定を素通りし、無関係なページが誤って
  // READYになっていた実バグの回帰テスト。
  it("rejects a single-field search-like form with no name/email hints", () => {
    const { $, form } = formFrom(`<form action="/search"><input type="text" name="q" placeholder="検索"></form>`);
    expect(looksLikeContactForm($, form)).toBe(false);
  });

  it("rejects a newsletter signup form with a single unrelated field", () => {
    const { $, form } = formFrom(`<form><input type="text" name="promo_code"></form>`);
    expect(looksLikeContactForm($, form)).toBe(false);
  });

  it("accepts a form with 3+ fillable fields even without name/email hints", () => {
    const { $, form } = formFrom(
      `<form><input type="text" name="f1"><input type="text" name="f2"><textarea name="f3"></textarea></form>`,
    );
    expect(looksLikeContactForm($, form)).toBe(true);
  });

  it("rejects a form with no fillable inputs at all", () => {
    const { $, form } = formFrom(`<form><button type="submit">送信</button></form>`);
    expect(looksLikeContactForm($, form)).toBe(false);
  });
});
