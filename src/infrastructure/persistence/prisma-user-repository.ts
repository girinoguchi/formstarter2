import type { PrismaClient, User as PrismaUser } from "@prisma/client";

import type { User } from "../../domain/entities/user";
import type { CreateUserInput, UserRecord, UserRepository } from "../../domain/ports/user-repository.port";

function toDomain(row: PrismaUser): User {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.createdAt,
  };
}

function toRecord(row: PrismaUser): UserRecord {
  return { ...toDomain(row), passwordHash: row.passwordHash };
}

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByUsername(username: string): Promise<UserRecord | null> {
    const row = await this.client.user.findUnique({ where: { username } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.client.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async count(): Promise<number> {
    return this.client.user.count();
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.client.user.create({
      data: { username: input.username, passwordHash: input.passwordHash },
    });
    return toDomain(row);
  }

  async remove(id: string): Promise<void> {
    await this.client.user.delete({ where: { id } });
  }
}
