import type { FieldClassification } from "../../domain/entities/field-classification";
import type { FormFieldOption, ParsedFormField } from "../../domain/entities/form-field";
import type { Profile } from "../../domain/entities/profile";
import type { BrowserSession } from "../../domain/ports/browser-session.port";
import type { FieldFillFailure, FormFiller } from "../../domain/ports/form-filler.port";
import type { FieldCategory } from "../../domain/value-objects/field-category";

const TEXT_LIKE_FIELD_TYPES: readonly ParsedFormField["type"][] = [
  "text",
  "email",
  "tel",
  "url",
  "number",
  "textarea",
];

// Playwrightの既定アクションタイムアウト(30秒)は、非表示要素(レスポンシブ対応で
// PC/SP版が重複しているフォーム等)1件あたりに使うには長すぎる。1フィールドの
// 入力失敗が他の全項目を巻き添えにして待たせないよう、短めに設定して早く諦める。
const FIELD_FILL_TIMEOUT_MS = 5_000;

// 汎用的な問い合わせ向けの選択肢。冷やかしではない自社の売り込み内容が、相手サイトの
// 用意した固定カテゴリ(採用について/見積もり依頼等)のどれにも一致しないのは自然な
// ことなので、一致しない場合はこれらの語を含む選択肢を選ぶほうが「未選択のまま」より
// 送信可能な状態に近づける（azito.co.jp等、未選択のままだと基本項目まで条件付き
// 非表示のままになる実データで確認）。kurashi-no-techo.co.jpのように「その他」自体が
// 無いサイトでも「取材」「お問い合わせ」を含む選択肢があれば、雑誌の投稿カテゴリより
// こちらの方が実態に近い。
const OTHER_OPTION_PATTERN = /その他|other|取材|お問い合わせ|お問合せ/i;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function combineName(last: string, first: string): string | null {
  const combined = [last, first].filter((v) => v.trim() !== "").join(" ");
  return combined || null;
}

/** 「部署名/役職名」のように1つの入力欄に両方をまとめて書く必要があるフォーム向け。 */
function combineDepartmentJobTitle(department: string, jobTitle: string): string | null {
  const combined = [department, jobTitle].filter((v) => v.trim() !== "").join(" ");
  return combined || null;
}

function combinePhone(phone1: string, phone2: string, phone3: string): string | null {
  const parts = [phone1, phone2, phone3].filter((v) => v.trim() !== "");
  return parts.length > 0 ? parts.join("-") : null;
}

/**
 * カテゴリからプロフィール値を解決する。氏名・フリガナは、フルネーム欄が空なら
 * 姓+名（フリガナならセイ+メイ）から自動合成する——FormStarterappの
 * 「空欄時は姓＋名から自動入力」という挙動に合わせている。
 */
function resolveProfileValue(category: FieldCategory, profile: Profile): string | null {
  switch (category) {
    case "COMPANY_NAME":
      return profile.companyName || null;
    case "CONTACT_PERSON":
    case "FULL_NAME":
      return profile.fullName || combineName(profile.lastName, profile.firstName);
    case "FIRST_NAME":
      return profile.firstName || null;
    case "LAST_NAME":
      return profile.lastName || null;
    case "FIRST_NAME_KANA":
      return profile.firstNameKana || null;
    case "LAST_NAME_KANA":
      return profile.lastNameKana || null;
    case "FURIGANA":
      return profile.furigana || combineName(profile.lastNameKana, profile.firstNameKana);
    case "EMAIL":
      return profile.email || null;
    case "PHONE":
      return combinePhone(profile.phone1, profile.phone2, profile.phone3);
    case "ADDRESS":
      return profile.address || null;
    case "POSTAL_CODE":
      return profile.postalCode || null;
    case "URL":
      return profile.websiteUrl || null;
    case "DEPARTMENT":
      return profile.department || null;
    case "JOB_TITLE":
      return profile.jobTitle || null;
    case "DEPARTMENT_JOB_TITLE":
      return combineDepartmentJobTitle(profile.department, profile.jobTitle);
    case "INDUSTRY":
      return profile.industry || null;
    case "INQUIRY_TYPE":
      return profile.inquiryType || null;
    case "INQUIRY_BODY":
      return profile.inquiryBody || null;
    default:
      return null;
  }
}

/**
 * 「その他」的な選択肢も無いカテゴリ選択(kurashi-no-techo.co.jp等、雑誌の投稿種別
 * のように自社サイト固有の選択肢しか無く「その他」が存在しないケースがある)では、
 * プレースホルダ(value=""の「選択してください」等)を除いた最初の実在する選択肢を選ぶ。
 * 未選択のまま(プレースホルダのまま)にしておくより、何かしら選んで条件付き非表示の
 * 項目を出現させたほうが送信可能な状態に近づける。
 */
function firstRealOption(options: readonly FormFieldOption[]): FormFieldOption | undefined {
  return options.find((o) => o.value.trim() !== "");
}

function findBestOption(options: readonly FormFieldOption[], target: string): FormFieldOption | null {
  const normalizedTarget = normalize(target);
  const exact = options.find(
    (o) => normalize(o.label) === normalizedTarget || normalize(o.value) === normalizedTarget,
  );
  if (exact) return exact;

  const partial = options.find(
    (o) => normalize(o.label).includes(normalizedTarget) || normalizedTarget.includes(normalize(o.label)),
  );
  return partial ?? null;
}

