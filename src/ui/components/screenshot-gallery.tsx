import { Card } from "@/components/ui/card";

import type { RunDetailDto } from "../hooks/use-run-status";

const STAGE_LABELS: Record<string, string> = {
  TOP_PAGE: "トップページ",
  CONTACT_PAGE: "お問い合わせページ",
  AFTER_FILL: "入力後",
  CONFIRMATION_PAGE: "確認画面",
};

export function ScreenshotGallery({ screenshots }: { screenshots: RunDetailDto["screenshots"] }) {
  if (screenshots.length === 0) {
    return <p className="text-sm text-muted-foreground">スクリーンショットはまだありません。</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {screenshots.map((shot) => (
        <a key={shot.id} href={`/${shot.filePath}`} target="_blank" rel="noopener noreferrer" className="block">
          <Card className="overflow-hidden py-0">
            <img src={`/${shot.filePath}`} alt={STAGE_LABELS[shot.stage] ?? shot.stage} className="w-full" />
          </Card>
          <p className="mt-1 text-center text-xs text-muted-foreground">{STAGE_LABELS[shot.stage] ?? shot.stage}</p>
        </a>
      ))}
    </div>
  );
}
