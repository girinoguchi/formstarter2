import Papa from "papaparse";

export interface CsvNgParseResult {
  values: readonly string[];
  skippedLineCount: number;
}

/**
 * 1行1件のドメイン・URLを想定し、1列目だけを読む。
 *
 * ターゲットCSV（csv-target-parser）と違ってhttp(s)で始まることを求めない——NGリストには
 * 「example.com」のような裸のドメインを登録するのが主な使い方で、それを弾くと用をなさないため。
 * 代わりにヘッダー行らしき既知の見出し語だけを落とす。
 */
const HEADER_WORDS = new Set(["domain", "url", "ドメイン", "会社", "会社名", "ng", "value"]);

export function parseCsvNgValues(csvText: string): CsvNgParseResult {
  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });

  const values: string[] = [];
  let skippedLineCount = 0;

  for (const [index, columns] of parsed.data.entries()) {
    const value = columns[0]?.trim();
    if (!value) {
      skippedLineCount += 1;
      continue;
    }
    if (index === 0 && HEADER_WORDS.has(value.toLowerCase())) {
      skippedLineCount += 1;
      continue;
    }
    values.push(value);
  }

  return { values, skippedLineCount };
}
