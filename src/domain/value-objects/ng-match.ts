/**
 * NGリストとURLの照合ロジック。取り込み時のブロック判定と、タブを開く直前の
 * 安全網チェックの両方で使う共通実装（FormStarterappのlib/ngCompanyCheck.tsと同じ規則）。
 *
 * 完全一致ではなく部分一致で見る——NGリストには「example.com」のようなドメインだけが
 * 登録される想定で、実際のターゲットは「https://example.com/contact」のような具体的な
 * URLになるため。取りこぼすより広めに止める側に倒している。
 */

export function extractNgCheckHost(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    // URLとして解釈できない入力（手入力の途中など）はそのまま文字列比較に回す。
    return url.toLowerCase();
  }
}

export function isNgUrl(url: string, ngValues: readonly string[]): boolean {
  const host = extractNgCheckHost(url);
  const urlLower = url.toLowerCase();

  for (const raw of ngValues) {
    const value = raw.toLowerCase().trim();
    if (!value) continue;
    // host.includes(value): 「example.com」で「www.example.com」を止める
    // value.includes(host): 「https://example.com/form」の登録で「example.com」を止める
    if (host.includes(value) || value.includes(host)) return true;
    if (urlLower.includes(value)) return true;
  }
  return false;
}

export const NG_BLOCK_REASON = "NGリストに登録されているドメイン・URLのためブロックしました。";
