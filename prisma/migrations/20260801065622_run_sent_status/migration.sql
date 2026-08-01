-- AlterEnum
ALTER TYPE "RunStatus" ADD VALUE 'SENT';

-- AlterEnum
ALTER TYPE "TargetStatus" ADD VALUE 'SENT';

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "sentAt" TIMESTAMP(3);
