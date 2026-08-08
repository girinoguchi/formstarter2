import type { PrismaClient, Target as PrismaTarget } from "@prisma/client";

import type { Target } from "../../domain/entities/target";
import type {
  CreateTargetInput,
  ImportBatchSummary,
  TargetListFilter,
  TargetListItem,
  TargetRepository,
} from "../../domain/ports/target-repository.port";
import type { TargetStatus } from "../../domain/value-objects/run-status";

function toDomain(row: PrismaTarget): Target {
  return {
    id: row.id,
    url: row.url,
    companyName: row.companyName,
    status: row.status as TargetStatus,
    contactPageUrl: row.contactPageUrl,
    blockReason: row.blockReason,
    importBatchId: row.importBatchId,
    profileId: row.profileId,
    ownerId: row.ownerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class PrismaTargetRepository implements TargetRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Target | null> {
    const row = await this.client.target.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(filter: TargetListFilter): Promise<readonly TargetListItem[]> {
    const rows = await this.client.target.findMany({
      where: {
        deletedAt: null,
        profileId: filter.profileId,
        ownerId: filter.ownerId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.search
          ? {
              OR: [
                { url: { contains: filter.search, mode: "insensitive" } },
                { companyName: { contains: filter.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      // 一覧に失敗理由を出すため、直近のRun1件だけ併せて取得する。
      include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...toDomain(row),
      latestErrorStep: row.runs[0]?.errorStep ?? null,
      latestErrorMessage: row.runs[0]?.errorMessage ?? null,
    }));
  }

  async createImportBatch(fileName: string): Promise<string> {
    const batch = await this.client.importBatch.create({ data: { fileName } });
    return batch.id;
  }

  async listImportBatches(
    profileId: string,
    ownerId: string,
  ): Promise<readonly ImportBatchSummary[]> {
    const rows = await this.client.importBatch.findMany({
      where: { targets: { some: { profileId, ownerId, deletedAt: null } } },
      orderBy: { importedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        importedAt: true,
        // 取り込み件数も自分の分だけ数える（同じCSVを別の人が取り込んでいても混ざらない）。
        _count: { select: { targets: { where: { profileId, ownerId, deletedAt: null } } } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      importedAt: row.importedAt,
      targetCount: row._count.targets,
    }));
  }

  async createMany(targets: readonly CreateTargetInput[]): Promise<readonly Target[]> {
    if (targets.length === 0) return [];

    const rows = await this.client.$transaction(
      targets.map((t) =>
        this.client.target.create({
          data: {
            url: t.url,
            companyName: t.companyName ?? null,
            importBatchId: t.importBatchId ?? null,
            profileId: t.profileId,
            ownerId: t.ownerId,
            ...(t.status ? { status: t.status } : {}),
            ...(t.blockReason ? { blockReason: t.blockReason } : {}),
          },
        }),
      ),
    );
    return rows.map(toDomain);
  }

  async updateStatus(
    id: string,
    status: TargetStatus,
    patch?: Partial<Pick<Target, "contactPageUrl">>,
  ): Promise<void> {
    await this.client.target.update({
      where: { id },
      data: { status, ...(patch ?? {}) },
    });
  }

  async block(id: string, reason: string): Promise<void> {
    await this.client.target.update({
      where: { id },
      data: { status: "BLOCKED", blockReason: reason },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.client.target.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async removeAllForProfile(profileId: string, ownerId: string): Promise<void> {
    await this.client.target.deleteMany({ where: { profileId, ownerId } });
  }
}
