ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "publicRequestAllowPhotos" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "publicRequestMaxPhotos" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "publicRequestRequirePhone" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "publicRequestDefaultType" "PublicRequestType",
  ADD COLUMN IF NOT EXISTS "publicRequestRateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "publicRequestLocationPresetMode" TEXT DEFAULT 'HIDE_WHEN_VALID';

UPDATE "Company"
SET "publicRequestDefaultType" = 'REPAIR'
WHERE "publicRequestEnabled" = true AND "publicRequestDefaultType" IS NULL;

CREATE TABLE IF NOT EXISTS "PublicRequestLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ipHash" TEXT,
  "phoneHash" TEXT,
  "locationId" TEXT,
  "channel" TEXT,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicRequestLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PublicRequestLog"
    ADD CONSTRAINT "PublicRequestLog_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "PublicRequestLog_companyId_createdAt_idx"
  ON "PublicRequestLog"("companyId", "createdAt");

CREATE INDEX IF NOT EXISTS "PublicRequestLog_companyId_tokenHash_ipHash_createdAt_idx"
  ON "PublicRequestLog"("companyId", "tokenHash", "ipHash", "createdAt");

CREATE INDEX IF NOT EXISTS "PublicRequestLog_companyId_phoneHash_locationId_createdAt_idx"
  ON "PublicRequestLog"("companyId", "phoneHash", "locationId", "createdAt");
