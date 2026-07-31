export const SCREENSHOT_STAGES = [
  "TOP_PAGE",
  "CONTACT_PAGE",
  "AFTER_FILL",
  "CONFIRMATION_PAGE",
] as const;

export type ScreenshotStage = (typeof SCREENSHOT_STAGES)[number];
