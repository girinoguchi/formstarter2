import type { TargetStatus } from "../value-objects/run-status";

export interface Target {
  id: string;
  url: string;
  companyName: string | null;
  status: TargetStatus;
  contactPageUrl: string | null;
  importBatchId: string | null;
  profileId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
