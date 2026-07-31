/** ブラウザを起動せずに「このページに入力可能なフォームがあるか」を判定するポート。 */
export interface StaticFormChecker {
  hasFillableForm(url: string): Promise<boolean>;
}
