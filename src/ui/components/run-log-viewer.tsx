import { Card, CardContent } from "@/components/ui/card";

import type { RunDetailDto } from "../hooks/use-run-status";

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-foreground",
  WARN: "text-amber-600 dark:text-amber-400",
  ERROR: "text-destructive",
};

export function RunLogViewer({ logs }: { logs: RunDetailDto["logs"] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">ログはまだありません。</p>;
  }

  return (
    <Card>
      <CardContent className="max-h-80 overflow-y-auto">
        <ul className="flex flex-col gap-1 font-mono text-xs">
          {logs.map((log) => (
            <li key={log.id} className={LEVEL_COLORS[log.level] ?? ""}>
              <span className="text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString("ja-JP")}</span>{" "}
              <span className="font-semibold">[{log.step}]</span> {log.message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
