import type { FieldClassification } from "../../domain/entities/field-classification";
import type { ParsedFormField } from "../../domain/entities/form-field";
import type { FieldClassifier, FieldClassifierContext } from "../../domain/ports/field-classifier.port";
import { ALIAS_RULES } from "./alias-dictionary";

const CLASSIFIABLE_TYPES: readonly string[] = [
  "text",
  "email",
  "tel",
  "url",
  "number",
  "textarea",
  "select",
  "checkbox",
  "radio",
];

/**
 * name/id属性は company_name / phone_number1 のようなスネークケースで書かれることが
 * 多いが、辞書側の正規表現（[\s-]*やword boundaryの\bを使ったもの）はアンダースコアを
 * 区切りとして認識しない（\bは_を単語文字とみなすため会社名等が誤ってUNKNOWNになる
 * 実バグがあった）。ここでアンダースコアをスペースに正規化し、辞書側のパターンを
 * 個別に増やさずに広く一致させる。
 */
function buildSearchText(field: ParsedFormField): string {
  return [field.label, field.name, field.id, field.placeholder, field.ariaLabel]
    .filter((v): v is string => !!v)
    .join(" ")
    .replace(/_/g, " ");
}

export class RuleBasedFieldClassifier implements FieldClassifier {
  async classify(
    fields: readonly ParsedFormField[],
    _context: FieldClassifierContext,
  ): Promise<readonly FieldClassification[]> {
    return fields.filter((f) => CLASSIFIABLE_TYPES.includes(f.type)).map((f) => this.classifyField(f));
  }

  private classifyField(field: ParsedFormField): FieldClassification {
    const searchText = buildSearchText(field);

    for (const rule of ALIAS_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(searchText))) {
        return {
          fieldSelector: field.selector,
          fieldLabel: field.label,
          category: rule.category,
          source: "RULE",
          confidence: 0.8,
        };
      }
    }

    // テキストで判定できない場合、type由来の妥当な既定値にフォールバックする。
    if (field.type === "email") return this.withCategory(field, "EMAIL", 0.5);
    if (field.type === "tel") return this.withCategory(field, "PHONE", 0.5);
    if (field.type === "textarea") return this.withCategory(field, "INQUIRY_BODY", 0.4);

    return this.withCategory(field, "UNKNOWN", 0);
  }

  private withCategory(
    field: ParsedFormField,
    category: FieldClassification["category"],
    confidence: number,
  ): FieldClassification {
    return {
      fieldSelector: field.selector,
      fieldLabel: field.label,
      category,
      source: "RULE",
      confidence,
    };
  }
}
