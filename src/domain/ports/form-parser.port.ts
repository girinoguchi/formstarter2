import type { ParsedForm } from "../entities/form-field";
import type { BrowserSession } from "./browser-session.port";

export interface FormParser {
  parseForms(session: BrowserSession): Promise<readonly ParsedForm[]>;
}
