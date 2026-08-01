import fs from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import { extractFormsInCurrentDocument, type ExtractedField } from "../form/dom-form-parser";
import { RuleBasedFieldClassifier } from "./rule-based-classifier";

function extractFieldsFromFixture(fileName: string): ExtractedField[] {
  const html = fs.readFileSync(path.join(__dirname, "../form/__fixtures__", fileName), "utf-8");
  const dom = new JSDOM(html);

  const originalDocument = globalThis.document;
  const originalCSS = (globalThis as { CSS?: typeof CSS }).CSS;
  globalThis.document = dom.window.document;
  (globalThis as { CSS?: typeof CSS }).CSS = dom.window.CSS;
  try {
    return extractFormsInCurrentDocument().flatMap((f) => f.fields);
  } finally {
    globalThis.document = originalDocument;
    (globalThis as { CSS?: typeof CSS }).CSS = originalCSS;
  }
}

async function classifyFixture(fileName: string) {
  const fields = extractFieldsFromFixture(fileName).map((f) => ({ ...f, frameUrl: null }));
  const classifier = new RuleBasedFieldClassifier();
  const classifications = await classifier.classify(fields, { hostKey: "test", formSignatureHash: "test" });
  const categoryByName = new Map(
    fields.map((f) => [f.name, classifications.find((c) => c.fieldSelector === f.selector)?.category]),
  );
  return categoryByName;
}

describe("RuleBasedFieldClassifier against real site fixtures", () => {
  // oh-ami.com: table構造 + f_mail/f_mail_again という素の"mail"のname属性。
  // どちらも実際に本番データでUNKNOWN判定になっていたバグの回帰テスト。
  it("classifies oh-ami.com's table-layout form correctly", async () => {
    const categories = await classifyFixture("oh-ami-inquiry.html");

    expect(categories.get("f_name")).toBe("FULL_NAME");
    expect(categories.get("f_company")).toBe("COMPANY_NAME");
    expect(categories.get("f_mail")).toBe("EMAIL");
    expect(categories.get("f_mail_again")).toBe("EMAIL");
    expect(categories.get("f_tel")).toBe("PHONE");
    expect(categories.get("f_comment")).toBe("INQUIRY_BODY");
  });

  it("classifies kurashi-no-techo.co.jp's CF7 fields using name-attribute patterns", async () => {
    const categories = await classifyFixture("kurashi-no-techo-contact.html");

    expect(categories.get("your-name")).toBe("FULL_NAME");
    expect(categories.get("your-kana")).toBe("FURIGANA");
    expect(categories.get("your-tel")).toBe("PHONE");
    expect(categories.get("your-email")).toBe("EMAIL");
    // your-message1..6 は同じ辞書パターン(内容/message等)に一致するため、選択中の
    // カテゴリに関わらず全て INQUIRY_BODY に分類される。表示されているのは1つだけだが
    // 分類器はどれが表示中か知らない——これが「非表示要素スキップ」で時間だけ短縮し、
    // 未解決のまま残している既知の限界（改善提案の3番目）。
    for (let i = 1; i <= 6; i++) {
      expect(categories.get(`your-message${i}`)).toBe("INQUIRY_BODY");
    }
  });

  // ラベルが取れない(前段のdom-form-parser.test.tsで確認済み)ため、"your-adrs"という
  // name属性だけが手がかりだが、辞書のADDRESSパターンは/住所/と/\baddress\b/のみで
  // 省略形の"adrs"には一致しない。実際に必須項目のご住所が未入力のまま残っている
  // ——このテストは既知のバグとして残し、辞書修正時にここを更新する。
  it("documents a known gap: 'your-adrs' does not match any ADDRESS pattern and stays UNKNOWN", async () => {
    const categories = await classifyFixture("kurashi-no-techo-contact.html");
    expect(categories.get("your-adrs")).toBe("UNKNOWN");
  });
});
