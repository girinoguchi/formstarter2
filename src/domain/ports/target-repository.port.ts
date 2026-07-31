import type { Target } from "../entities/target";
import type { TargetStatus } from "../value-objects/run-status";

export interface CreateTargetInput {
  url: string;
  companyName?: string | null;
  importBatchId?: string | null;
  profileId: string;
}

export interface TargetListFilter {
  profileId: string;
  status?: TargetStatus;
  search?: string;
}

export interface TargetRepository {
  findById(id: string): Promise<Target | null>;
  list(filter: TargetListFilter): Promise<readonly Target[]>;
  createImportBatch(fileName: string): Promise<string>;
  createMany(targets: readonly CreateTargetInput[]): Promise<readonly Target[]>;
  updateStatus(
    id: string,
    status: TargetStatus,
    patch?: Partial<Pick<Target, "contactPageUrl">>,
  ): Promise<void>;
  softDelete(id: string): Promise<void>;
  /** 指定プロジェクトの全ターゲットを削除する（「全件リセット」用）。 */
  removeAllForProfile(profileId: string): Promise<void>;
}
