import type { RunRepository } from "../domain/ports/run-repository.port";
import { errorStepLabel, summarizeErrorMessage } from "../domain/value-objects/error-step";

const CSV_HEADER = ["URL", "会社名", "お問い合わせURL", "状態", "開始時刻", "終了時刻", "スクリーンショット", "失敗理由"];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export class CsvExportService {
  constructor(private readonly runRepository: RunRepository) {}

  async exportRunsAsCsv(filter?: {
    profileId?: string;
    ownerId?: string;
    failedOnly?: boolean;
  }): Promise<string> {
    const rows = await this.runRepository.listForExport(filter);

    const lines = [CSV_HEADER.map(csvEscape).join(",")];
    for (const row of rows) {
      const reasonLabel = errorStepLabel(row.errorStep);
      const reasonDetail = summarizeErrorMessage(row.errorMessage);
      const reason =
        reasonLabel && reasonDetail && reasonLabel !== reasonDetail
          ? `${reasonLabel}（${reasonDetail}）`
          : reasonLabel || reasonDetail;

      lines.push(
        [
          row.targetUrl,
          row.targetCompanyName ?? "",
          row.contactPageUrl ?? "",
          row.status,
          row.startedAt?.toISOString() ?? "",
          row.finishedAt?.toISOString() ?? "",
          row.screenshotPaths.join(" | "),
          reason,
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    return lines.join("\r\n");
  }
}
