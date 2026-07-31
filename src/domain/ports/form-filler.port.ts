import type { FieldClassification } from "../entities/field-classification";
import type { ParsedFormField } from "../entities/form-field";
import type { Profile } from "../entities/profile";
import type { FieldCategory } from "../value-objects/field-category";
import type { BrowserSession } from "./browser-session.port";

/** 個別フィールドへの入力に失敗した記録（要素が非表示/操作不能等）。UNKNOWN分類による未入力とは区別する。 */
export interface FieldFillFailure {
  fieldSelector: string;
  fieldLabel: string | null;
  category: FieldCategory;
  required: boolean;
  message: string;
}

/**
 * 送信ボタンをクリックするメソッドは意図的に定義しない。
 * これにより「自動送信する」というコードパス自体が型レベルで存在し得ない。
 *
 * fields（type/options等の構造情報）とclassifications（意味づけ）を両方受け取るのは、
 * 「textならfill、selectならselectOption、checkboxは同意項目のみcheck」といった
 * 入力方法の判断にDOM構造の情報が不可欠なため。
 *
 * 1項目の入力失敗（非表示要素等）で残り全項目の入力が巻き添えで止まらないよう、
 * fill()はフィールドごとに独立して試行し、失敗した項目だけを戻り値で報告する
 * （呼び出し側=RunOrchestratorがログとステータス判定に使う）。
 */
export interface FormFiller {
  fill(
    session: BrowserSession,
    fields: readonly ParsedFormField[],
    classifications: readonly FieldClassification[],
    profile: Profile,
  ): Promise<readonly FieldFillFailure[]>;
}
