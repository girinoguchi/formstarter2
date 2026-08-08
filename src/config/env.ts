import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  FIELD_CLASSIFIER_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
  // EXPLORE（可視タブなしの探索）は画面を圧迫しないため、高めの並列数を許容する。
  // FILL（可視タブでの入力）は一覧の行ボタンから1件ずつ手動で開始する方式のため、
  // 並列数の上限設定を持たない（人間が押した分だけタブが開く）。
  EXPLORE_CONCURRENCY: z.coerce.number().int().positive().default(8),
  // ログインセッション（JWT）の署名鍵。FormStarterapp同様、Sessionテーブルは持たず
  // Cookieに署名付きJWTを入れる方式のため必須。
  AUTH_SECRET: z.string().min(16),
  // セッションCookieのSecure属性判定に使う（FormStarterappと同じ方式）。httpsでない
  // 環境でSecureを付けるとブラウザがCookie自体を保存せずログインループになるため。
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  // リスト検索（Serper.dev経由のGoogle検索）のAPIキー。この機能を使わない環境でも
  // アプリ全体が起動できるよう任意にし、未設定ならAPI側で503を返す。
  SERPER_API_KEY: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  FIELD_CLASSIFIER_MODEL: process.env.FIELD_CLASSIFIER_MODEL,
  EXPLORE_CONCURRENCY: process.env.EXPLORE_CONCURRENCY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  SERPER_API_KEY: process.env.SERPER_API_KEY,
});
