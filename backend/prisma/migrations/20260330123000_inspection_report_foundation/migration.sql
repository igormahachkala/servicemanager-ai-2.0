ALTER TABLE "InspectionRun"
ADD COLUMN IF NOT EXISTS "performedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "InspectionRun_performedByUserId_createdAt_idx"
ON "InspectionRun"("performedByUserId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InspectionRun_performedByUserId_fkey'
  ) THEN
    ALTER TABLE "InspectionRun"
    ADD CONSTRAINT "InspectionRun_performedByUserId_fkey"
    FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;