export interface BlockCheckInput {
  status: number | null;
  title: string | null;
  bodyText: string | null;
}

/** Cloudflare等のBot対策でアクセスを拒否/チャレンジされたかどうかを判定するポート。 */
export interface BlockDetector {
  isBlocked(input: BlockCheckInput): boolean;
}
