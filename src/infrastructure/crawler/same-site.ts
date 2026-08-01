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

/**
 * 候補URLが探索中のページ自身を指しているかどうかを判定する（末尾スラッシュ・
 * ハッシュの差異は無視）。サポートハブページのナビゲーションにある「サポート／
 * お問い合わせ」のような、現在地を示すだけで実際には別ページへ遷移しない
 * リンクを「問い合わせページが見つかった」と誤認しないための除外フィルタ
 * （recolte-jp.com等の実データで、このリンクが他の実在する問い合わせフォーム
 * へのリンクより先にマッチしてしまい、実フォームの無いページがREADYになる
 * 実バグがあった）。
 */
export function isSelfLink(candidateUrl: string, siteUrl: string): boolean {
  try {
    const normalize = (url: string) => {
      const u = new URL(url);
      return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`;
    };
    return normalize(candidateUrl) === normalize(siteUrl);
  } catch {
    return false;
  }
}
