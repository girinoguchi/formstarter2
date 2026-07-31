/**
 * EXPLORE: 可視タブを開かず「送信可能か」だけを確認するRun。
 * FILL: 確認済みの問い合わせページに実際に入力していく、可視タブを伴うRun。
 */
export const RUN_KINDS = ["EXPLORE", "FILL"] as const;

export type RunKind = (typeof RUN_KINDS)[number];
