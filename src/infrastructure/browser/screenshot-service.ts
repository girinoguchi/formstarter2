import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserSession } from "../../domain/ports/browser-session.port";
import type { ScreenshotService } from "../../domain/ports/screenshot-service.port";
import type { ScreenshotStage } from "../../domain/value-objects/screenshot-stage";

const STAGE_FILENAMES: Record<ScreenshotStage, string> = {
  TOP_PAGE: "top",
  CONTACT_PAGE: "contact",
  AFTER_FILL: "after-fill",
  CONFIRMATION_PAGE: "confirmation",
};

function todayDateDir(): string {
  return new Date().toISOString().slice(0, 10);
}

export class FileScreenshotService implements ScreenshotService {
  async capture(session: BrowserSession, runId: string, stage: ScreenshotStage): Promise<string> {
    const buffer = await session.screenshot();

    const relativeDir = path.join("logs", todayDateDir(), runId);
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const fileName = `${STAGE_FILENAMES[stage]}.png`;
    await writeFile(path.join(absoluteDir, fileName), buffer);

    return path.join(relativeDir, fileName);
  }
}
