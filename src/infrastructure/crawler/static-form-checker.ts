import * as cheerio from "cheerio";

import type { StaticFormChecker as StaticFormCheckerPort } from "../../domain/ports/static-form-checker.port";

const FILLABLE_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';

/**
 * fetch + Cheerio のみで「このページに入力可能なフォームがあるか」を判定する。
 * FormStarterapp同様、ブラウザを起動せずに済むケース（静的HTMLのフォーム）を
 * ここで先に確定させ、JS描画が必要なサイトだけPlaywrightにフォールバックする。
 */
export class StaticFormChecker implements StaticFormCheckerPort {
  async hasFillableForm(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return false;
      const html = await res.text();
      const $ = cheerio.load(html);
      return $("form")
        .toArray()
        .some((form) => $(form).find(FILLABLE_INPUT_SELECTOR).length > 0);
    } catch {
      return false;
    }
  }
}
