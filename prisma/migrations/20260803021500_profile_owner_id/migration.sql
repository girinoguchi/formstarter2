-- アカウントごとにデータを完全分離するため、Profileに所有者(ownerId)を追加する。
-- 既存データは全てashitagogo123@gmail.comの所有として引き継ぐ。

-- 1. まずnullable列として追加（既存行がある状態でNOT NULLは張れないため）
ALTER TABLE "Profile" ADD COLUMN "ownerId" TEXT;

-- 2. 既存のProfileを全てashitagogo123@gmail.comに紐付ける
UPDATE "Profile"
SET "ownerId" = (SELECT "id" FROM "User" WHERE "username" = 'ashitagogo123@gmail.com')
WHERE "ownerId" IS NULL;

-- 3. バックフィル完了後にNOT NULL化
ALTER TABLE "Profile" ALTER COLUMN "ownerId" SET NOT NULL;

-- 4. 外部キー制約とインデックス
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Profile_ownerId_idx" ON "Profile"("ownerId");