/**
 * 分類済みフィールドにプロフィール値を入力する。UNKNOWNは推測で埋めず未入力のままにし、
 * checkboxはCONSENT_CHECKBOXに分類され、かつprofile.consentPolicyがtrueの場合のみONにする。
 * このクラスに送信ボタンを操作するメソッドは存在しない（FormFillerポート自体の設計制約）。
 */
export class PlaywrightFormFiller implements FormFiller {
  async fill(
    session: BrowserSession,
    fields: readonly ParsedFormField[],
    classifications: readonly FieldClassification[],
    profile: Profile,
  ): Promise<readonly FieldFillFailure[]> {
    const fieldsBySelector = new Map(fields.map((f) => [f.selector, f]));
    const failures: FieldFillFailure[] = [];

    // 「ご用件」等のカテゴリ選択(INQUIRY_TYPE)によって他のフィールドの表示/非表示が
    // JSで切り替わる条件付きフォーム(azito.co.jp等の実データで確認、未選択のままだと
    // 名前・会社名・住所等の基本項目までCSSで非表示のままになっていた)があるため、
    // INQUIRY_TYPEを先に処理し、JS側の表示切り替えが反映されるのを少し待ってから
    // 残りのフィールドを処理する。
    const inquiryTypeClassifications = classifications.filter((c) => c.category === "INQUIRY_TYPE");
    const restClassifications = classifications.filter((c) => c.category !== "INQUIRY_TYPE");

    let selectedInquiryType = false;
    for (const classification of inquiryTypeClassifications) {
      const filled = await this.fillClassification(session, fieldsBySelector, classification, profile, failures);
      if (filled) selectedInquiryType = true;
    }

    if (selectedInquiryType) {
      await session.wait(500);
    }

    for (const classification of restClassifications) {
      await this.fillClassification(session, fieldsBySelector, classification, profile, failures);
    }

    return failures;
  }

  /** 1フィールド分の入力を試みる。成功したかどうかを返し、失敗はfailuresへベストエフォートで記録する。 */
  private async fillClassification(
    session: BrowserSession,
    fieldsBySelector: ReadonlyMap<string, ParsedFormField>,
    classification: FieldClassification,
    profile: Profile,
    failures: FieldFillFailure[],
  ): Promise<boolean> {
    const field = fieldsBySelector.get(classification.fieldSelector);
    if (!field || classification.category === "UNKNOWN") return false;

    try {
      if (classification.category === "CONSENT_CHECKBOX") {
        if (field.type === "checkbox" && profile.consentPolicy) {
          const frameUrl = field.frameUrl ?? undefined;
          if (!(await session.isVisible(field.selector, { frameUrl }))) {
            throw new Error(`要素が非表示のためスキップしました: ${field.selector}`);
          }
          await session.check(field.selector, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
          return true;
        }
        return false;
      }

      const rawValue = resolveProfileValue(classification.category, profile);
      if (!rawValue) return false;

      await this.fillOne(session, field, rawValue, classification.category);
      return true;
    } catch (error) {
      // 1項目の入力失敗（非表示要素等）で他の項目の入力を止めない。
      // ベストエフォートで続行し、失敗した項目だけ呼び出し側に報告する。
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        fieldSelector: field.selector,
        fieldLabel: field.label,
        category: classification.category,
        required: field.required,
        message,
      });
      return false;
    }
  }

  private async fillOne(
    session: BrowserSession,
    field: ParsedFormField,
    value: string,
    category: FieldCategory,
  ): Promise<void> {
    const frameUrl = field.frameUrl ?? undefined;

    // 非表示要素（レスポンシブ対応の重複フィールドや、他の選択肢用に隠れている
    // 条件付きフィールド等）に通常のfill()等を試みると、要素が見えるようになるまで
    // タイムアウト分待ってから失敗する。事前に可視性を見ておけば即座にスキップでき、
    // 無関係な非表示フィールドが何十件もあるフォーム（CF7の条件分岐等）で
    // 待ち時間が積み上がるのを防げる。
    if (!(await session.isVisible(field.selector, { frameUrl }))) {
      throw new Error(`要素が非表示のためスキップしました: ${field.selector}`);
    }

    if (TEXT_LIKE_FIELD_TYPES.includes(field.type)) {
      await session.fill(field.selector, value, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
      return;
    }

    if (field.type === "select" && field.options) {
      const option =
        findBestOption(field.options, value) ??
        (category === "INQUIRY_TYPE"
          ? (field.options.find((o) => OTHER_OPTION_PATTERN.test(o.label)) ?? firstRealOption(field.options))
          : undefined);
      if (option) {
        await session.selectOption(field.selector, option.value, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
      }
      return;
    }

    if (field.type === "radio") {
      const candidateText = `${field.label ?? ""} ${field.value ?? ""}`;
      if (normalize(candidateText).includes(normalize(value))) {
        await session.check(field.selector, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
      }
      return;
    }

    // 「ご用件」等のカテゴリ選択がradio/selectではなくcheckboxの複数選択肢（1つの選択肢
    // ＝1つのフィールド）として実装されているフォームがある（fujiiryoki.co.jp等の実データ
    // で確認）。selectと同様、profile.inquiryTypeに一致する選択肢が無ければ「その他/
    // お問い合わせ」的な選択肢にフォールバックする。
    if (field.type === "checkbox" && category === "INQUIRY_TYPE") {
      const candidateText = `${field.label ?? ""} ${field.value ?? ""}`;
      if (normalize(candidateText).includes(normalize(value)) || OTHER_OPTION_PATTERN.test(candidateText)) {
        await session.check(field.selector, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
      }
    }
  }
}
