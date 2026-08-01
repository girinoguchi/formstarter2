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

  it("accepts a form with no name/email hints as long as it has a textarea (inquiry body)", () => {
    const { $, form } = formFrom(
      `<form><input type="text" name="f1"><input type="text" name="f2"><textarea name="f3"></textarea></form>`,
    );
    expect(looksLikeContactForm($, form)).toBe(true);
  });

  it("rejects a form with no fillable inputs at all", () => {
    const { $, form } = formFrom(`<form><button type="submit">送信</button></form>`);
    expect(looksLikeContactForm($, form)).toBe(false);
  });

  // 3項目以上あれば「らしい」とみなす旧フォールバックだと、詳細検索フォーム
  // (キーワード+カテゴリ+価格帯)やログインフォームまで通ってしまっていた実バグの
  // 回帰テスト。textarea/氏名/メールのどれも無ければ、項目数だけでは通さない。
  it("rejects a 3-field search form with no textarea/name/email hints", () => {
    const { $, form } = formFrom(
      `<form><input type="text" name="keyword"><select name="category"></select><input type="text" name="price_range"></form>`,
    );
    expect(looksLikeContactForm($, form)).toBe(false);
  });

  // "mail"/"name"の素の部分一致だと、購読フォームやファイル名入力欄のような
  // 無関係なフィールドまで「メール/氏名らしい」と誤認していた実バグの回帰テスト。
  it("rejects fields whose names merely contain 'mail' or 'name' as a substring", () => {
    const { $, form } = formFrom(
      `<form><input type="text" name="mailmagazine"><input type="text" name="campaign_name"><input type="text" name="file_name"></form>`,
    );
    expect(looksLikeContactForm($, form)).toBe(false);
  });
});
