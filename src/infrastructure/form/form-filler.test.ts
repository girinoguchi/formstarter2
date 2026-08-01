import { describe, expect, it } from "vitest";

import type { FieldClassification } from "../../domain/entities/field-classification";
import type { ParsedFormField } from "../../domain/entities/form-field";
import type { Profile } from "../../domain/entities/profile";
import type { BrowserSession } from "../../domain/ports/browser-session.port";
import { PlaywrightFormFiller } from "./form-filler";

/**
 * 実操作なしでfill()の呼び出し順序・値を記録するだけのフェイクセッション。
 * 「非表示」判定はカテゴリ選択(INQUIRY_TYPE)を行うまでtrueにならないようにして、
 * azito.co.jp等の条件付きフォームの実際の挙動（未選択のうちは基本項目が非表示）を再現する。
 */
class FakeSession implements BrowserSession {
  readonly currentUrl = "https://example.com/contact";
  readonly calls: string[] = [];
  private categorySelected = false;

  async goto() {
    return { status: 200 };
  }
  async content() {
    return "";
  }
  async evaluate<T>(): Promise<T> {
    return undefined as T;
  }
  async listFrameUrls() {
    return [];
  }
  async fill(selector: string, value: string) {
    this.calls.push(`fill:${selector}=${value}`);
  }
  async check(selector: string) {
    this.calls.push(`check:${selector}`);
  }
  async uncheck() {}
  async selectOption(selector: string, value: string) {
    this.calls.push(`select:${selector}=${value}`);
    if (selector === "#category") this.categorySelected = true;
  }
  async click() {}
  async isVisible(selector: string) {
    if (selector === "#category") return true;
    return this.categorySelected;
  }
  async textContent() {
    return null;
  }
  async wait(ms: number) {
    this.calls.push(`wait:${ms}`);
  }
  async screenshot() {
    return Buffer.from("");
  }
  async close() {}
  async waitForClose() {}
  onNavigation() {}
}

function field(overrides: Partial<ParsedFormField>): ParsedFormField {
  return {
    selector: overrides.selector ?? "#field",
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

const PROFILE: Profile = {
  id: "p1",
  name: "test",
  isActive: true,
  companyName: "テスト株式会社",
  companyNameKana: "",
  lastName: "山田",
  firstName: "太郎",
  fullName: "山田太郎",
  lastNameKana: "",
  firstNameKana: "",
  furigana: "",
  department: "",
  jobTitle: "",
  industry: "",
  employeeCount: "",
  email: "test@example.com",
  phone1: "03",
  phone2: "1234",
  phone3: "5678",
  postalCode: "",
  address: "東京都",
  websiteUrl: "",
  inquiryType: "とある新規開拓のご案内",
  inquiryBody: "お世話になります。",
  consentPolicy: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PlaywrightFormFiller conditional-category forms", () => {
  it("fills INQUIRY_TYPE before other fields and waits for the JS-driven reveal", async () => {
    const categoryField = field({ selector: "#category", type: "select", options: [{ value: "1", label: "その他" }] });
    const nameField = field({ selector: "#name", type: "text" });
    const fields = [categoryField, nameField];
    const classifications: FieldClassification[] = [
      { fieldSelector: "#category", fieldLabel: "ご用件", category: "INQUIRY_TYPE", source: "RULE", confidence: 0.8 },
      { fieldSelector: "#name", fieldLabel: "お名前", category: "FULL_NAME", source: "RULE", confidence: 0.8 },
    ];

    const session = new FakeSession();
    const failures = await new PlaywrightFormFiller().fill(session, fields, classifications, PROFILE);

    expect(failures).toHaveLength(0);
    // カテゴリ選択→wait→残りのフィールドの順で呼ばれている（先に名前欄を埋めようとして
    // 非表示エラーになっていないこと）ことを確認する。
    expect(session.calls).toEqual(["select:#category=1", "wait:500", "fill:#name=山田太郎"]);
  });

  it("falls back to a 'その他' option when no option matches the profile's inquiry type", async () => {
    const categoryField = field({
      selector: "#category",
      type: "select",
      options: [
        { value: "1", label: "採用について" },
        { value: "2", label: "見積もり依頼" },
        { value: "3", label: "その他" },
      ],
    });
    const classifications: FieldClassification[] = [
      { fieldSelector: "#category", fieldLabel: "ご用件", category: "INQUIRY_TYPE", source: "RULE", confidence: 0.8 },
    ];

    const session = new FakeSession();
    await new PlaywrightFormFiller().fill(session, [categoryField], classifications, PROFILE);

    // "とある新規開拓のご案内"はどの選択肢にも一致しないため、「その他」が選ばれる。
    expect(session.calls).toContain("select:#category=3");
  });
});
