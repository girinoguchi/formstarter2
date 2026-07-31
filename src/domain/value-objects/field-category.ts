export const FIELD_CATEGORIES = [
  "COMPANY_NAME",
  "CONTACT_PERSON",
  "FULL_NAME",
  "FURIGANA",
  "EMAIL",
  "PHONE",
  "ADDRESS",
  "POSTAL_CODE",
  "URL",
  "INQUIRY_TYPE",
  "INQUIRY_BODY",
  "CONSENT_CHECKBOX",
  "UNKNOWN",
] as const;

export type FieldCategory = (typeof FIELD_CATEGORIES)[number];
