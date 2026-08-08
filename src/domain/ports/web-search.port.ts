export interface WebSearchResult {
  title: string;
  link: string;
}

export interface WebSearchClient {
  /**
   * 検索1ページ分を取得する。失敗時は例外ではなく空配列を返す——リスト検索は
   * 十数リクエストを並列で投げるため、1本の失敗で全体を落とすと使い物にならない。
   */
  search(query: string, page: number, num?: number): Promise<readonly WebSearchResult[]>;
}
