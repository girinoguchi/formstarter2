import type { PrismaClient } from "@prisma/client";

import type { Profile } from "../../domain/entities/profile";
import type {
  ProfileFieldsInput,
  ProfileRepository,
  ProfileSummary,
} from "../../domain/ports/profile-repository.port";

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(ownerId: string): Promise<readonly ProfileSummary[]> {
    const rows = await this.client.profile.findMany({
      where: { ownerId },
      select: { id: true, name: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return rows;
  }

  async findById(id: string, ownerId: string): Promise<Profile | null> {
    return this.client.profile.findFirst({ where: { id, ownerId } });
  }

  async findByIdUnscoped(id: string): Promise<Profile | null> {
    return this.client.profile.findUnique({ where: { id } });
  }

  async getActive(ownerId: string): Promise<Profile | null> {
    return this.client.profile.findFirst({ where: { ownerId, isActive: true } });
  }

  async create(name: string, ownerId: string): Promise<Profile> {
    const hasAny = (await this.client.profile.count({ where: { ownerId } })) > 0;
    return this.client.profile.create({ data: { name, ownerId, isActive: !hasAny } });
  }

  async rename(id: string, name: string, ownerId: string): Promise<void> {
    await this.client.profile.updateMany({ where: { id, ownerId }, data: { name } });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const target = await this.client.profile.findFirst({ where: { id, ownerId } });
    if (!target) return;
    await this.client.profile.delete({ where: { id: target.id } });

    if (target.isActive) {
      const next = await this.client.profile.findFirst({ where: { ownerId }, orderBy: { createdAt: "asc" } });
      if (next) {
        await this.client.profile.update({ where: { id: next.id }, data: { isActive: true } });
      }
    }
  }

  async setActive(id: string, ownerId: string): Promise<void> {
    await this.client.$transaction([
      this.client.profile.updateMany({ data: { isActive: false }, where: { ownerId, isActive: true } }),
      this.client.profile.updateMany({ where: { id, ownerId }, data: { isActive: true } }),
    ]);
  }

  async updateFields(id: string, data: ProfileFieldsInput, ownerId: string): Promise<Profile> {
    await this.client.profile.updateMany({ where: { id, ownerId }, data });
    const updated = await this.client.profile.findFirst({ where: { id, ownerId } });
    if (!updated) throw new Error(`Profile not found: ${id}`);
    return updated;
  }
}
