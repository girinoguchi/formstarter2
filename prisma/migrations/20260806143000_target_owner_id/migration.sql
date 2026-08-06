-- Profileを共有しても、リスト（送信先URL）と送信結果は共有しない。
-- そのためTargetに追加者(ownerId)を持たせ、一覧・集計・エクスポートを本人のものだけに絞る。
--
-- headedブラウザをどの顧客PCへ中継するかも、これまではProfile.ownerIdで決めていた。
-- 共有後はそれだと作業者の実行が管理者のPCで開いてしまうため、Target.ownerIdへ寄せる。

-- 1. まずnullable列として追加（既存行がある状態でNOT NULLは張れないため）
ALTER TABLE "Target" ADD COLUMN "ownerId" TEXT;

-- 2. 共有前の既存Targetは、そのプロジェクトの作成者が追加したものとして引き継ぐ
UPDATE "Target" AS t
SET "ownerId" = p."ownerId"
FROM "Profile" AS p
WHERE p."id" = t."profileId" AND t."ownerId" IS NULL;

-- 3. バックフィル完了後にNOT NULL化
ALTER TABLE "Target" ALTER COLUMN "ownerId" SET NOT NULL;

-- 4. 外部キー制約とインデックス
ALTER TABLE "Target" ADD CONSTRAINT "Target_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Target_profileId_ownerId_idx" ON "Target"("profileId", "ownerId");
