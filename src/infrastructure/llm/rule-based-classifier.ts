import type { FieldClassification } from "../../domain/entities/field-classification";
import type { FormFieldOption, ParsedFormField } from "../../domain/entities/form-field";
import type { FieldClassifier, FieldClassifierContext } from "../../domain/ports/field-classifier.port";
import { JAPAN_PREFECTURES } from "../../domain/value-objects/prefectures";
import { ALIAS_RULES } from "./alias-dictionary";

// 都道府県プルダウンは、見出し（「都道府県」等）が実際の入力欄と離れた場所にある
// 古いtableレイアウトのフォームではラベルを正しく拾えないことがある(fujiiryoki.co.jp等の
// 実データで確認)。選択肢そのものが47都道府県の固定リストという強いシグナルなので、
// ラベルに依存せず選択肢の中身で判定できる。プレースホルダ("---お選びください---"等)を
// 含め多少のブレを許容するため、全47件ではなく閾値以上の一致で判定する。
const PREFECTURE_SELECT_MATCH_THRESHOLD = 30;

function isPrefectureSelect(options: readonly FormFieldOption[] | null): boolean {
  if (!options) return false;
  const matchCount = options.filter((o) => JAPAN_PREFECTURES.includes(o.label.trim())).length;
  return matchCount >= PREFECTURE_SELECT_MATCH_THRESHOLD;
}

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

/**
 * ラベル専用パターン用にラベル文字列を整える。
 *
 * ラベル要素には必須マーカーが一緒に入ることが多い（<label>Name <span>Required</span></label>
 * のような構造で、textContentは"Name Required"になる）。一語のラベルを判別したいので、
 * この種の飾りを落としてから照合する。連結文字列側(patterns)には手を入れない。
 */
function normalizeLabelForMatching(label: string | null): string {
  if (!label) return "";
  return label
    .replace(/\s+/g, " ")
    .replace(/[（(\[【]?\s*(必須|任意|required|optional|mandatory)\s*[)）\]】]?/gi, " ")
    .replace(/[*＊※:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const labelText = normalizeLabelForMatching(field.label);

    for (const rule of ALIAS_RULES) {
      const matched =
        rule.patterns.some((pattern) => pattern.test(searchText)) ||
        (labelText !== "" && (rule.labelPatterns?.some((pattern) => pattern.test(labelText)) ?? false));
      if (matched) {
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
    if (field.type === "select" && isPrefectureSelect(field.options)) {
      return this.withCategory(field, "PREFECTURE", 0.7);
    }

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
