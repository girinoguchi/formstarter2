import type { PrismaClient } from "@prisma/client";

import type { Profile } from "../../domain/entities/profile";
import type {
  ProfileFieldsInput,
  ProfileRepository,
  ProfileSummary,
} from "../../domain/ports/profile-repository.port";

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(): Promise<readonly ProfileSummary[]> {
    const rows = await this.client.profile.findMany({
      select: { id: true, name: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    return rows;
  }

  async findById(id: string): Promise<Profile | null> {
    return this.client.profile.findUnique({ where: { id } });
  }

  async getActive(): Promise<Profile | null> {
    return this.client.profile.findFirst({ where: { isActive: true } });
  }

  async create(name: string): Promise<Profile> {
    const hasAny = (await this.client.profile.count()) > 0;
    return this.client.profile.create({ data: { name, isActive: !hasAny } });
  }

  async rename(id: string, name: string): Promise<void> {
    await this.client.profile.update({ where: { id }, data: { name } });
  }

  async remove(id: string): Promise<void> {
    const target = await this.client.profile.findUnique({ where: { id } });
    await this.client.profile.delete({ where: { id } });

    if (target?.isActive) {
      const next = await this.client.profile.findFirst({ orderBy: { createdAt: "asc" } });
      if (next) {
        await this.client.profile.update({ where: { id: next.id }, data: { isActive: true } });
      }
    }
  }

  async setActive(id: string): Promise<void> {
    await this.client.$transaction([
      this.client.profile.updateMany({ data: { isActive: false }, where: { isActive: true } }),
      this.client.profile.update({ where: { id }, data: { isActive: true } }),
    ]);
  }

  async updateFields(id: string, data: ProfileFieldsInput): Promise<Profile> {
    return this.client.profile.update({ where: { id }, data });
  }
}
