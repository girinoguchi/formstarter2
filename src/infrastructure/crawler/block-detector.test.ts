import { describe, expect, it } from "vitest";

import { HeuristicBlockDetector } from "./block-detector";

const detector = new HeuristicBlockDetector();

describe("HeuristicBlockDetector", () => {
  it("detects Cloudflare-style bot challenge pages by status code", () => {
    const result = detector.check({ status: 503, title: null, bodyText: null });
    expect(result.blocked).toBe(true);
    expect(result.kind).toBe("BOT_PROTECTION");
  });

  it("detects Cloudflare-style bot challenge pages by title text", () => {
    const result = detector.check({ status: 200, title: "Just a moment...", bodyText: null });
    expect(result.blocked).toBe(true);
    expect(result.kind).toBe("BOT_PROTECTION");
  });

  // FormStarterappの営業禁止ワード検知(lib/blockRules.ts)を踏襲した挙動の回帰テスト。
  it.each([
    "本サイトは営業お断りです。",
    "営業目的でのご連絡はご遠慮ください。",
    "セールスのお問い合わせはお断りしております。",
    "no unsolicited sales calls",
  ])("detects sales-prohibited wording: %s", (bodyText) => {
    const result = detector.check({ status: 200, title: "お問い合わせ", bodyText });
    expect(result.blocked).toBe(true);
    expect(result.kind).toBe("SALES_PROHIBITED");
  });

  it("does not flag an ordinary contact page", () => {
    const result = detector.check({
      status: 200,
      title: "お問い合わせ｜株式会社サンプル",
      bodyText: "下記フォームに必要事項をご入力の上、送信してください。",
    });
    expect(result.blocked).toBe(false);
  });

  // "captcha"を素の部分文字列として使うと"reCAPTCHA"の可視バッジ/注意書きに
  // マッチしてしまい、Google reCAPTCHAを埋め込んだだけの正常なフォームまで
  // BOT_PROTECTIONと誤判定する実バグがあった（seicho-inc.jp等の実データで確認）。
  it("does not flag an ordinary form that merely embeds Google reCAPTCHA", () => {
    const result = detector.check({
      status: 200,
      title: "お問い合わせフォーム",
      bodyText:
        "このサイトはreCAPTCHAによって保護されており、Googleのプライバシーポリシーと利用規約が適用されます。",
    });
    expect(result.blocked).toBe(false);
  });
});
