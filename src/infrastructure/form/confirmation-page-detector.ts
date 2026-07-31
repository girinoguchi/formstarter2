import type { ParsedFormField } from "../../domain/entities/form-field";
import type { ConfirmationPageDetector } from "../../domain/ports/confirmation-page-detector.port";

const CONFIRM_TEXT_PATTERN = /確認する|確認画面|入力内容を確認|次へ進む|次へ|review|continue/i;
const SEND_TEXT_PATTERN =
  /送信する|送信|申し込む|申込|request|submit|send|talk to|contact us|get started|get in touch/i;

export class HeuristicConfirmationPageDetector implements ConfirmationPageDetector {
  findSafeConfirmButton(fields: readonly ParsedFormField[]): ParsedFormField | null {
    const buttons = fields.filter((f) => f.type === "submit" || f.type === "button");

    for (const button of buttons) {
      const text = `${button.label ?? ""} ${button.value ?? ""}`.trim();
      if (!text) continue;

      // 送信っぽい文言を少しでも含む場合は安全側に倒し、クリック対象にしない。
      if (SEND_TEXT_PATTERN.test(text)) continue;
      if (CONFIRM_TEXT_PATTERN.test(text)) return button;
    }

    return null;
  }
}
