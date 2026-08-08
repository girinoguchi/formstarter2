import fs from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { extractFormsInCurrentDocument, type ExtractedField } from "./dom-form-parser";

/**
 * extractFormsInCurrentDocument()はもともとPlaywrightのpage.evaluate()にそのまま渡す
 * 前提の関数（document等のグローバルにのみ依存）なので、jsdomでdocument/CSSを
 * グローバルに差し込めばブラウザなしでも同じロジックを検証できる。
 */
function runExtractOnHtml(html: string) {
  const dom = new JSDOM(html);
  const originalDocument = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalCSS = (globalThis as { CSS?: typeof CSS }).CSS;
  globalThis.document = dom.window.document;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  (globalThis as { CSS?: typeof CSS }).CSS = dom.window.CSS;
  try {
    return extractFormsInCurrentDocument();
  } finally {
    globalThis.document = originalDocument;
    globalThis.getComputedStyle = originalGetComputedStyle;
    (globalThis as { CSS?: typeof CSS }).CSS = originalCSS;
  }
}

function runExtractOnFixture(fileName: string): ExtractedField[] {
  const html = fs.readFileSync(path.join(__dirname, "__fixtures__", fileName), "utf-8");
  const dom = new JSDOM(html);

  const originalDocument = globalThis.document;
  const originalCSS = (globalThis as { CSS?: typeof CSS }).CSS;
  globalThis.document = dom.window.document;
  (globalThis as { CSS?: typeof CSS }).CSS = dom.window.CSS;
  try {
    const forms = extractFormsInCurrentDocument();
    return [...forms.flatMap((f) => f.fields)];
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { CSS?: typeof CSS }).CSS = originalCSS;
  }
}

function fieldByName(fields: readonly ExtractedField[], name: string): ExtractedField | undefined {
  return fields.find((f) => f.name === name);
}

describe("extractFormsInCurrentDocument", () => {
  // oh-ami.com: <label>もaria属性も無いtableレイアウト。ラベルはinputの親要素(td)の
  // 直前の兄弟(td)に書かれている。table/dlレイアウト用のsiblingフォールバックが無いと
  // labelがnullのままになり、お名前・メール等の必須項目がUNKNOWN判定になる実バグがあった。
  describe("table layout (oh-ami.com)", () => {
    const fields = runExtractOnFixture("oh-ami-inquiry.html");

    it("extracts label text from the sibling <td>", () => {
      expect(fieldByName(fields, "f_name")?.label).toContain("お名前");
      expect(fieldByName(fields, "f_company")?.label).toContain("会社名");
      expect(fieldByName(fields, "f_mail")?.label).toContain("E-mail");
      expect(fieldByName(fields, "f_mail_again")?.label).toContain("E-mail確認");
      expect(fieldByName(fields, "f_comment")?.label).toContain("お問い合わせ");
    });

    it("marks name/email fields as required based on the label text, not the required attribute", () => {
      // このサイトはHTMLのrequired属性を使わず「※」表記で必須を示すため、
      // requiredはfalseのままになる（別問題として残っている挙動。ここでは現状の値を記録する）。
      expect(fieldByName(fields, "f_name")?.required).toBe(false);
    });

    it("extracts the prefecture <select> options", () => {
      const pref = fieldByName(fields, "f_pref");
      expect(pref?.type).toBe("select");
      expect(pref?.options?.some((o) => o.label === "東京都")).toBe(true);
    });
  });

  // kurashi-no-techo.co.jp: WordPress Contact Form 7。ラベルは<label>ではなく
  // <p class="ttl">見出し</p><p class="cnt"><span><input></span></p> という
  // 「inputの祖父母要素の前の兄弟」構造。基本項目(氏名・メール等)はname属性
  // (your-name/your-emailなど)が辞書パターンと一致するため見た目上は分類できているが、
  // ラベル自体は正しく取れているか（＝将来name属性に頼らないラベル判定に変えても
  // 壊れないか）をここで確認する。
  describe("WordPress Contact Form 7 layout (kurashi-no-techo.co.jp)", () => {
    const fields = runExtractOnFixture("kurashi-no-techo-contact.html");

    it("extracts all your-message1..6 conditional fields (same underlying name pattern, different groups)", () => {
      const messageFields = fields.filter((f) => f.name?.startsWith("your-message"));
      expect(messageFields).toHaveLength(6);
      expect(messageFields.every((f) => f.type === "textarea")).toBe(true);
    });

    it("extracts the your-subject category <select> with all group options", () => {
      const subject = fieldByName(fields, "your-subject");
      expect(subject?.type).toBe("select");
      expect(subject?.options?.length).toBeGreaterThanOrEqual(8);
    });

    it("associates the <p class=\"ttl\"> heading as a label via the grandparent-sibling fallback", () => {
      // p.ttl(見出し) と p.cnt(input) は input の「親のさらに親」の兄弟にあたる。
      // 親の直前の兄弟だけを見るfallbackでは拾えず、ご住所欄がUNKNOWNのまま
      // 未入力になる実バグがあった（kurashi-no-techo.co.jp本番データで確認）。
      expect(fieldByName(fields, "your-adrs")?.label).toContain("ご住所");
    });
  });
});

// 2026-08-08の実障害(ashita-team.com)の回帰テスト。反自動化のための隠しフィールドを
// 「本文」と誤判定して埋めていた。g-recaptcha-responseはトークンを壊し、
// Pardotのpi_extra_field(ラベルがComments)はスパム判定を招く。
describe("extractFormsInCurrentDocument: 触ってはいけないフィールドの除外", () => {
  it("reCAPTCHAのトークン欄を候補に含めない", () => {
    const forms = runExtractOnHtml(
      `<form><input type="text" name="company"><textarea name="g-recaptcha-response"></textarea></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["company"]);
  });

  it("hCaptcha / Turnstile のトークン欄も含めない", () => {
    const forms = runExtractOnHtml(
      `<form><textarea name="h-captcha-response"></textarea><textarea name="cf-turnstile-response"></textarea><input name="company"></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["company"]);
  });

  it("Pardotのハニーポット(pi_extra_field)を候補に含めない", () => {
    const forms = runExtractOnHtml(
      `<form><input type="text" name="pi_extra_field"><input type="text" name="company"></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["company"]);
  });

  it("よくある名前のハニーポットも含めない", () => {
    const forms = runExtractOnHtml(
      `<form><input name="honeypot"><input name="_honey"><input name="company"></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["company"]);
  });

  it("display:noneの入力欄は含めない（名前が未知のハニーポット対策）", () => {
    const forms = runExtractOnHtml(
      `<form><input type="text" name="trap" style="display:none"><input type="text" name="company"></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["company"]);
  });

  it("hiddenと送信ボタンは残す（フォーム判別のスコアリングに使うため）", () => {
    const forms = runExtractOnHtml(
      `<form><input type="hidden" name="token"><input name="company"><input type="submit" value="送信する"></form>`,
    );

    expect(forms[0].fields.map((f) => f.name)).toEqual(["token", "company", null]);
  });

  it("form自身の可視性を返す", () => {
    const visible = runExtractOnHtml(`<form><input name="a"></form>`);
    const hidden = runExtractOnHtml(`<form style="display:none"><input name="a"></form>`);

    expect(visible[0].visible).toBe(true);
    expect(hidden[0].visible).toBe(false);
  });
});
