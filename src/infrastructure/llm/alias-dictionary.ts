import type { FieldCategory } from "../../domain/value-objects/field-category";

export interface AliasRule {
  category: FieldCategory;
  /** label/name/id/placeholder/aria-labelを連結した文字列に対して照合する。 */
  patterns: readonly RegExp[];

  /**
   * 人に見えているラベルだけに対して照合するパターン。空白は前後除去・連続分は1つに畳む。
   *
   * 連結した文字列では「Name」のような一語のラベルを拾えない。^name$ は連結後の全体が
   * ちょうど"name"のときしか当たらず、属性が1つでもあれば外れるためで、かといって
   * 部分一致にすると file_name / campaign_name のような無関係な属性名まで拾ってしまう。
   * ラベルは人が読む文字列なので、そこだけを見れば一語でも十分に判別できる。
   */
  labelPatterns?: readonly RegExp[];
}

/**
 * 上から順に評価し、最初にマッチしたカテゴリを採用する（スコアリングではなく優先順位方式）。
 * 「会社名」より先に「名前」系の緩いパターンを置くと会社名フィールドを誤爆するため、
 * 具体的なパターンを先、汎用的なパターンを後ろに置く順序が重要。
 */
export const ALIAS_RULES: readonly AliasRule[] = [
  {
    category: "POSTAL_CODE",
    // "Post code"（スペース/ハイフン区切り）を明示的に持つ。これが無いと、後段の
    // JOB_TITLEに追加した /\bpost\b/ が郵便番号欄を役職として拾ってしまう。
    patterns: [/郵便番号/, /〒/, /zip\s*code/i, /postal\s*code/i, /post[\s-]*code/i],
  },
  {
    // フリガナ欄が「姓：　名：」のように1つの見出しの下に2つの入力欄へ分かれているケース
    // (fujiiryoki.co.jpの外部フォームサービス埋め込み等の実データで確認)、dom-form-parser側で
    // 「姓（フリガナ）」「名（フリガナ）」という合成ラベルを組み立てて渡してくる。
    // 汎用のFURIGANAパターン(/フリガナ/)より先に評価しないと、そちらに横取りされ
    // 姓名どちらの欄かを区別できないまま同じ1つの結合フリガナ値が入ってしまう。
    category: "LAST_NAME_KANA",
    patterns: [/姓（フリガナ）/],
  },
  {
    category: "FIRST_NAME_KANA",
    patterns: [/名（フリガナ）/],
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
    // f_mail/mail_addressのように"email"ではなく素の"mail"だけのname属性が
    // 実データ(oh-ami.com等)にあり、e-?mailだけでは拾えていなかった。
    // \bmail\bはbuildSearchText側でアンダースコアをスペース化してから評価されるため、
    // f_mail→"f mail"となり単語境界として正しくマッチする。
    patterns: [/メールアドレス/, /メール/, /e-?mail/i, /\bmail\b/i],
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
    // ラベルが「Name」だけの英語フォーム（cloud.swcms.netのsigmaxyz等）は、連結後が
    // "Name name"になるため^name$に当たらず未入力のまま残っていた。
    labelPatterns: [/^name$/i, /^your name$/i, /^full name$/i],
  },
  {
    // 「名」「姓」で姓名が別々の入力欄に分かれているフォーム（Marketo/HubSpot等の
    // 海外製フォーム埋め込みでよく見る"First Name"/"Last Name"の日本語ローカライズ）
    // は、氏名(FULL_NAME)の辞書に一致せず、姓・名それぞれUNKNOWNのまま未入力になる
    // 実バグがあった(intralinks.com/jp/contact等の実データで確認)。プロフィールには
    // firstName/lastNameが元々あるのに、分類先が無く一度も使われていなかった。
    // "^名$"/"^姓$"は他の属性(name/id等)と結合された検索文字列全体が完全に
    // その1文字だけの場合のみ一致する最終手段——"会社名""部署名"等への誤爆を避ける。
    category: "FIRST_NAME",
    patterns: [/first[\s-]*name/i, /given[\s-]*name/i, /下の名前/, /^名$/],
  },
  {
    category: "LAST_NAME",
    patterns: [/last[\s-]*name/i, /surname/i, /family[\s-]*name/i, /苗字/, /^名字$/, /^姓$/],
  },
  {
    // 「部署名/役職名」のように部署と役職が1つの入力欄にまとまっているケース
    // (intralinks.com/jp/contact等)を、部署名だけ・役職名だけの単独パターンより
    // 先に評価する（後者が先に一致すると片方の値しか使われなくなるため）。
    category: "DEPARTMENT_JOB_TITLE",
    patterns: [/部署名?[\s/／・]*役職名?/, /department[\s/]*(and|&)?[\s/]*(job[\s-]*)?title/i],
  },
  {
    category: "DEPARTMENT",
    patterns: [/部署/, /所属/, /\bdepartment\b/i],
  },
  {
    category: "JOB_TITLE",
    // \bpost\b は "postal"/"postcode" には当たらない（tとaの間に境界が無いため）。
    // それでも "Post code" だけは上のPOSTAL_CODEで先に捕まえておく必要がある。
    patterns: [/役職/, /肩書/, /job[\s-]*title/i, /\bposition\b/i, /\bpost\b/i],
  },
  {
    category: "INDUSTRY",
    patterns: [/業種/, /業界/, /\bindustry\b/i],
  },
  {
    category: "INQUIRY_TYPE",
    // 「ご用件」はカテゴリ選択に多用される表現だが辞書に無く、この選択でJS側の表示/
    // 非表示が切り替わる条件付きフォーム(azito.co.jp等)で、選択されないまま名前・
    // 会社名・住所等の基本項目までCSSで非表示のままになる実バグがあった。
    patterns: [
      /お問い合わせ種別/,
      /種別/,
      /件名/,
      /ご用件/,
      /用件/,
      /\bsubject\b/i,
      /inquiry[\s-]*type/i,
      /\bcategory\b/i,
    ],
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
    // 「個人情報の収集について〜同意する」のように、プライバシーポリシーへの言及が
    // チェックボックス自体のlabelではなく直前の別要素（<label>で紐付いていない説明文）に
    // あり、チェックボックス自身のlabelは「同意する」だけというケースがある
    // (amami-tourism.org等の実データで確認、個人情報/プライバシー等のパターンに
    // 一致せずUNKNOWNのままチェックされない実バグがあった)。素の「同意」も見る。
    patterns: [/個人情報/, /プライバシー/, /privacy[\s-]*policy/i, /利用規約/, /\bagree\b/i, /\bconsent\b/i, /同意/],
  },
];
