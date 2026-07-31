import type { ClassificationSource } from "../value-objects/classification-source";
import type { FieldCategory } from "../value-objects/field-category";

export interface FieldClassification {
  fieldSelector: string;
  fieldLabel: string | null;
  category: FieldCategory;
  source: ClassificationSource;
  confidence: number | null;
}
