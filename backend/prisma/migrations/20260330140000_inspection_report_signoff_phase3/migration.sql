DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InspectionReportStatus') THEN
    CREATE TYPE "InspectionReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
  END IF;
END $$;

ALTER TABLE "InspectionRun"
ADD COLUMN IF NOT EXISTS "reportStatus" "InspectionReportStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS "reportSubmittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reportSubmittedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "reportReviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reportReviewedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "reportReviewComment" TEXT;

CREATE INDEX IF NOT EXISTS "InspectionRun_reportStatus_createdAt_idx"
ON "InspectionRun"("reportStatus", "createdAt");

CREATE INDEX IF NOT EXISTS "InspectionRun_reportSubmittedByUserId_createdAt_idx"
ON "InspectionRun"("reportSubmittedByUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "InspectionRun_reportReviewedByUserId_createdAt_idx"
ON "InspectionRun"("reportReviewedByUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRun_reportSubmittedByUserId_fkey'
  ) THEN
    ALTER TABLE "InspectionRun"
    ADD CONSTRAINT "InspectionRun_reportSubmittedByUserId_fkey"
    FOREIGN KEY ("reportSubmittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRun_reportReviewedByUserId_fkey'
  ) THEN
    ALTER TABLE "InspectionRun"
    ADD CONSTRAINT "InspectionRun_reportReviewedByUserId_fkey"
    FOREIGN KEY ("reportReviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;