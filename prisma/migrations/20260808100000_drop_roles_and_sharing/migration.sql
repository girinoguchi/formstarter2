-- 営業マン個人向けのプロダクトに変わり、管理者/作業者の区別とプロジェクトの共有
-- （管理者が作った送信内容を作業者に割り当てる仕組み）が不要になったため撤去する。
-- 全アカウントが対等で、それぞれ自分のプロジェクトだけを持ち、自分で送信内容を設定する。

-- 1. 「今どのプロジェクトを選んでいるか」をProfileへ戻す。
--    共有がなくなり1 Profile = 1ユーザーになったので、割り当て側に置く理由がなくなった。
ALTER TABLE "Profile" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;

-- 2. 所有者自身の選択状態を引き継ぐ（共有相手の選択は、そのProfileごと使えなくなるので捨てる）
UPDATE "Profile" AS p
SET "isActive" = m."isActive"
FROM "ProfileMember" AS m
WHERE m."profileId" = p."id" AND m."userId" = p."ownerId";

-- 3. 割り当てテーブルを撤去
DROP TABLE "ProfileMember";

-- 4. 役割の区別を撤去
ALTER TABLE "User" DROP COLUMN "isAdmin";
