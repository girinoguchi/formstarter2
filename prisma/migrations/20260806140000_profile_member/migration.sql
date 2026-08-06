-- 管理者が作ったProfileを作業者に使わせるため、Profileへのアクセス権を
-- 「所有者1人(ownerId)」から「割り当てられたユーザー(ProfileMember)」に広げる。
--
-- 併せてisActive（今どのプロジェクトを選んでいるか）をProfileからProfileMemberへ移す。
-- 共有される値ではなくユーザーごとの選択状態のため、Profile側に残すと1人の切り替えが
-- 共有相手全員に波及してしまう。

-- 1. 割り当てテーブル
CREATE TABLE "ProfileMember" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileMember_profileId_userId_key" ON "ProfileMember"("profileId", "userId");
CREATE INDEX "ProfileMember_userId_idx" ON "ProfileMember"("userId");

ALTER TABLE "ProfileMember" ADD CONSTRAINT "ProfileMember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileMember" ADD CONSTRAINT "ProfileMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. 既存Profileの所有者を、そのまま割り当て済みユーザーとして引き継ぐ。
--    現在の選択状態(Profile.isActive)も所有者の選択として移す。
INSERT INTO "ProfileMember" ("id", "profileId", "userId", "isActive", "createdAt")
SELECT
    'pmb' || replace(gen_random_uuid()::text, '-', ''),
    "id",
    "ownerId",
    "isActive",
    CURRENT_TIMESTAMP
FROM "Profile";

-- 3. 移設が済んだのでProfile側からは落とす
ALTER TABLE "Profile" DROP COLUMN "isActive";
