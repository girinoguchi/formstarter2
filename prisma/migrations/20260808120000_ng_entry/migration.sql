-- 送信してはいけないドメイン・URLのリスト（NGリスト）。
-- アカウント単位で持ち、そのユーザーの全プロジェクトに効く。

CREATE TABLE "NgEntry" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NgEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NgEntry_ownerId_value_key" ON "NgEntry"("ownerId", "value");
CREATE INDEX "NgEntry_ownerId_idx" ON "NgEntry"("ownerId");

ALTER TABLE "NgEntry" ADD CONSTRAINT "NgEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NGリスト一致でBLOCKEDにした理由を持たせる。実行前に弾くためRunが無く、
-- 一覧の失敗理由（直近Runのerror）では説明できないため。
ALTER TABLE "Target" ADD COLUMN "blockReason" TEXT;
