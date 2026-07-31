export const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
