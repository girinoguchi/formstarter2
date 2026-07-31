import type { BrowserSession } from "./browser-session.port";

export interface ValidationErrorField {
  selector: string;
  message: string | null;
}

export interface ValidationErrorParser {
  findErrors(session: BrowserSession, frameUrl?: string): Promise<readonly ValidationErrorField[]>;
}
