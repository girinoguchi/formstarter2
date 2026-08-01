import type { User } from "../entities/user";

/** ログイン検証時のみ使う、passwordHashを含む内部表現。APIレスポンス等には絶対に混ぜない。 */
export interface UserRecord extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  username: string;
  passwordHash: string;
  isAdmin: boolean;
}

export interface UserRepository {
  findByUsername(username: string): Promise<UserRecord | null>;
  findById(id: string): Promise<User | null>;
  list(): Promise<readonly User[]>;
  count(): Promise<number>;
  create(input: CreateUserInput): Promise<User>;
  updateIsAdmin(id: string, isAdmin: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}
