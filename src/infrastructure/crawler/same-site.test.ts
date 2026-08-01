import { describe, expect, it } from "vitest";

import { isSameSite, isSelfLink } from "./same-site";

describe("isSameSite", () => {
  it("treats www. as the same site", () => {
    expect(isSameSite("https://www.example.com/contact", "https://example.com/")).toBe(true);
  });

  it("treats a subdomain as the same site", () => {
    expect(isSameSite("https://form.example.com/contact", "https://example.com/")).toBe(true);
  });

  it("rejects a different domain", () => {
    // instagram.com上の定型フッターリンクがfacebook.com/help配下の無関係なページを
    // 実際の問い合わせページと誤認していた実バグの回帰テスト。
    expect(isSameSite("https://www.facebook.com/help/instagram/261704639352628", "https://www.instagram.com/aquacarpatica_jp/")).toBe(
      false,
    );
  });

  it("returns false for malformed URLs instead of throwing", () => {
    expect(isSameSite("not a url", "https://example.com/")).toBe(false);
  });
});

describe("isSelfLink", () => {
  // recolte-jp.com/support/: ナビゲーションの「サポート／お問い合わせ」が現在地を
  // 示すだけで自分自身を指しており、実在する個別の問い合わせフォームへのリンクより
  // 先にマッチして誤ってREADYになっていた実バグの回帰テスト。
  it("treats a link back to the current page (ignoring trailing slash) as a self link", () => {
    expect(isSelfLink("https://recolte-jp.com/support/", "https://recolte-jp.com/support")).toBe(true);
    expect(isSelfLink("https://recolte-jp.com/support", "https://recolte-jp.com/support/")).toBe(true);
  });

  it("does not treat a distinct sub-page as a self link", () => {
    expect(isSelfLink("https://recolte-jp.com/support/contact/", "https://recolte-jp.com/support/")).toBe(false);
  });

  it("returns false for malformed URLs instead of throwing", () => {
    expect(isSelfLink("not a url", "https://example.com/")).toBe(false);
  });
});
