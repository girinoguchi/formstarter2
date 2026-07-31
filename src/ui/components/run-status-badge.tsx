import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { statusLabel } from "../lib/status-labels";

const STATUS_CLASS: Record<string, string> = {
  PENDING: "",
  QUEUED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  RUNNING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LAUNCHING_BROWSER: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  LOADING_SITE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FINDING_CONTACT_PAGE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PARSING_FORM: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  CLASSIFYING_FIELDS: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  FILLING_FORM: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  HANDLING_VALIDATION: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  REACHED_CONFIRMATION: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  READY: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  AWAITING_SEND: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  NEEDS_REVIEW: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
};

export function RunStatusBadge({ status }: { status: string }) {
  const isDestructive = ["BLOCKED", "NOT_SENDABLE", "FAILED"].includes(status);

  return (
    <Badge
      variant={isDestructive ? "destructive" : "secondary"}
      className={cn(!isDestructive && STATUS_CLASS[status])}
    >
      {statusLabel(status)}
    </Badge>
  );
}
