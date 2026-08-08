import type { Profile } from "../entities/profile";

export type ProfileFieldsInput = Omit<Profile, "id" | "ownerId" | "name" | "isActive" | "createdAt" | "updatedAt">;

export interface ProfileSummary {
  id: string;
  name: string;
  isActive: boolean;
}

// 全メソッドがownerIdを必須で受け取る——アカウントごとにデータを完全分離するため、
// 呼び出し側（API route）はセッションから取れた自分のuserIdを必ず渡す。他人のownerIdで
// 存在しないid/nameを渡された場合は「見つからない」として扱う（0件更新・null返却）。
export interface ProfileRepository {
  list(ownerId: string): Promise<readonly ProfileSummary[]>;
  findById(id: string, ownerId: string): Promise<Profile | null>;
  /**
   * ownerIdを問わずidだけで引く。HTTPリクエスト境界（誰がアクセスしているか）を
   * 経由しない内部処理専用——RunOrchestratorがTarget.profileIdから「そのターゲットが
   * 属するProfile」を解決する用途にのみ使う。ユーザー入力のidをここに渡さないこと。
   */
  findByIdUnscoped(id: string): Promise<Profile | null>;
  /** ownerIdのisActiveなProfile（通常1件）。存在しなければnull。 */
  getActive(ownerId: string): Promise<Profile | null>;
  create(name: string, ownerId: string): Promise<Profile>;
  rename(id: string, name: string, ownerId: string): Promise<void>;
  remove(id: string, ownerId: string): Promise<void>;
  /** ownerId配下で指定IDのみをisActive=trueにし、他は全てfalseにする。 */
  setActive(id: string, ownerId: string): Promise<void>;
  updateFields(id: string, data: ProfileFieldsInput, ownerId: string): Promise<Profile>;
}
