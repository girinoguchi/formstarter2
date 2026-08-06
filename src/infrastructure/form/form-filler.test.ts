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
  ownerId: "u1",
  name: "test",
  companyName: "テスト株式会社",
  companyNameKana: "",
  lastName: "山田",
  firstName: "太郎",
  fullName: "山田太郎",
  lastNameKana: "",
  firstNameKana: "",
  furigana: "",
  department: "営業部",
  jobTitle: "課長",
  industry: "IT・ソフトウェア",
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

  it("prefers an option mentioning 取材/お問い合わせ over an unrelated first option", async () => {
    // kurashi-no-techo.co.jpの投稿種別選択のように「その他」自体は無いが、
    // 「小社への取材に関するお問い合わせ」のような汎用の問い合わせ寄りの選択肢がある
    // 場合は、雑誌の投稿カテゴリ(読者の手帖等)より先にそちらを選ぶ。
    const categoryField = field({
      selector: "#category",
      type: "select",
      options: [
        { value: "", label: "選択してください" },
        { value: "reader", label: "読者の手帖" },
        { value: "apron", label: "エプロンメモ" },
        { value: "press", label: "小社への取材に関するお問い合わせ" },
      ],
    });
    const classifications: FieldClassification[] = [
      { fieldSelector: "#category", fieldLabel: "ご用件", category: "INQUIRY_TYPE", source: "RULE", confidence: 0.8 },
    ];

    const session = new FakeSession();
    await new PlaywrightFormFiller().fill(session, [categoryField], classifications, PROFILE);

    expect(session.calls).toContain("select:#category=press");
  });

  it("falls back to the first real option when nothing generic-sounding exists either", async () => {
    // 「その他」も「取材」「お問い合わせ」を含む選択肢も無いケース。
    // プレースホルダ(空欄)を除いた最初の選択肢を選ぶ。
    const categoryField = field({
      selector: "#category",
      type: "select",
      options: [
        { value: "", label: "選択してください" },
        { value: "reader", label: "読者の手帖" },
        { value: "apron", label: "エプロンメモ" },
      ],
    });
    const classifications: FieldClassification[] = [
      { fieldSelector: "#category", fieldLabel: "ご用件", category: "INQUIRY_TYPE", source: "RULE", confidence: 0.8 },
    ];

    const session = new FakeSession();
    await new PlaywrightFormFiller().fill(session, [categoryField], classifications, PROFILE);

    expect(session.calls).toContain("select:#category=reader");
  });
});

describe("PlaywrightFormFiller split name / department / industry fields", () => {
  // intralinks.com/jp/contact: 姓・名が別々の入力欄で、部署名/役職名が1つの
  // 入力欄にまとまっているフォーム。プロフィールにfirstName/lastName/department/
  // jobTitleが元々あるのに分類先が無く未入力のまま残っていた実バグの回帰テスト。
  it("fills separate first-name/last-name fields and a combined department/job-title field", async () => {
    // FakeSessionのisVisible()はカテゴリ選択(#category)が済むまでtrueを返さない
    // （条件付きフォームの再現用の作り）ため、他のテストと同様にダミーの
    // INQUIRY_TYPE分類を先に処理させて可視状態にする。
    const categoryField = field({ selector: "#category", type: "select", options: [{ value: "1", label: "その他" }] });
    const firstNameField = field({ selector: "#first", label: "名" });
    const lastNameField = field({ selector: "#last", label: "姓" });
    const deptTitleField = field({ selector: "#dept-title", label: "部署名/役職名" });
    const industryField = field({
      selector: "#industry",
      type: "select",
      label: "業種",
      options: [
        { value: "it", label: "IT・ソフトウェア" },
        { value: "finance", label: "金融" },
      ],
    });
    const fields = [categoryField, firstNameField, lastNameField, deptTitleField, industryField];
    const classifications: FieldClassification[] = [
      { fieldSelector: "#category", fieldLabel: "ご用件", category: "INQUIRY_TYPE", source: "RULE", confidence: 0.8 },
      { fieldSelector: "#first", fieldLabel: "名", category: "FIRST_NAME", source: "RULE", confidence: 0.8 },
      { fieldSelector: "#last", fieldLabel: "姓", category: "LAST_NAME", source: "RULE", confidence: 0.8 },
      {
        fieldSelector: "#dept-title",
        fieldLabel: "部署名/役職名",
        category: "DEPARTMENT_JOB_TITLE",
        source: "RULE",
        confidence: 0.8,
      },
      { fieldSelector: "#industry", fieldLabel: "業種", category: "INDUSTRY", source: "RULE", confidence: 0.8 },
    ];

    const session = new FakeSession();
    const failures = await new PlaywrightFormFiller().fill(session, fields, classifications, PROFILE);

    expect(failures).toHaveLength(0);
    expect(session.calls).toContain("fill:#first=太郎");
    expect(session.calls).toContain("fill:#last=山田");
    expect(session.calls).toContain("fill:#dept-title=営業部 課長");
    expect(session.calls).toContain("select:#industry=it");
  });
});
