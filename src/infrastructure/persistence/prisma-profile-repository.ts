import type { Prisma, PrismaClient } from "@prisma/client";

import type { Profile } from "../../domain/entities/profile";
import type {
  ProfileFieldsInput,
  ProfileMemberSummary,
  ProfileRepository,
  ProfileSummary,
} from "../../domain/ports/profile-repository.port";

export class PrismaProfileRepository implements ProfileRepository {
  constructor(private readonly client: PrismaClient) {}

  /**
   * 「使える」条件。作成者は移行・作成時に必ず自分のProfileMemberを持つので
   * membersだけでも足りるが、割り当て行が欠けても作成者が自分のProfileを
   * 見失わないようownerIdも併せて見る。
   */
  private accessibleBy(userId: string): Prisma.ProfileWhereInput {
    return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
  }

  /** 選択中のプロジェクトが消えたユーザーに、残っているものを1つ選び直させる。 */
  private async reselectFallback(userId: string): Promise<void> {
    const next = await this.client.profileMember.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await this.client.profileMember.update({ where: { id: next.id }, data: { isActive: true } });
    }
  }

  async list(userId: string): Promise<readonly ProfileSummary[]> {
    const rows = await this.client.profile.findMany({
      where: this.accessibleBy(userId),
      select: {
        id: true,
        name: true,
        ownerId: true,
        // 閲覧者自身の割り当て行だけを引いて、その人の選択状態を解決する。
        members: { where: { userId }, select: { isActive: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.members[0]?.isActive ?? false,
      isOwner: row.ownerId === userId,
    }));
  }

  async findById(id: string, userId: string): Promise<Profile | null> {
    return this.client.profile.findFirst({ where: { id, ...this.accessibleBy(userId) } });
  }

  async findByIdUnscoped(id: string): Promise<Profile | null> {
    return this.client.profile.findUnique({ where: { id } });
  }

  async getActive(userId: string): Promise<Profile | null> {
    return this.client.profile.findFirst({
      where: { members: { some: { userId, isActive: true } } },
    });
  }

  async create(name: string, ownerId: string): Promise<Profile> {
    const hasAny = (await this.client.profileMember.count({ where: { userId: ownerId } })) > 0;
    return this.client.profile.create({
      data: { name, ownerId, members: { create: { userId: ownerId, isActive: !hasAny } } },
    });
  }

  async rename(id: string, name: string, ownerId: string): Promise<void> {
    await this.client.profile.updateMany({ where: { id, ownerId }, data: { name } });
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const target = await this.client.profile.findFirst({
      where: { id, ownerId },
      select: { id: true, members: { select: { userId: true, isActive: true } } },
    });
    if (!target) return;

    // 削除で選択を失うのは、このProfileを選んでいた全員（作成者とは限らない）。
    const reselecting = target.members.filter((m) => m.isActive).map((m) => m.userId);
    await this.client.profile.delete({ where: { id: target.id } });
    for (const userId of reselecting) {
      await this.reselectFallback(userId);
    }
  }

  async setActive(id: string, userId: string): Promise<void> {
    const member = await this.client.profileMember.findFirst({ where: { profileId: id, userId } });
    if (!member) return;
    await this.client.$transaction([
      // 自分の割り当て行だけを対象にするので、同じProfileを共有する他ユーザーの選択は動かない。
      this.client.profileMember.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      this.client.profileMember.update({ where: { id: member.id }, data: { isActive: true } }),
    ]);
  }

  async updateFields(id: string, data: ProfileFieldsInput, ownerId: string): Promise<Profile> {
    await this.client.profile.updateMany({ where: { id, ownerId }, data });
    const updated = await this.client.profile.findFirst({ where: { id, ownerId } });
    if (!updated) throw new Error(`Profile not found: ${id}`);
    return updated;
  }

  async listMembers(id: string, ownerId: string): Promise<readonly ProfileMemberSummary[] | null> {
    const profile = await this.client.profile.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!profile) return null;

    const rows = await this.client.profileMember.findMany({
      where: { profileId: id },
      select: { user: { select: { id: true, username: true, isAdmin: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => ({
      userId: row.user.id,
      username: row.user.username,
      isAdmin: row.user.isAdmin,
    }));
  }

  async addMember(id: string, userId: string, ownerId: string): Promise<void> {
    const profile = await this.client.profile.findFirst({ where: { id, ownerId }, select: { id: true } });
    if (!profile) return;

    // 割り当てられた側がまだ1つもプロジェクトを持っていなければ、そのまま選択状態にする。
    // そうしないと作業者はログイン後に自分で選び直すまで空の画面を見ることになる。
    const hasAny = (await this.client.profileMember.count({ where: { userId } })) > 0;
    await this.client.profileMember.upsert({
      where: { profileId_userId: { profileId: id, userId } },
      create: { profileId: id, userId, isActive: !hasAny },
      update: {},
    });
  }

  async removeMember(id: string, userId: string, ownerId: string): Promise<void> {
    const profile = await this.client.profile.findFirst({ where: { id, ownerId } });
    if (!profile) return;
    // 作成者を外すと誰も送信内容を編集できないProfileになるので拒否する。
    if (profile.ownerId === userId) return;

    const member = await this.client.profileMember.findUnique({
      where: { profileId_userId: { profileId: id, userId } },
    });
    if (!member) return;

    await this.client.profileMember.delete({ where: { id: member.id } });
    if (member.isActive) {
      await this.reselectFallback(userId);
    }
  }
}
