-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'AWAITING_SEND', 'NEEDS_REVIEW', 'BLOCKED', 'NOT_SENDABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'LAUNCHING_BROWSER', 'LOADING_SITE', 'FINDING_CONTACT_PAGE', 'PARSING_FORM', 'CLASSIFYING_FIELDS', 'FILLING_FORM', 'HANDLING_VALIDATION', 'REACHED_CONFIRMATION', 'AWAITING_SEND', 'NEEDS_REVIEW', 'BLOCKED', 'NOT_SENDABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "ScreenshotStage" AS ENUM ('TOP_PAGE', 'CONTACT_PAGE', 'AFTER_FILL', 'CONFIRMATION_PAGE');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "FieldCategory" AS ENUM ('COMPANY_NAME', 'CONTACT_PERSON', 'FULL_NAME', 'FURIGANA', 'EMAIL', 'PHONE', 'ADDRESS', 'POSTAL_CODE', 'URL', 'INQUIRY_TYPE', 'INQUIRY_BODY', 'CONSENT_CHECKBOX', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('RULE', 'LLM', 'CACHE');

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Target" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "companyName" TEXT,
    "status" "TargetStatus" NOT NULL DEFAULT 'PENDING',
    "contactPageUrl" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'PENDING',
    "contactPageUrl" TEXT,
    "formSelector" TEXT,
    "windowLabel" TEXT,
    "errorStep" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screenshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" "ScreenshotStage" NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMappingCache" (
    "id" TEXT NOT NULL,
    "hostKey" TEXT NOT NULL,
    "formSignatureHash" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMappingCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunFieldClassification" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fieldSelector" TEXT NOT NULL,
    "fieldLabel" TEXT,
    "category" "FieldCategory" NOT NULL,
    "source" "ClassificationSource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "filledValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunFieldClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "fullName" TEXT,
    "furigana" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "postalCode" TEXT,
    "address" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "inquiryType" TEXT,
    "inquiryBody" TEXT NOT NULL,
    "consentPolicy" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Target_status_idx" ON "Target"("status");

-- CreateIndex
CREATE INDEX "Run_targetId_idx" ON "Run"("targetId");

-- CreateIndex
CREATE INDEX "Run_status_idx" ON "Run"("status");

-- CreateIndex
CREATE INDEX "Screenshot_runId_idx" ON "Screenshot"("runId");

-- CreateIndex
CREATE INDEX "RunLog_runId_idx" ON "RunLog"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldMappingCache_hostKey_formSignatureHash_key" ON "FieldMappingCache"("hostKey", "formSignatureHash");

-- CreateIndex
CREATE INDEX "RunFieldClassification_runId_idx" ON "RunFieldClassification"("runId");

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunLog" ADD CONSTRAINT "RunLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunFieldClassification" ADD CONSTRAINT "RunFieldClassification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
