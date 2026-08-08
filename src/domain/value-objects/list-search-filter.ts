/**
 * リスト検索（Google検索API経由で営業リストを作る機能）の絞り込みロジック。
 * FormStarterappのlib/listSearchDomains.tsと同じ方針を踏襲している。
 *
 * 検索結果には企業サイト以外が大量に混ざる（PR TIMES・SNS・求人媒体・ポータル・報道）。
 * これらは営業先にならないうえ、フォーム探索まで走らせると時間と対向サイトへの
 * アクセスを無駄にするため、リストに入れる前に落とす。
 */

/** ドメイン一致（サブドメイン含む）で落とす。 */
export const EXCLUDED_DOMAINS: readonly string[] = [
  // まとめ・百科事典・SNS
  "prtimes.jp",
  "wikipedia.org",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "linkedin.com",
  "ameblo.jp",
  "note.com",
  "hatena.ne.jp",
  // EC・ポータル
  "rakuten.co.jp",
  "amazon.co.jp",
  "goo.ne.jp",
  "yahoo.co.jp",
  "hotpepper.jp",
  "tabelog.com",
  "itp.ne.jp",
  "ekiten.jp",
  "kakaku.com",
  "walkerplus.com",
  "tripadvisor.jp",
  // 求人媒体
  "wantedly.com",
  "indeed.com",
  "mynavi.jp",
  "rikunabi.com",
  "doda.jp",
  "en-japan.com",
  "recruit.co.jp",
  "jobcdn.com",
  "townwork.net",
  // 実際の検索結果に出たもの（2026-08-09の「東京 製造業 部品」で確認）
  "stanby.com",
  "r-agent.com",
  "04510.jp",
  "job-medley.com",
  "hatarako.net",
  // M&A・企業データベース・展示会・技術ポータル
  "batonz.jp",
  "tranbi.com",
  "ipros.com",
  "ipros.jp",
  "automotiveworld.jp",
  "reed-japan.co.jp",
  "jma.or.jp",
  "companydata.tsujigawa.com",
  // 企業データベースはページタイトルに社名をそのまま載せるため、社名の一致判定では
  // 落とせない（実際に「株式会社ギリ」でalarmbox.jpが採用された）。ドメインで落とす。
  "alarmbox.jp",
  "houjin.jp",
  "houjinbangou.com",
  "gbiz.go.jp",
  "salesnow.jp",
  "musubu.in",
  // 地図・アクセス情報。企業ページを持つため社名一致をすり抜ける。
  "navitime.co.jp",
  "mapion.co.jp",
  "its-mo.com",
  "goo.gl",
  // 観光・地域情報
  "gotokyo.org",
  "jalan.net",
  "rurubu.jp",
  // 報道・企業データベース
  "nikkei.com",
  "yomiuri.co.jp",
  "asahi.com",
  "mainichi.jp",
  "toyokeizai.net",
  "baseconnect.in",
  "minkabu.jp",
  "kabutan.jp",
  // 経路検索
  "ekitan.com",
  "jorudan.co.jp",
];

/** 企業以外のドメイン種別（自治体・官公庁・学校・非営利団体）。 */
export const EXCLUDED_DOMAIN_SUFFIXES: readonly string[] = [
  ".lg.jp",
  ".go.jp",
  ".ac.jp",
  ".ed.jp",
  ".or.jp",
];

export function isExcludedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (EXCLUDED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) return true;
    if (EXCLUDED_DOMAIN_SUFFIXES.some((s) => hostname.endsWith(s))) return true;
    return false;
  } catch {
    // URLとして壊れているものはリストに入れても使えないので落とす。
    return true;
  }
}

/**
 * オリジン（scheme + host）へ正規化する。同じ会社の複数ページが別々の候補として
 * 並ぶのを防ぐため、重複排除のキーにも使う。
 */
export function toOrigin(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url;
  }
}

/**
 * 除外ドメインを検索クエリ側でも落とす（-site:）。取得後のフィルタだけだと、
 * 除外対象で検索結果の枠が埋まってしまい、企業サイトの取得数が減るため。
 */
export const NEGATIVE_SITE_QUERY: string = EXCLUDED_DOMAINS.map((d) => `-site:${d}`).join(" ");

/** 1回の検索で拾える企業を増やすための言い換え。 */
const QUERY_SUFFIXES: readonly string[] = ["お問い合わせ", "会社概要", "コーポレートサイト", "公式サイト"];

export function buildQueryVariants(baseQuery: string): readonly string[] {
  const base = baseQuery.trim();
  const variants = [base];
  for (const suffix of QUERY_SUFFIXES) {
    if (!base.includes(suffix)) variants.push(`${base} ${suffix}`);
  }
  return variants.map((q) => `${q} ${NEGATIVE_SITE_QUERY}`);
}

export interface ListSearchItem {
  name: string;
  url: string;
}

/**
 * 検索結果を「企業サイトの一覧」に整える。除外・オリジン正規化・重複排除をまとめて行う。
 * 取得順（＝検索順位順）を保つので、上位の結果ほど前に残る。
 */
export function toListItems(
  results: readonly { title: string; link: string }[],
): readonly ListSearchItem[] {
  const seen = new Set<string>();
  const items: ListSearchItem[] = [];

  for (const result of results) {
    if (isExcludedUrl(result.link)) continue;
    const origin = toOrigin(result.link);
    if (seen.has(origin)) continue;
    seen.add(origin);
    items.push({ name: result.title, url: origin });
  }

  return items;
}

/**
 * 検索結果が、その社名の会社のものと言えるか。
 *
 * 社名で検索しても、一致する会社が無ければGoogleは「それらしい別のもの」を返す。
 * 検索順位だけで採用すると、存在しない会社名に無関係なURLが割り当たる（実際に
 * 架空の社名で cpalms.org が返った）。誤ったURLを渡すのは「見つからない」より
 * 悪いので、社名がタイトルに現れているかを最低条件にする。
 *
 * 法人格（株式会社等）は検索結果のタイトルで省略されることが多いため、
 * 取り除いた本体部分で判定する。
 */
const LEGAL_ENTITY_PATTERN =
  /(株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|\(株\)|（株）|\(有\)|（有）|Inc\.?|Corp\.?|Corporation|Co\.?,?\s*Ltd\.?|Ltd\.?|LLC|K\.K\.)/gi;

export function coreCompanyName(companyName: string): string {
  return companyName
    .replace(LEGAL_ENTITY_PATTERN, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

export function titleMatchesCompany(title: string, companyName: string): boolean {
  const core = coreCompanyName(companyName);
  // 日本語の社名は法人格を除くと2文字ということが珍しくない（「株式会社ギリ」→「ギリ」）。
  // ここで3文字以上を要求すると、そうした会社が一律「見つからない」になってしまう。
  // 1文字まで削られた場合だけは誤一致が多すぎるので、元の社名で照合する。
  const needle = core.length >= 2 ? core : companyName.replace(/[\s　]+/g, "");
  if (needle === "") return false;

  return title.replace(/[\s　]+/g, "").toLowerCase().includes(needle.toLowerCase());
}
