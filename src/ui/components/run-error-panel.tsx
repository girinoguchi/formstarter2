import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { errorStepLabel } from "../../domain/value-objects/error-step";
import type { RunDetailDto } from "../hooks/use-run-status";

const ERROR_STATUSES = new Set(["BLOCKED", "NOT_SENDABLE", "FAILED", "NEEDS_REVIEW"]);

const STATUS_GUIDANCE: Record<string, string> = {
  BLOCKED: "Cloudflare/reCAPTCHA等の保護により自動化を停止しました。手動で確認してください。",
  NOT_SENDABLE: "この対象には自動入力できませんでした。サイトを直接確認してください。",
  FAILED: "実行中にエラーが発生しました。ログを確認し、必要であれば再実行してください。",
  NEEDS_REVIEW: "一部の項目が未解決、または入力に失敗した可能性があります。内容を確認してください。",
};

export function RunErrorPanel({ run }: { run: RunDetailDto }) {
  if (!ERROR_STATUSES.has(run.status)) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle />
      <AlertTitle>{STATUS_GUIDANCE[run.status]}</AlertTitle>
      <AlertDescription>
        {run.errorStep && <p>{errorStepLabel(run.errorStep)}</p>}
        {run.errorMessage && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{run.errorMessage}</pre>}
      </AlertDescription>
    </Alert>
  );
}
