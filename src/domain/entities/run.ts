import type { RunKind } from "../value-objects/run-kind";
import type { RunStatus } from "../value-objects/run-status";

export interface Run {
  id: string;
  targetId: string;
  kind: RunKind;
  status: RunStatus;
  contactPageUrl: string | null;
  formSelector: string | null;
  windowLabel: string | null;
  errorStep: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  closedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}
