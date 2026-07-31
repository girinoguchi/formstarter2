-- CreateEnum
CREATE TYPE "RunKind" AS ENUM ('EXPLORE', 'FILL');

-- AlterEnum
ALTER TYPE "RunStatus" ADD VALUE 'READY';

-- AlterEnum
ALTER TYPE "TargetStatus" ADD VALUE 'READY';

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "kind" "RunKind" NOT NULL DEFAULT 'FILL';
