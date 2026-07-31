/*
  Warnings:

  - You are about to drop the column `contactPerson` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Profile` table. All the data in the column will be lost.
  - Made the column `fullName` on table `Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `furigana` on table `Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `postalCode` on table `Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `websiteUrl` on table `Profile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `inquiryType` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "contactPerson",
DROP COLUMN "phone",
ADD COLUMN     "companyNameKana" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "department" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "employeeCount" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstNameKana" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "industry" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "jobTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastNameKana" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone1" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone2" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone3" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "companyName" SET DEFAULT '',
ALTER COLUMN "fullName" SET NOT NULL,
ALTER COLUMN "fullName" SET DEFAULT '',
ALTER COLUMN "furigana" SET NOT NULL,
ALTER COLUMN "furigana" SET DEFAULT '',
ALTER COLUMN "email" SET DEFAULT '',
ALTER COLUMN "postalCode" SET NOT NULL,
ALTER COLUMN "postalCode" SET DEFAULT '',
ALTER COLUMN "address" SET DEFAULT '',
ALTER COLUMN "websiteUrl" SET NOT NULL,
ALTER COLUMN "websiteUrl" SET DEFAULT '',
ALTER COLUMN "inquiryType" SET NOT NULL,
ALTER COLUMN "inquiryType" SET DEFAULT '',
ALTER COLUMN "inquiryBody" SET DEFAULT '';
