/*
  Warnings:

  - Added the required column `profileId` to the `Target` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Target" ADD COLUMN     "profileId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Target_profileId_idx" ON "Target"("profileId");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
