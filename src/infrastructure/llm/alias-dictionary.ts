import type { FieldCategory } from "../../domain/value-objects/field-category";

export interface AliasRule {
  category: FieldCategory;
  patterns: readonly RegExp[];
}

/**
 * 上から順に評価し、最初にマッチしたカテゴリを採用する（スコアリングではなく優先順位方式）。
 * 「会社名」より先に「名前」系の緩いパターンを置くと会社名フィールドを誤爆するため、
 * 具体的なパターンを先、汎用的なパターンを後ろに置く順序が重要。
 */
export const ALIAS_RULES: readonly AliasRule[] = [
  {
    category: "POSTAL_CODE",
    patterns: [/郵便番号/, /〒/, /zip\s*code/i, /postal\s*code/i, /postcode/i],
  },
  {
    category: "FURIGANA",
    patterns: [/フリガナ/, /ふりがな/, /かな/, /\bkana\b/i],
  },
  // 「Company email」「Company website」のように company が修飾語として付く複合語があるため、
  // EMAIL/PHONE/URL/ADDRESS はCOMPANY_NAMEより先に評価する
  // ——後ろに置くと \bcompany\b がそれらを横取りしてしまう。
  {
    category: "EMAIL",
    patterns: [/メールアドレス/, /メール/, /e-?mail/i],
  },
  {
    category: "PHONE",
    patterns: [/電話番号/, /電話/, /\btel\b/i, /phone/i],
  },
  {
    category: "URL",
    patterns: [/ホームページ/, /web[\s-]*site/i, /website/i, /サイトurl/i, /^url$/i],
  },
  {
    category: "ADDRESS",
    patterns: [/住所/, /\baddress\b/i],
  },
  {
    category: "COMPANY_NAME",
    patterns: [
      /会社名/,
      /法人名/,
      /御社名/,
      /貴社名/,
      /company[\s-]*name/i,
      /organization/i,
      /organisation/i,
      /\bcompany\b/i,
    ],
  },
  {
    category: "CONTACT_PERSON",
    patterns: [/ご担当者/, /担当者/, /person[\s-]*in[\s-]*charge/i, /contact[\s-]*person/i],
  },
  {
    category: "FULL_NAME",
    patterns: [/お名前/, /氏名/, /full[\s-]*name/i, /your[\s-]*name/i, /^name$/i],
  },
  {
    category: "INQUIRY_TYPE",
    patterns: [/お問い合わせ種別/, /種別/, /件名/, /\bsubject\b/i, /inquiry[\s-]*type/i, /\bcategory\b/i],
  },
  {
    category: "INQUIRY_BODY",
    patterns: [
      /お問い合わせ内容/,
      /ご相談内容/,
      /内容/,
      /メッセージ/,
      /\bmessage\b/i,
      /inquiry/i,
      /comments?/i,
      /how can we help/i,
    ],
  },
  {
    category: "CONSENT_CHECKBOX",
    patterns: [/個人情報/, /プライバシー/, /privacy[\s-]*policy/i, /利用規約/, /\bagree\b/i, /\bconsent\b/i],
  },
];
