import type { TargetStatus } from "../value-objects/run-status";

export interface Target {
  id: string;
  url: string;
  companyName: string | null;
  status: TargetStatus;
  contactPageUrl: string | null;
  /** BLOCKEDにした理由。NGリスト一致で弾いた場合に入る。 */
  blockReason: string | null;
  importBatchId: string | null;
  profileId: string;
  /** このURLを追加した本人。Profileは共有されるが、リストは共有されない。 */
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
