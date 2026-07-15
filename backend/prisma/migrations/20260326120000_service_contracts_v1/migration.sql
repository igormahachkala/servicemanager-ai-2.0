DO $$
BEGIN
  CREATE TYPE "ServiceContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ENDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ServiceContract" (
  "id" TEXT NOT NULL,
  "clientCompanyId" TEXT NOT NULL,
  "providerCompanyId" TEXT NOT NULL,
  "status" "ServiceContractStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "ServiceContract"
    ADD CONSTRAINT "ServiceContract_clientCompanyId_fkey"
    FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ServiceContract"
    ADD CONSTRAINT "ServiceContract_providerCompanyId_fkey"
    FOREIGN KEY ("providerCompanyId") REFERENCES "Company"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceContract_clientCompanyId_providerCompanyId_key"
  ON "ServiceContract"("clientCompanyId", "providerCompanyId");

CREATE INDEX IF NOT EXISTS "ServiceContract_clientCompanyId_status_idx"
  ON "ServiceContract"("clientCompanyId", "status");

CREATE INDEX IF NOT EXISTS "ServiceContract_providerCompanyId_status_idx"
  ON "ServiceContract"("providerCompanyId", "status");