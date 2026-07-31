export type FormFieldType =
  | "text"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "button"
  | "submit"
  | "hidden"
  | "other";

export interface FormFieldOption {
  value: string;
  label: string;
}

/**
 * DOMから抽出した1フィールド分のメタデータ。selectorは同一フレーム内で
 * このフィールドを一意に再取得するためのCSSセレクタ（fill/click時に使用）。
 * frameUrlは、このフィールドがトップページではなくiframe内にある場合の
 * そのiframeのURL（BrowserSessionがfill/click等で正しいフレームへ
 * ルーティングするために使う）。トップページ直下のフィールドはnull。
 */
export interface ParsedFormField {
  selector: string;
  type: FormFieldType;
  name: string | null;
  id: string | null;
  placeholder: string | null;
  label: string | null;
  required: boolean;
  value: string | null;
  ariaLabel: string | null;
  autocomplete: string | null;
  options: readonly FormFieldOption[] | null;
  frameUrl: string | null;
}

export interface ParsedForm {
  formSelector: string;
  fields: readonly ParsedFormField[];
  frameUrl: string | null;
}
