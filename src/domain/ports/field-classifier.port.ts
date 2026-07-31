import type { FieldClassification } from "../entities/field-classification";
import type { ParsedFormField } from "../entities/form-field";

export interface FieldClassifierContext {
  hostKey: string;
  formSignatureHash: string;
}

export interface FieldClassifier {
  classify(
    fields: readonly ParsedFormField[],
    context: FieldClassifierContext,
  ): Promise<readonly FieldClassification[]>;
}
