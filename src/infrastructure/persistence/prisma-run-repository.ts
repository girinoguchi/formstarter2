import type { Prisma, PrismaClient, Run as PrismaRun } from "@prisma/client";

import type { FieldClassification } from "../../domain/entities/field-classification";
import type { Run } from "../../domain/entities/run";
import type {
  ActiveRunSummary,
  RunDetail,
  RunExportRow,
  RunRepository,
  RunUpdatablePatch,
} from "../../domain/ports/run-repository.port";
import type { LogLevel } from "../../domain/value-objects/log-level";
import type { RunKind } from "../../domain/value-objects/run-kind";
import type { RunStatus } from "../../domain/value-objects/run-status";
import type { ScreenshotStage } from "../../domain/value-objects/screenshot-stage";
import { CONTEXT_KEPT_OPEN_RUN_STATUSES } from "../../domain/value-objects/run-status";

function toDomain(row: PrismaRun): Run {
  return {
    id: row.id,
    targetId: row.targetId,
    kind: row.kind as RunKind,
    status: row.status as RunStatus,
    contactPageUrl: row.contactPageUrl,
    formSelector: row.formSelector,
    windowLabel: row.windowLabel,
    errorStep: row.errorStep,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    closedAt: row.closedAt,
    sentAt: row.sentAt,
    cdpTargetId: row.cdpTargetId,
    createdAt: row.createdAt,
  };
}

export class PrismaRunRepository implements RunRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(targetId: string, kind: RunKind): Promise<Run> {
    const row = await this.client.run.create({ data: { targetId, kind } });
    return toDomain(row);
  }

  async updateStatus(runId: string, status: RunStatus, patch?: RunUpdatablePatch): Promise<void> {
    await this.client.run.update({ where: { id: runId }, data: { status, ...(patch ?? {}) } });
  }

  async markClosed(runId: string): Promise<void> {
    await this.client.run.update({ where: { id: runId }, data: { closedAt: new Date() } });
  }

  async markSent(runId: string): Promise<void> {
    await this.client.run.update({
      where: { id: runId },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  async appendLog(
    runId: string,
    level: LogLevel,
    step: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.client.runLog.create({
      data: { runId, level, step, message, metadata: metadata as Prisma.InputJsonValue | undefined },
    });
  }

  async addScreenshot(runId: string, stage: ScreenshotStage, filePath: string): Promise<void> {
    await this.client.screenshot.create({ data: { runId, stage, filePath } });
  }

  async addFieldClassifications(runId: string, classifications: readonly FieldClassification[]): Promise<void> {
    if (classifications.length === 0) return;
    await this.client.runFieldClassification.createMany({
      data: classifications.map((c) => ({
        runId,
        fieldSelector: c.fieldSelector,
        fieldLabel: c.fieldLabel,
        category: c.category,
        source: c.source,
        confidence: c.confidence,
      })),
    });
  }

  async findById(runId: string): Promise<Run | null> {
    const row = await this.client.run.findUnique({ where: { id: runId } });
    return row ? toDomain(row) : null;
  }

  async findDetailById(runId: string): Promise<RunDetail | null> {
    const row = await this.client.run.findUnique({
      where: { id: runId },
      include: {
        screenshots: { orderBy: { createdAt: "asc" } },
        logs: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!row) return null;

    return {
      ...toDomain(row),
      screenshots: row.screenshots.map((s) => ({
        id: s.id,
        stage: s.stage as ScreenshotStage,
        filePath: s.filePath,
        createdAt: s.createdAt,
      })),
      logs: row.logs.map((l) => ({
        id: l.id,
        level: l.level as LogLevel,
        step: l.step,
        message: l.message,
        metadata: l.metadata as Record<string, unknown> | null,
        createdAt: l.createdAt,
      })),
    };
  }

  async listByTarget(targetId: string): Promise<readonly Run[]> {
    const rows = await this.client.run.findMany({
      where: { targetId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async hasOpenTab(targetId: string): Promise<boolean> {
    const count = await this.client.run.count({
      where: { targetId, kind: "FILL", status: { in: ["AWAITING_SEND", "SENT"] }, closedAt: null },
    });
    return count > 0;
  }

  async listTargetIdsWithOpenTab(): Promise<readonly string[]> {
    const rows = await this.client.run.findMany({
      where: { kind: "FILL", status: { in: ["AWAITING_SEND", "SENT"] }, closedAt: null },
      select: { targetId: true },
      distinct: ["targetId"],
    });
    return rows.map((r) => r.targetId);
  }

  async listActive(
    filter?: { profileId?: string; ownerId?: string; kind?: RunKind },
  ): Promise<readonly ActiveRunSummary[]> {
    // CONTEXT_KEPT_OPEN_RUN_STATUSES（AWAITING_SEND等での「タブを開いたまま」扱い）はFILLにしか
    // 意味がない。EXPLOREは可視タブを持たないため、NOT_SENDABLE等の終端statusをここに含めると
    // 「探索が終わって送信不可になっただけ」のRunまで「探索中」と誤表示してしまう
    // ——EXPLOREはfinishedAtがnull（＝本当にまだ進行中）のものだけを対象にする。
    // closedAtは人間が実際にタブを閉じた時刻。まだ閉じられていない（closedAt: null）ものだけを
    // 「開いているタブ」として扱う——閉じられたら一覧から自動的に消える。
    const activeCondition =
      filter?.kind === "FILL"
        ? {
            OR: [
              { finishedAt: null },
              { status: { in: [...CONTEXT_KEPT_OPEN_RUN_STATUSES] }, closedAt: null },
            ],
          }
        : { finishedAt: null };

    const targetFilter = {
      ...(filter?.profileId ? { profileId: filter.profileId } : {}),
      ...(filter?.ownerId ? { profile: { ownerId: filter.ownerId } } : {}),
    };

    const rows = await this.client.run.findMany({
      where: {
        ...(Object.keys(targetFilter).length > 0 ? { target: targetFilter } : {}),
        ...(filter?.kind ? { kind: filter.kind } : {}),
        ...activeCondition,
      },
      include: { target: true },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      ...toDomain(row),
      targetUrl: row.target.url,
      targetCompanyName: row.target.companyName,
    }));
  }

  async listForExport(filter?: { profileId?: string; failedOnly?: boolean }): Promise<readonly RunExportRow[]> {
    const rows = await this.client.run.findMany({
      where: {
        ...(filter?.profileId ? { target: { profileId: filter.profileId } } : {}),
        ...(filter?.failedOnly ? { status: { in: ["FAILED", "NOT_SENDABLE", "BLOCKED"] } } : {}),
      },
      include: { target: true, screenshots: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    return rows.map((row) => ({
      ...toDomain(row),
      targetUrl: row.target.url,
      targetCompanyName: row.target.companyName,
      screenshotPaths: row.screenshots.map((s) => s.filePath),
    }));
  }
}
