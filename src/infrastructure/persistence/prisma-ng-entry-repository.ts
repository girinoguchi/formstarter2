import type { PrismaClient } from "@prisma/client";

import type { NgEntry } from "../../domain/entities/ng-entry";
import type {
  NgEntryListFilter,
  NgEntryPage,
  NgEntryRepository,
} from "../../domain/ports/ng-entry-repository.port";

export class PrismaNgEntryRepository implements NgEntryRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(filter: NgEntryListFilter): Promise<NgEntryPage> {
    const where = {
      ownerId: filter.ownerId,
      ...(filter.search
        ? { value: { contains: filter.search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.client.ngEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      this.client.ngEntry.count({ where }),
    ]);

    return { items, total };
  }

  async listValues(ownerId: string): Promise<readonly string[]> {
    const rows = await this.client.ngEntry.findMany({
      where: { ownerId },
      select: { value: true },
    });
    return rows.map((row) => row.value);
  }

  async add(ownerId: string, value: string): Promise<NgEntry | null> {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const existing = await this.client.ngEntry.findFirst({
      where: { ownerId, value: { equals: trimmed, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return null;

    return this.client.ngEntry.create({ data: { ownerId, value: trimmed } });
  }

  async addMany(ownerId: string, values: readonly string[]): Promise<number> {
    const existing = new Set(
      (await this.listValues(ownerId)).map((v) => v.toLowerCase()),
    );

    // 入力側の重複もここで潰す（同じCSVに同じドメインが複数行あるケース）。
    const toAdd: string[] = [];
    for (const raw of values) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      toAdd.push(trimmed);
    }
    if (toAdd.length === 0) return 0;

    const result = await this.client.ngEntry.createMany({
      data: toAdd.map((value) => ({ ownerId, value })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async remove(ownerId: string, ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.client.ngEntry.deleteMany({
      where: { ownerId, id: { in: [...ids] } },
    });
    return result.count;
  }
}
