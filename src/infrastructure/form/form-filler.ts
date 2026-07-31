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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function combineName(last: string, first: string): string | null {
  const combined = [last, first].filter((v) => v.trim() !== "").join(" ");
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
    case "INQUIRY_TYPE":
      return profile.inquiryType || null;
    case "INQUIRY_BODY":
      return profile.inquiryBody || null;
    default:
      return null;
  }
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

    for (const classification of classifications) {
      const field = fieldsBySelector.get(classification.fieldSelector);
      if (!field || classification.category === "UNKNOWN") continue;

      try {
        if (classification.category === "CONSENT_CHECKBOX") {
          if (field.type === "checkbox" && profile.consentPolicy) {
            await session.check(field.selector, {
              timeoutMs: FIELD_FILL_TIMEOUT_MS,
              frameUrl: field.frameUrl ?? undefined,
            });
          }
          continue;
        }

        const rawValue = resolveProfileValue(classification.category, profile);
        if (!rawValue) continue;

        await this.fillOne(session, field, rawValue);
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
      }
    }

    return failures;
  }

  private async fillOne(session: BrowserSession, field: ParsedFormField, value: string): Promise<void> {
    const frameUrl = field.frameUrl ?? undefined;

    if (TEXT_LIKE_FIELD_TYPES.includes(field.type)) {
      await session.fill(field.selector, value, { timeoutMs: FIELD_FILL_TIMEOUT_MS, frameUrl });
      return;
    }

    if (field.type === "select" && field.options) {
      const option = findBestOption(field.options, value);
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
    }
  }
}
