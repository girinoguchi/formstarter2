/**
 * 候補URLが探索対象サイトと同一サイトかどうかを判定する。www.の有無やサブドメイン
 * (form.example.com等)は許容するが、完全に別ドメインは弾く。
 *
 * 自社サイトを持たずSNSプロフィールをURLとして登録しているターゲット（実データで
 * instagram.com等）で、プラットフォーム共通のフッターリンク（Metaの"Contact
 * Uploading & Non-Users"等、facebook.com/help配下の定型ヘルプページ）が
 * 「contact」というキーワードに一致し、無関係な他社ドメインのページを実際の
 * 問い合わせページと誤認してREADYになってしまう実バグがあった。
 */
export function isSameSite(candidateUrl: string, siteUrl: string): boolean {
  try {
    const candidateHost = new URL(candidateUrl).hostname.replace(/^www\./, "");
    const siteHost = new URL(siteUrl).hostname.replace(/^www\./, "");
    return (
      candidateHost === siteHost ||
      candidateHost.endsWith(`.${siteHost}`) ||
      siteHost.endsWith(`.${candidateHost}`)
    );
  } catch {
    return false;
  }
}
