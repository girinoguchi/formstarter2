import type { SentPageCheckInput, SentPageDetector } from "../../domain/ports/sent-page-detector.port";

// 「確認画面」（ConfirmationPageDetectorのCONFIRM/SEND判定）とは別物——こちらは
// 送信ボタンが押された"後"に表示される完了ページの文言を対象にする。
const SENT_TEXT_PATTERN =
  /送信(が)?完了|送信されました|送信いたしました|受け付けました|受付(が)?完了|お問い合わせ(いただき)?ありがとうござ|ご入力ありがとうござ|thank you for|successfully sent|submission received|message (has been )?sent|we('| )ve received your/i;

export class HeuristicSentPageDetector implements SentPageDetector {
  isSentConfirmationPage(input: SentPageCheckInput): boolean {
    const text = `${input.title} ${input.bodyText}`;
    return SENT_TEXT_PATTERN.test(text);
  }
}
