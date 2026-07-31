import type { ScreenshotStage } from "../value-objects/screenshot-stage";
import type { BrowserSession } from "./browser-session.port";

export interface ScreenshotService {
  /** public/ からの相対パスを返す（DBのScreenshot.filePathに保存される） */
  capture(session: BrowserSession, runId: string, stage: ScreenshotStage): Promise<string>;
}
