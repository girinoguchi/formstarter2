import type { User } from "../entities/user";

/** ログイン検証時のみ使う、passwordHashを含む内部表現。APIレスポンス等には絶対に混ぜない。 */
export interface UserRecord extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<User | null>;
  count(): Promise<number>;
  create(input: CreateUserInput): Promise<User>;
  remove(id: string): Promise<void>;
}
