ALTER TYPE "InspectionRunItemStatus" ADD VALUE IF NOT EXISTS 'CRITICAL';

ALTER TABLE "InspectionRun"
ADD COLUMN IF NOT EXISTS "equipmentId" TEXT;

ALTER TABLE "InspectionRunItem"
ADD COLUMN IF NOT EXISTS "requiresRepair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ticketId" TEXT;

CREATE TABLE IF NOT EXISTS "InspectionRunItemAttachment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "runItemId" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InspectionRunItemAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InspectionRun_equipmentId_createdAt_idx" ON "InspectionRun"("equipmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "InspectionRunItem_ticketId_idx" ON "InspectionRunItem"("ticketId");
CREATE INDEX IF NOT EXISTS "InspectionRunItemAttachment_companyId_runItemId_idx" ON "InspectionRunItemAttachment"("companyId", "runItemId");
CREATE INDEX IF NOT EXISTS "InspectionRunItemAttachment_runItemId_createdAt_idx" ON "InspectionRunItemAttachment"("runItemId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRunItem_ticketId_key'
  ) THEN
    ALTER TABLE "InspectionRunItem"
    ADD CONSTRAINT "InspectionRunItem_ticketId_key" UNIQUE ("ticketId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRun_equipmentId_fkey'
  ) THEN
    ALTER TABLE "InspectionRun"
    ADD CONSTRAINT "InspectionRun_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRunItem_ticketId_fkey'
  ) THEN
    ALTER TABLE "InspectionRunItem"
    ADD CONSTRAINT "InspectionRunItem_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRunItemAttachment_companyId_fkey'
  ) THEN
    ALTER TABLE "InspectionRunItemAttachment"
    ADD CONSTRAINT "InspectionRunItemAttachment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRunItemAttachment_runItemId_fkey'
  ) THEN
    ALTER TABLE "InspectionRunItemAttachment"
    ADD CONSTRAINT "InspectionRunItemAttachment_runItemId_fkey"
    FOREIGN KEY ("runItemId") REFERENCES "InspectionRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;