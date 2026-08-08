import type { WebSearchClient } from "../domain/ports/web-search.port";
import {
  buildQueryVariants,
  isExcludedUrl,
  NEGATIVE_SITE_QUERY,
  titleMatchesCompany,
  toListItems,
  toOrigin,
  type ListSearchItem,
} from "../domain/value-objects/list-search-filter";

/** キーワード検索で1バリアントあたり取得するページ数。 */
const PAGES_PER_VARIANT = 3;

/** 企業名からのURL逆引きで、1リクエストに受け付ける上限（コストと処理時間の上限）。 */
export const MAX_COMPANY_NAMES = 300;

/** 逆引きの同時実行数。検索APIのレート制限とコストを抑える。 */
const RESOLVE_CONCURRENCY = 6;

export interface ResolvedCompanyUrl {
  name: string;
  url: string | null;
}

export class ListSearchService {
  constructor(private readonly searchClient: WebSearchClient) {}

  /**
   * キーワードから企業サイトの一覧を作る。
   * 言い換えクエリ×複数ページを一度に投げるのは、1回の検索で拾える企業数を増やすため。
   */
  async searchByKeyword(keyword: string): Promise<readonly ListSearchItem[]> {
    const variants = buildQueryVariants(keyword);

    const pages = await Promise.all(
      variants.flatMap((query) =>
        Array.from({ length: PAGES_PER_VARIANT }, (_, i) => this.searchClient.search(query, i + 1)),
      ),
    );

    return toListItems(pages.flat());
  }

  /**
   * 企業名から公式サイトのURLを引く。まず「公式サイト」付きで検索し、見つからなければ
   * 社名のみで引き直す（社名だけだと求人媒体やまとめサイトが上位に来やすいため、
   * 絞れる方を先に試す）。
   */
  async resolveCompanyUrls(companyNames: readonly string[]): Promise<readonly ResolvedCompanyUrl[]> {
    const names = companyNames.slice(0, MAX_COMPANY_NAMES);
    const results: ResolvedCompanyUrl[] = new Array(names.length);

    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = nextIndex++;
        if (index >= names.length) return;
        results[index] = await this.resolveOne(names[index]);
      }
    };

    await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, names.length) }, worker));
    return rejectSharedDomains(results);
  }

  private async resolveOne(companyName: string): Promise<ResolvedCompanyUrl> {
    // 社名は完全一致で引きたいので引用符で囲む（部分一致だと別会社が混ざる）。
    for (const query of [
      `"${companyName}" 公式サイト ${NEGATIVE_SITE_QUERY}`,
      `"${companyName}" ${NEGATIVE_SITE_QUERY}`,
    ]) {
      const results = await this.searchClient.search(query, 1, 5);
      // 検索順位だけで採用すると、該当する会社が無いときに「それらしい別のもの」を
      // 掴んでしまう。誤ったURLを渡すのは見つからないより悪いので、社名がタイトルに
      // 現れているものだけを採用する。
      const hit = results.find((r) => !isExcludedUrl(r.link) && titleMatchesCompany(r.title, companyName));
      if (hit) return { name: companyName, url: toOrigin(hit.link) };
    }

    return { name: companyName, url: null };
  }
}

/**
 * 複数の会社に同じドメインが割り当たったものを「見つからなかった」に落とす。
 *
 * 地図・企業データベース・まとめサイトはページタイトルに社名をそのまま載せるため、
 * 社名の一致判定では落とせない（navitime.co.jp や alarmbox.jp が実際に採用された）。
 * ドメインの列挙で潰そうとすると際限がないが、この種のサイトはバッチ内の複数の会社で
 * 同じドメインが出るという特徴がある——実在する会社の自社サイトが別会社と一致する
 * ことはまずない。列挙に頼らずに集約サイトを見分けられる。
 *
 * 1社だけを引いた場合はこの手がかりが無いので何も落とさない。
 */
export function rejectSharedDomains(
  results: readonly ResolvedCompanyUrl[],
): readonly ResolvedCompanyUrl[] {
  const companiesByUrl = new Map<string, Set<string>>();
  for (const { name, url } of results) {
    if (!url) continue;
    const companies = companiesByUrl.get(url) ?? new Set<string>();
    companies.add(name);
    companiesByUrl.set(url, companies);
  }

  return results.map((result) =>
    result.url && (companiesByUrl.get(result.url)?.size ?? 0) > 1
      ? { name: result.name, url: null }
      : result,
  );
}
