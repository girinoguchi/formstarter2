import type { Profile } from "../domain/entities/profile";
import type { Run } from "../domain/entities/run";
import type { Target } from "../domain/entities/target";

import { getSession } from "./auth";
import { getProfileRepository, getRunRepository, getTargetRepository } from "./di";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * データはアカウントごとに完全分離（Profile.ownerId起点）。全アカウントが対等な
 * 営業マン個人向けプロダクトのため役割による例外はなく、「ログイン中の自分が所有する
 * Profile配下かどうか」だけで判定する。
 */
export async function requireSession(): Promise<{ user: SessionUser } | { response: Response }> {
  const user = await getSession();
  if (!user) {
    return { response: Response.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { user };
}

export async function requireOwnedProfile(
  profileId: string,
  ownerId: string,
): Promise<Profile | null> {
  return getProfileRepository().findById(profileId, ownerId);
}

/** targetId → profileId を辿り、そのProfileがownerIdの所有かを確認する。 */
export async function requireOwnedTarget(targetId: string, ownerId: string): Promise<Target | null> {
  const target = await getTargetRepository().findById(targetId);
  if (!target) return null;
  const profile = await requireOwnedProfile(target.profileId, ownerId);
  return profile ? target : null;
}

/** runId → targetId → profileId を辿り、そのProfileがownerIdの所有かを確認する。 */
export async function requireOwnedRun(runId: string, ownerId: string): Promise<Run | null> {
  const run = await getRunRepository().findById(runId);
  if (!run) return null;
  const target = await requireOwnedTarget(run.targetId, ownerId);
  return target ? run : null;
}
