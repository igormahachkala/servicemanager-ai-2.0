-- CreateEnum
CREATE TYPE "ProductUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProductUpdateSource" AS ENUM ('MANUAL', 'RELEASE');

-- CreateTable
CREATE TABLE "ProductUpdate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "status" "ProductUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "ProductUpdateSource" NOT NULL DEFAULT 'MANUAL',
    "releaseCommitSha" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "howToUse" TEXT NOT NULL,
    "featurePath" TEXT,
    "media" JSONB NOT NULL DEFAULT '[]',
    "audienceRoles" "UserRole"[] DEFAULT ARRAY[]::"UserRole"[],
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductUpdate_status_publishedAt_idx" ON "ProductUpdate"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "ProductUpdate_companyId_status_idx" ON "ProductUpdate"("companyId", "status");

-- CreateIndex
CREATE INDEX "ProductUpdate_releaseCommitSha_idx" ON "ProductUpdate"("releaseCommitSha");

-- AddForeignKey
ALTER TABLE "ProductUpdate" ADD CONSTRAINT "ProductUpdate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

