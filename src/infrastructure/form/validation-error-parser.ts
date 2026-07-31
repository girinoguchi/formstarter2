import type { BrowserSession } from "../../domain/ports/browser-session.port";
import type { ValidationErrorField, ValidationErrorParser } from "../../domain/ports/validation-error-parser.port";

/**
 * DomFormParserが各フィールドに付与したdata-fs-idx属性を目印に、
 * ブラウザのネイティブバリデーション（:invalid）とaria-invalid="true"の両方を検出する。
 * カスタムのエラーメッセージ文言はサイトごとに千差万別なため、
 * 「どのフィールドがエラーか」の特定に留め、メッセージ内容の抽出はベストエフォートとしない。
 * frameUrlを渡すと、フォームがiframe内にある場合でもそのフレームのDOMを検査する。
 */
export class DomValidationErrorParser implements ValidationErrorParser {
  async findErrors(session: BrowserSession, frameUrl?: string): Promise<readonly ValidationErrorField[]> {
    return session.evaluate<ValidationErrorField[]>(
      () => {
        const selectors = new Set<string>();

        document.querySelectorAll(":invalid").forEach((el) => {
          const idx = el.getAttribute("data-fs-idx");
          if (idx) selectors.add(idx);
        });

        document.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
          const idx = el.getAttribute("data-fs-idx");
          if (idx) selectors.add(idx);
        });

        return Array.from(selectors).map((idx) => ({
          selector: `[data-fs-idx="${idx}"]`,
          message: null,
        }));
      },
      undefined,
      { frameUrl },
    );
  }
}
