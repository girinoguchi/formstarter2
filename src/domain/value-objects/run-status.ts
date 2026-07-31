export const TARGET_STATUSES = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "READY",
  "AWAITING_SEND",
  "NEEDS_REVIEW",
  "BLOCKED",
  "NOT_SENDABLE",
  "FAILED",
] as const;

export type TargetStatus = (typeof TARGET_STATUSES)[number];

export const RUN_STATUSES = [
  "PENDING",
  "LAUNCHING_BROWSER",
  "LOADING_SITE",
  "FINDING_CONTACT_PAGE",
  "PARSING_FORM",
  "CLASSIFYING_FIELDS",
  "FILLING_FORM",
  "HANDLING_VALIDATION",
  "REACHED_CONFIRMATION",
  "READY",
  "AWAITING_SEND",
  "NEEDS_REVIEW",
  "BLOCKED",
  "NOT_SENDABLE",
  "FAILED",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

/**
 * これらのステータスに到達したブラウザコンテキストは、人間がまだ操作しうるため
 * オーケストレータが意図的にクローズしない（FAILEDのみクローズする）。
 */
export const CONTEXT_KEPT_OPEN_RUN_STATUSES: readonly RunStatus[] = [
  "AWAITING_SEND",
  "NEEDS_REVIEW",
  "BLOCKED",
  "NOT_SENDABLE",
];
