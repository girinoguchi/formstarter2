-- DropForeignKey
ALTER TABLE "Run" DROP CONSTRAINT "Run_targetId_fkey";

-- DropForeignKey
ALTER TABLE "RunFieldClassification" DROP CONSTRAINT "RunFieldClassification_runId_fkey";

-- DropForeignKey
ALTER TABLE "RunLog" DROP CONSTRAINT "RunLog_runId_fkey";

-- DropForeignKey
ALTER TABLE "Screenshot" DROP CONSTRAINT "Screenshot_runId_fkey";

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunLog" ADD CONSTRAINT "RunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunFieldClassification" ADD CONSTRAINT "RunFieldClassification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
