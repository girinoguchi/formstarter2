import type { Profile } from "../domain/entities/profile";
import type { Run } from "../domain/entities/run";
import type { Target } from "../domain/entities/target";

import { getSession } from "./auth";
import { getProfileRepository, getRunRepository, getTargetRepository } from "./di";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * データはProfile起点でスコープされる。誰がどのProfileを使えるかはProfileMember
 * （管理者が作ったProfileを作業者に割り当てる）が決め、isAdminはユーザー管理権限のみを
 * 表す——admin/作業者を問わず「ログイン中の自分に割り当てられたProfile配下かどうか」
 * だけで判定する。
 *
 * ここで見るのは「使えるか」だけ。送信内容の編集・改名・削除・割り当ての変更は作成者に
 * 限られ、その判定はProfileRepository側（ownerIdを取る各メソッド）が持つ。
 */
export async function requireSession(): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSession();
  if (!user) {
    return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export async function requireAccessibleProfile(
  profileId: string,
  userId: string,
): Promise<Profile | null> {
  return getProfileRepository().findById(profileId, userId);
}

/**
 * リスト（送信先URL）と送信結果は共有しない。Profileを使える人であっても、他人が追加した
 * Targetには触れない——プロジェクトへのアクセス権に加えて、追加者本人であることを求める。
 */
export async function requireAccessibleTarget(
  targetId: string,
  userId: string,
): Promise<Target | null> {
  const target = await getTargetRepository().findById(targetId);
  if (!target) return null;
  if (target.ownerId !== userId) return null;
  const profile = await requireAccessibleProfile(target.profileId, userId);
  return profile ? target : null;
}

/** runId → targetId → profileId を辿り、そのProfileをuserIdが使えるかを確認する。 */
export async function requireAccessibleRun(runId: string, userId: string): Promise<Run | null> {
  const run = await getRunRepository().findById(runId);
  if (!run) return null;
  const target = await requireAccessibleTarget(run.targetId, userId);
  return target ? run : null;
}
