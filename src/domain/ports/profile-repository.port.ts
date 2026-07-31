import type { Profile } from "../entities/profile";

export type ProfileFieldsInput = Omit<Profile, "id" | "name" | "isActive" | "createdAt" | "updatedAt">;

export interface ProfileSummary {
  id: string;
  name: string;
  isActive: boolean;
}

export interface ProfileRepository {
  list(): Promise<readonly ProfileSummary[]>;
  findById(id: string): Promise<Profile | null>;
  /** isActiveなProfile（通常1件）。存在しなければnull。 */
  getActive(): Promise<Profile | null>;
  create(name: string): Promise<Profile>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** 指定IDのみをisActive=trueにし、他は全てfalseにする。 */
  setActive(id: string): Promise<void>;
  updateFields(id: string, data: ProfileFieldsInput): Promise<Profile>;
}
