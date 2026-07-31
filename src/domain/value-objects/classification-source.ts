export const CLASSIFICATION_SOURCES = ["RULE", "LLM", "CACHE"] as const;

export type ClassificationSource = (typeof CLASSIFICATION_SOURCES)[number];
