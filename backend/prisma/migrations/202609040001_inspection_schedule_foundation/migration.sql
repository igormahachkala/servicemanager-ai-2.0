-- SMA-ROUNDS-V1-SCHEDULE-MIGRATION-089
-- Adopt the existing schema-only Inspection schedule layer as a tracked migration.
--
-- Scope is deliberately Class A only:
--   * create InspectionFrequency with ONCE
--   * create InspectionSchedule
--   * add nullable schedule/due timestamps to InspectionRun
--   * add schedule indexes and foreign keys
--
-- No existing InspectionRun rows are updated. No Class B historical drift is touched.

CREATE TYPE "InspectionFrequency" AS ENUM (
  'ONCE',
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'CUSTOM'
);

CREATE TABLE "InspectionSchedule" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "equipmentId" TEXT,
  "assignedToUserId" TEXT,
  "createdByUserId" TEXT,
  "name" TEXT NOT NULL,
  "frequency" "InspectionFrequency" NOT NULL DEFAULT 'ONCE',
  "intervalDays" INTEGER,
  "startDate" TIMESTAMP(3) NOT NULL,
  "nextDueAt" TIMESTAMP(3) NOT NULL,
  "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
  "graceDays" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastGeneratedAt" TIMESTAMP(3),
  "lastRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InspectionSchedule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InspectionRun"
ADD COLUMN "scheduleId" TEXT,
ADD COLUMN "dueAt" TIMESTAMP(3),
ADD COLUMN "overdueAt" TIMESTAMP(3);

CREATE INDEX "InspectionSchedule_companyId_isActive_idx"
ON "InspectionSchedule"("companyId", "isActive");

CREATE INDEX "InspectionSchedule_isActive_nextDueAt_idx"
ON "InspectionSchedule"("isActive", "nextDueAt");

CREATE INDEX "InspectionSchedule_locationId_isActive_idx"
ON "InspectionSchedule"("locationId", "isActive");

CREATE INDEX "InspectionSchedule_assignedToUserId_isActive_idx"
ON "InspectionSchedule"("assignedToUserId", "isActive");

CREATE INDEX "InspectionSchedule_templateId_idx"
ON "InspectionSchedule"("templateId");

CREATE INDEX "InspectionRun_scheduleId_createdAt_idx"
ON "InspectionRun"("scheduleId", "createdAt");

CREATE INDEX "InspectionRun_companyId_dueAt_idx"
ON "InspectionRun"("companyId", "dueAt");

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_templateId_fkey"
FOREIGN KEY ("templateId") REFERENCES "InspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionSchedule"
ADD CONSTRAINT "InspectionSchedule_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InspectionRun"
ADD CONSTRAINT "InspectionRun_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "InspectionSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
