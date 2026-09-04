DO $$
BEGIN
  CREATE TYPE "InspectionCheckpointResponseType" AS ENUM (
    'NORMAL_PROBLEM',
    'YES_NO',
    'NUMBER',
    'TEXT',
    'PHOTO'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InspectionTemplateItem"
  ADD COLUMN IF NOT EXISTS "zoneName" TEXT,
  ADD COLUMN IF NOT EXISTS "zoneSortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "checkpointSortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "responseType" "InspectionCheckpointResponseType" NOT NULL DEFAULT 'NORMAL_PROBLEM',
  ADD COLUMN IF NOT EXISTS "numericMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "numericMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "numericUnit" TEXT;

ALTER TABLE "InspectionRunItem"
  ADD COLUMN IF NOT EXISTS "zoneName" TEXT,
  ADD COLUMN IF NOT EXISTS "zoneSortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "checkpointSortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "responseType" "InspectionCheckpointResponseType" NOT NULL DEFAULT 'NORMAL_PROBLEM',
  ADD COLUMN IF NOT EXISTS "numericMin" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "numericMax" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "numericUnit" TEXT,
  ADD COLUMN IF NOT EXISTS "booleanValue" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "numberValue" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "textValue" TEXT;

CREATE INDEX IF NOT EXISTS "InspectionTemplateItem_template_zone_checkpoint_idx"
  ON "InspectionTemplateItem"("templateId", "zoneSortOrder", "checkpointSortOrder");

CREATE INDEX IF NOT EXISTS "InspectionRunItem_run_zone_checkpoint_idx"
  ON "InspectionRunItem"("runId", "zoneSortOrder", "checkpointSortOrder");
