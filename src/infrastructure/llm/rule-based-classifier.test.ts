import fs from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import type { ParsedFormField } from "../../domain/entities/form-field";
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

  // name属性の"your-adrs"は辞書のADDRESSパターン(/住所/, /\baddress\b/)に一致しないが、
  // dom-form-parserの祖父母sibling fallbackでラベル「ご住所」が取れるようになった
  // ことで、ラベル経由でADDRESSに分類できる（本番の必須項目未入力バグの回帰テスト）。
  it("classifies 'your-adrs' as ADDRESS via the extracted label", async () => {
    const categories = await classifyFixture("kurashi-no-techo-contact.html");
    expect(categories.get("your-adrs")).toBe("ADDRESS");
  });

  // azito.co.jp: 「ご用件」というカテゴリ選択(select)によって、名前・会社名・住所等の
  // 基本項目までJSで条件付き非表示になる実データ。「ご用件」が辞書に無くINQUIRY_TYPEに
  // 分類されないと、カテゴリが選択されないまま基本項目が非表示のままになる実バグが
  // あった（PlaywrightFormFillerのカテゴリ優先処理と対になる回帰テスト）。
  it("classifies azito.co.jp's category select as INQUIRY_TYPE", async () => {
    const categories = await classifyFixture("azito-contact.html");

    expect(categories.get("contact_type")).toBe("INQUIRY_TYPE");
    expect(categories.get("name")).toBe("FULL_NAME");
    expect(categories.get("company_name")).toBe("COMPANY_NAME");
    expect(categories.get("address")).toBe("ADDRESS");
    expect(categories.get("email")).toBe("EMAIL");
    expect(categories.get("content")).toBe("INQUIRY_BODY");
  });

  // amami-tourism.org: 個人情報/プライバシーポリシーへの言及がチェックボックスの
  // labelではなく直前の別要素(<label>で紐付いていない説明文)にあり、チェックボックス
  // 自身のlabelは「同意する」だけというケース。個人情報/プライバシー等の既存パターンに
  // 一致せずUNKNOWNのまま自動同意されなかった実バグの回帰テスト。
  it("classifies a checkbox labeled just '同意する' as CONSENT_CHECKBOX", async () => {
    const field: ParsedFormField = {
      selector: "#agree",
      type: "checkbox",
      name: "agree",
      id: "agree",
      placeholder: null,
      label: "同意する",
      required: false,
      value: null,
      ariaLabel: null,
      autocomplete: null,
      options: null,
      frameUrl: null,
    };
    const classifier = new RuleBasedFieldClassifier();
    const [classification] = await classifier.classify([field], {
      hostKey: "test",
      formSignatureHash: "test",
    });
    expect(classification?.category).toBe("CONSENT_CHECKBOX");
  });

  // intralinks.com/jp/contact: 姓/名が別々の入力欄に分かれており、部署名/役職名が
  // 1つの入力欄にまとまっているフォーム。プロフィールにはfirstName/lastName/
  // department/jobTitleが元々あるのに、対応する分類先が無く一度も使われず
  // 未入力のまま残っていた実バグの回帰テスト。
  describe("classifies split name / department-job-title / industry fields (intralinks.com-style forms)", () => {
    function makeField(overrides: Partial<ParsedFormField>): ParsedFormField {
      return {
        selector: "#field",
        type: "text",
        name: null,
        id: null,
        placeholder: null,
        label: null,
        required: false,
        value: null,
        ariaLabel: null,
        autocomplete: null,
        options: null,
        frameUrl: null,
        ...overrides,
      };
    }

    async function classifyOne(field: ParsedFormField) {
      const classifier = new RuleBasedFieldClassifier();
      const [classification] = await classifier.classify([field], { hostKey: "test", formSignatureHash: "test" });
      return classification?.category;
    }

    it('classifies a field labeled just "名" as FIRST_NAME', async () => {
      expect(await classifyOne(makeField({ label: "名" }))).toBe("FIRST_NAME");
    });

    it('classifies a field labeled just "姓" as LAST_NAME', async () => {
      expect(await classifyOne(makeField({ label: "姓" }))).toBe("LAST_NAME");
    });

    it('classifies "部署名/役職名" as the combined DEPARTMENT_JOB_TITLE category', async () => {
      expect(await classifyOne(makeField({ label: "部署名/役職名" }))).toBe("DEPARTMENT_JOB_TITLE");
    });

    it('classifies a standalone "部署" field as DEPARTMENT (not DEPARTMENT_JOB_TITLE)', async () => {
      expect(await classifyOne(makeField({ label: "部署" }))).toBe("DEPARTMENT");
    });

    it('classifies a standalone "役職" field as JOB_TITLE', async () => {
      expect(await classifyOne(makeField({ label: "役職" }))).toBe("JOB_TITLE");
    });

    it('classifies "業種" as INDUSTRY', async () => {
      expect(await classifyOne(makeField({ label: "業種" }))).toBe("INDUSTRY");
    });

    // "会社名"/"貴社名"は"名"を含むが、FIRST_NAMEの"^名$"は文字列全体が完全に
    // 一致した場合のみ発火するため誤爆しないことの確認。
    it('still classifies "貴社名" as COMPANY_NAME, not FIRST_NAME', async () => {
      expect(await classifyOne(makeField({ label: "貴社名" }))).toBe("COMPANY_NAME");
    });
  });
});
