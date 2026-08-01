import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import type { StaticFormChecker as StaticFormCheckerPort } from "../../domain/ports/static-form-checker.port";

const FILLABLE_INPUT_SELECTOR =
  'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';

// run-orchestrator.tsのlooksLikeContactForm/scoreFormと同じ判定基準
// （氏名/メールらしき項目があるか、3項目以上あるか）。サイト内検索・
// ニュースレター購読フォーム等をここで弾かないと、フォームタグが1件
// あるというだけでREADYになってしまう実バグがあった。
const EMAIL_PATTERN = /email|mail|メール/i;
const NAME_PATTERN = /name|氏名|お名前|担当者/i;

/**
 * fetch + Cheerio のみで「このページに入力可能な“問い合わせフォームらしい”フォームが
 * あるか」を判定する。FormStarterapp同様、ブラウザを起動せずに済むケース
 * （静的HTMLのフォーム）をここで先に確定させ、JS描画が必要なサイトだけ
 * Playwrightにフォールバックする。
 */
export function looksLikeContactForm($: cheerio.CheerioAPI, form: AnyNode): boolean {
  const fields = $(form).find(FILLABLE_INPUT_SELECTOR).toArray();
  if (fields.length === 0) return false;
  if (fields.length >= 3) return true;

  const hints = fields
    .map((field) => {
      const $field = $(field);
      return [$field.attr("type"), $field.attr("name"), $field.attr("id"), $field.attr("placeholder")]
        .filter(Boolean)
        .join(" ");
    })
    .join(" ");
  return EMAIL_PATTERN.test(hints) || NAME_PATTERN.test(hints);
}

export class StaticFormChecker implements StaticFormCheckerPort {
  async hasFillableForm(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) return false;
      const html = await res.text();
      const $ = cheerio.load(html);
      return $("form")
        .toArray()
        .some((form) => looksLikeContactForm($, form));
    } catch {
      return false;
    }
  }
}
