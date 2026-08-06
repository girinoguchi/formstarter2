import type { Profile } from "../entities/profile";

export type ProfileFieldsInput = Omit<Profile, "id" | "ownerId" | "name" | "createdAt" | "updatedAt">;

export interface ProfileSummary {
  id: string;
  name: string;
  /** 閲覧者が今このプロジェクトを選んでいるか（ユーザーごとに異なる）。 */
  isActive: boolean;
  /** 閲覧者自身が作成したものか。falseなら「管理者に割り当てられて使っている」状態。 */
  isOwner: boolean;
}

export interface ProfileMemberSummary {
  userId: string;
  username: string;
  isAdmin: boolean;
}

/**
 * スコープの引数には2種類あり、意味が違うので取り違えないこと。
 *
 * - `userId`  : 使う側の権限。自分が作成したProfileに加え、割り当てられたProfileも対象。
 * - `ownerId` : 作った側の権限。作成者本人のProfileだけが対象。送信内容の編集・改名・削除・
 *               割り当ての変更はこちらでしか通らない（作業者は使うだけで編集できない）。
 *
 * どちらも、該当しないidを渡された場合は「見つからない」として扱う（0件更新・null返却）。
 */
export interface ProfileRepository {
  /** userIdが使えるProfile（自分が作成したもの＋割り当てられたもの）。 */
  list(userId: string): Promise<readonly ProfileSummary[]>;
  /** userIdが使えるProfileか確認した上で引く。 */
  findById(id: string, userId: string): Promise<Profile | null>;
  /**
   * userIdを問わずidだけで引く。HTTPリクエスト境界（誰がアクセスしているか）を
   * 経由しない内部処理専用——RunOrchestratorがTarget.profileIdから「そのターゲットが
   * 属するProfile」を解決する用途にのみ使う。ユーザー入力のidをここに渡さないこと。
   */
  findByIdUnscoped(id: string): Promise<Profile | null>;
  /** userIdが選択中のProfile（通常1件）。存在しなければnull。 */
  getActive(userId: string): Promise<Profile | null>;
  /** 作成者は自動で割り当て対象になる。 */
  create(name: string, ownerId: string): Promise<Profile>;
  rename(id: string, name: string, ownerId: string): Promise<void>;
  remove(id: string, ownerId: string): Promise<void>;
  /** userIdの選択を指定IDに切り替える（他ユーザーの選択には影響しない）。 */
  setActive(id: string, userId: string): Promise<void>;
  updateFields(id: string, data: ProfileFieldsInput, ownerId: string): Promise<Profile>;

  /** 割り当てられているユーザー一覧。作成者以外＝使うだけの作業者。 */
  listMembers(id: string, ownerId: string): Promise<readonly ProfileMemberSummary[] | null>;
  /** 既に割り当て済みなら何もしない。 */
  addMember(id: string, userId: string, ownerId: string): Promise<void>;
  /** 作成者自身は外せない（外すと誰も編集できないProfileになるため）。 */
  removeMember(id: string, userId: string, ownerId: string): Promise<void>;
}
