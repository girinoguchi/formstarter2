export interface NgEntry {
  id: string;
  ownerId: string;
  /** ドメインまたはURLの一部。部分一致で照合する。 */
  value: string;
  createdAt: Date;
}
