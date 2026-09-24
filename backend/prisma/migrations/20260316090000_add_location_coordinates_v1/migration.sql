DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyType') THEN
    CREATE TYPE "CompanyType" AS ENUM ('CLIENT');
  END IF;
END $$;

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "type" "CompanyType" NOT NULL DEFAULT 'CLIENT',
  ADD COLUMN IF NOT EXISTS "allowTechnicianClaim" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "slaStrictMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "Company"
SET "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "Company"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "ProblemCategory"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "ProblemCategory"
SET "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "ProblemCategory"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "Specialization"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "Specialization"
SET "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "Specialization"
  ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

UPDATE "User"
SET "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "clientCompanyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "platformCode" TEXT NOT NULL,
  "externalCode" TEXT,
  "city" TEXT,
  "region" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Location_clientCompanyId_fkey'
  ) THEN
    ALTER TABLE "Location"
      ADD CONSTRAINT "Location_clientCompanyId_fkey"
      FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Location_clientCompanyId_isActive_idx"
  ON "Location"("clientCompanyId", "isActive");

CREATE INDEX IF NOT EXISTS "Location_clientCompanyId_city_idx"
  ON "Location"("clientCompanyId", "city");

CREATE UNIQUE INDEX IF NOT EXISTS "Location_clientCompanyId_platformCode_key"
  ON "Location"("clientCompanyId", "platformCode");

INSERT INTO "Location" (
  "id",
  "clientCompanyId",
  "name",
  "platformCode",
  "address",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT DISTINCT
  'migrated-location-' || t."companyId",
  t."companyId",
  'Migrated location',
  'legacy-default',
  NULLIF(MAX(t."address") OVER (PARTITION BY t."companyId"), ''),
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Ticket" t
WHERE t."companyId" IS NOT NULL
ON CONFLICT ("clientCompanyId", "platformCode") DO NOTHING;

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "locationId" TEXT;

UPDATE "Ticket"
SET "locationId" = 'migrated-location-' || "companyId"
WHERE "locationId" IS NULL;

ALTER TABLE "Ticket"
  ALTER COLUMN "locationId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Ticket_locationId_fkey'
  ) THEN
    ALTER TABLE "Ticket"
      ADD CONSTRAINT "Ticket_locationId_fkey"
      FOREIGN KEY ("locationId") REFERENCES "Location"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Ticket_locationId_idx"
  ON "Ticket"("locationId");

CREATE INDEX IF NOT EXISTS "ProblemCategory_companyId_isActive_idx"
  ON "ProblemCategory"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "Specialization_companyId_isActive_idx"
  ON "Specialization"("companyId", "isActive");

CREATE INDEX IF NOT EXISTS "User_companyId_role_idx"
  ON "User"("companyId", "role");

CREATE INDEX IF NOT EXISTS "User_companyId_isActive_idx"
  ON "User"("companyId", "isActive");