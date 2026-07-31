import type { FieldClassification } from "../entities/field-classification";

export interface FieldMappingCache {
  find(hostKey: string, formSignatureHash: string): Promise<readonly FieldClassification[] | null>;
  save(
    hostKey: string,
    formSignatureHash: string,
    classifications: readonly FieldClassification[],
  ): Promise<void>;
}
