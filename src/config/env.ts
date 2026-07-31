import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  FIELD_CLASSIFIER_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
  // EXPLORE（可視タブなしの探索）は画面を圧迫しないため、高めの並列数を許容する。
  // FILL（可視タブでの入力）は一覧の行ボタンから1件ずつ手動で開始する方式のため、
  // 並列数の上限設定を持たない（人間が押した分だけタブが開く）。
  EXPLORE_CONCURRENCY: z.coerce.number().int().positive().default(8),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  FIELD_CLASSIFIER_MODEL: process.env.FIELD_CLASSIFIER_MODEL,
  EXPLORE_CONCURRENCY: process.env.EXPLORE_CONCURRENCY,
});
