-- Explicit access scope mode for Access Constructor V1D.
-- No data backfill: legacy users without a row keep existing runtime behavior.

CREATE TYPE "UserAccessLocationMode" AS ENUM ('SELECTED_LOCATIONS', 'RESTRICTED_EMPTY');

CREATE TABLE "UserAccessScope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationMode" "UserAccessLocationMode" NOT NULL DEFAULT 'SELECTED_LOCATIONS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAccessScope_userId_companyId_key" ON "UserAccessScope"("userId", "companyId");
CREATE INDEX "UserAccessScope_companyId_locationMode_idx" ON "UserAccessScope"("companyId", "locationMode");

ALTER TABLE "UserAccessScope"
  ADD CONSTRAINT "UserAccessScope_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAccessScope"
  ADD CONSTRAINT "UserAccessScope_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
