import type { NgEntry } from "../entities/ng-entry";

export interface NgEntryListFilter {
  ownerId: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface NgEntryPage {
  items: readonly NgEntry[];
  total: number;
}

// 全メソッドがownerIdを必須で受け取る——NGリストはアカウントごとに完全分離される。
export interface NgEntryRepository {
  list(filter: NgEntryListFilter): Promise<NgEntryPage>;
  /** 照合用に値だけを全件取得する（取り込み・送信直前チェックで使う）。 */
  listValues(ownerId: string): Promise<readonly string[]>;
  /**
   * 大文字小文字を無視して既存と重複する場合は追加せずnullを返す。
   * DBのunique制約は完全一致のみなので、揺れの吸収はここで行う。
   */
  add(ownerId: string, value: string): Promise<NgEntry | null>;
  /** 重複・既存分を除いて追加し、実際に追加された件数を返す（CSV取り込み用）。 */
  addMany(ownerId: string, values: readonly string[]): Promise<number>;
  remove(ownerId: string, ids: readonly string[]): Promise<number>;
}
