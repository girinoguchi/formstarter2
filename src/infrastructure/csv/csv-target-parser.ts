import Papa from "papaparse";

export interface ParsedCsvTargetRow {
  url: string;
  companyName: string | null;
}

export interface CsvTargetParseResult {
  rows: readonly ParsedCsvTargetRow[];
  skippedLineCount: number;
}

const URL_PATTERN = /^https?:\/\//i;

/**
 * 1行1URL、または「URL,会社名」の2列CSVを想定。ヘッダー行は無いものとして扱うが、
 * 1行目が http(s) で始まらない場合はヘッダー行とみなしてスキップする。
 */
export function parseCsvTargets(csvText: string): CsvTargetParseResult {
  const parsed = Papa.parse<string[]>(csvText.trim(), {
    skipEmptyLines: true,
  });

  const rows: ParsedCsvTargetRow[] = [];
  let skippedLineCount = 0;

  for (const columns of parsed.data) {
    const url = columns[0]?.trim();
    if (!url) {
      skippedLineCount += 1;
      continue;
    }
    if (!URL_PATTERN.test(url)) {
      // ヘッダー行、またはURLとして不正な行はスキップする
      skippedLineCount += 1;
      continue;
    }
    const companyName = columns[1]?.trim() || null;
    rows.push({ url, companyName });
  }

  return { rows, skippedLineCount };
}
