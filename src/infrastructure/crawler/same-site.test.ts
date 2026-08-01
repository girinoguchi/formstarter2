import { describe, expect, it } from "vitest";

import { isSameSite } from "./same-site";

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
