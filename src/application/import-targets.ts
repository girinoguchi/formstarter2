import type { Target } from "../domain/entities/target";
import type { TargetRepository } from "../domain/ports/target-repository.port";
import { parseCsvTargets } from "../infrastructure/csv/csv-target-parser";

export interface CsvImportResult {
  importedCount: number;
  skippedLineCount: number;
  targets: readonly Target[];
}

export class CsvImportService {
  constructor(private readonly targetRepository: TargetRepository) {}

  async importFromCsvText(fileName: string, csvText: string, profileId: string): Promise<CsvImportResult> {
    const { rows, skippedLineCount } = parseCsvTargets(csvText);

    if (rows.length === 0) {
      return { importedCount: 0, skippedLineCount, targets: [] };
    }

    // 新しいCSVを取り込むたびに、そのプロフィールの既存ターゲットを一度クリアする。
    // 古い取り込み結果が残ったままだと「フォーム発見率」に前回分が混ざってしまうため。
    await this.targetRepository.removeAllForProfile(profileId);

    const importBatchId = await this.targetRepository.createImportBatch(fileName);
    const targets = await this.targetRepository.createMany(
      rows.map((row) => ({ url: row.url, companyName: row.companyName, importBatchId, profileId })),
    );

    return { importedCount: targets.length, skippedLineCount, targets };
  }
}
