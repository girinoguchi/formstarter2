import type { Target } from "../entities/target";
import type { TargetStatus } from "../value-objects/run-status";

export interface CreateTargetInput {
  url: string;
  companyName?: string | null;
  importBatchId?: string | null;
  profileId: string;
  ownerId: string;
}

/**
 * profileIdとownerIdは必ずセットで絞る。Profileは複数人で共有されるため、profileIdだけで
 * 引くと同じプロジェクトを使う他の人のリスト・送信結果まで混ざる。
 */
export interface TargetListFilter {
  profileId: string;
  ownerId: string;
  status?: TargetStatus;
  search?: string;
}

/** 一覧表示用。直近のRunの失敗理由（未加工のerrorStep/errorMessage）を併せて返す。 */
export interface TargetListItem extends Target {
  latestErrorStep: string | null;
  latestErrorMessage: string | null;
}

/** プロジェクトごとに取り込んだCSVの履歴表示用。 */
export interface ImportBatchSummary {
  id: string;
  fileName: string;
  importedAt: Date;
  targetCount: number;
}

export interface TargetRepository {
  findById(id: string): Promise<Target | null>;
  list(filter: TargetListFilter): Promise<readonly TargetListItem[]>;
  createImportBatch(fileName: string): Promise<string>;
  listImportBatches(profileId: string, ownerId: string): Promise<readonly ImportBatchSummary[]>;
  createMany(targets: readonly CreateTargetInput[]): Promise<readonly Target[]>;
  updateStatus(
    id: string,
    status: TargetStatus,
    patch?: Partial<Pick<Target, "contactPageUrl">>,
  ): Promise<void>;
  softDelete(id: string): Promise<void>;
  /** 指定プロジェクトで自分が追加した分だけを削除する（「全件リセット」用）。 */
  removeAllForProfile(profileId: string, ownerId: string): Promise<void>;
}
