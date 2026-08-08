import type { Target } from "../domain/entities/target";
import type { NgEntryRepository } from "../domain/ports/ng-entry-repository.port";
import type { TargetRepository } from "../domain/ports/target-repository.port";
import { isNgUrl, NG_BLOCK_REASON } from "../domain/value-objects/ng-match";
import { parseCsvTargets } from "../infrastructure/csv/csv-target-parser";

export interface CsvImportResult {
  importedCount: number;
  skippedLineCount: number;
  /** NGリストに一致してBLOCKEDで取り込んだ件数（importedCountの内数）。 */
  blockedCount: number;
  targets: readonly Target[];
}

export class CsvImportService {
  constructor(
    private readonly targetRepository: TargetRepository,
    private readonly ngEntryRepository: NgEntryRepository,
  ) {}

  async importFromCsvText(
    fileName: string,
    csvText: string,
    profileId: string,
    ownerId: string,
  ): Promise<CsvImportResult> {
    const { rows, skippedLineCount } = parseCsvTargets(csvText);

    if (rows.length === 0) {
      return { importedCount: 0, skippedLineCount, blockedCount: 0, targets: [] };
    }

    // 新しいCSVを取り込むたびに、そのプロフィールの既存ターゲットを一度クリアする。
    // 古い取り込み結果が残ったままだと「フォーム発見率」に前回分が混ざってしまうため。
    // 消すのは自分が追加した分だけ——同じプロジェクトを共有する他の人のリストは残す。
    await this.targetRepository.removeAllForProfile(profileId, ownerId);

    // NGリストは取り込み時点で判定し、一致したものは探索も送信もされないBLOCKEDで作る。
    const ngValues = await this.ngEntryRepository.listValues(ownerId);

    const importBatchId = await this.targetRepository.createImportBatch(fileName);
    const targets = await this.targetRepository.createMany(
      rows.map((row) => {
        const isNg = isNgUrl(row.url, ngValues);
        return {
          url: row.url,
          companyName: row.companyName,
          importBatchId,
          profileId,
          ownerId,
          ...(isNg ? { status: "BLOCKED" as const, blockReason: NG_BLOCK_REASON } : {}),
        };
      }),
    );

    const blockedCount = targets.filter((t) => t.status === "BLOCKED").length;
    return { importedCount: targets.length, skippedLineCount, blockedCount, targets };
  }
}
