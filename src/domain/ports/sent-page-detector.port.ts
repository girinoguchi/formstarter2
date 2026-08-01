export interface SentPageCheckInput {
  url: string;
  title: string;
  bodyText: string;
}

/**
 * 送信ボタンをクリックした後に表示される「送信完了/サンクスページ」かどうかを判定する。
 * このアプリは送信ボタン自体を絶対にクリックしないため、これは人間が実際に送信した
 * 結果を観測するためだけのポート（能動的な操作は一切行わない）。
 */
export interface SentPageDetector {
  isSentConfirmationPage(input: SentPageCheckInput): boolean;
}
