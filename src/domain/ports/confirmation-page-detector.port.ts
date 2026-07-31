import type { ParsedFormField } from "../entities/form-field";

/**
 * 「確認/次へ」ボタンと「送信」ボタンを区別する。送信ボタンは絶対にクリックしないという
 * アプリ全体の制約を守るため、少しでも送信っぽい文言なら安全側に倒してnullを返す
 * （＝クリック対象なしとして扱う）実装であることをポート契約として明記する。
 */
export interface ConfirmationPageDetector {
  findSafeConfirmButton(fields: readonly ParsedFormField[]): ParsedFormField | null;
}
