-- CreateEnum
CREATE TYPE "InspectionRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InspectionRunItemStatus" AS ENUM ('PENDING', 'OK', 'ISSUE', 'SKIPPED');

-- CreateTable
CREATE TABLE "InspectionTemplate" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionTemplateItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "InspectionRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRunItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "templateItemId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "status" "InspectionRunItemStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionTemplate_companyId_name_key" ON "InspectionTemplate"("companyId", "name");

-- CreateIndex
CREATE INDEX "InspectionTemplate_companyId_isActive_idx" ON "InspectionTemplate"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "InspectionTemplateItem_templateId_sortOrder_idx" ON "InspectionTemplateItem"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "InspectionRun_companyId_status_idx" ON "InspectionRun"("companyId", "status");

-- CreateIndex
CREATE INDEX "InspectionRun_locationId_createdAt_idx" ON "InspectionRun"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionRun_templateId_createdAt_idx" ON "InspectionRun"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionRunItem_runId_sortOrder_idx" ON "InspectionRunItem"("runId", "sortOrder");

-- CreateIndex
CREATE INDEX "InspectionRunItem_runId_status_idx" ON "InspectionRunItem"("runId", "status");

-- AddForeignKey
ALTER TABLE "InspectionTemplate" ADD CONSTRAINT "InspectionTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionTemplateItem" ADD CONSTRAINT "InspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRun" ADD CONSTRAINT "InspectionRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRun" ADD CONSTRAINT "InspectionRun_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRun" ADD CONSTRAINT "InspectionRun_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRunItem" ADD CONSTRAINT "InspectionRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InspectionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRunItem" ADD CONSTRAINT "InspectionRunItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "InspectionTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
