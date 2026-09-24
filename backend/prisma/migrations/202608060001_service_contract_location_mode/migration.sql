CREATE TYPE "ServiceContractLocationMode" AS ENUM ('ALL_LOCATIONS', 'SELECTED_LOCATIONS', 'INHERIT_PRIMARY');

ALTER TABLE "ServiceContract"
  ADD COLUMN "locationMode" "ServiceContractLocationMode" NOT NULL DEFAULT 'ALL_LOCATIONS';

UPDATE "ServiceContract"
SET "locationMode" = 'SELECTED_LOCATIONS'
WHERE "id" IN (
  SELECT DISTINCT "serviceContractId"
  FROM "ServiceContractLocation"
);

CREATE INDEX "ServiceContract_clientCompanyId_role_status_idx"
  ON "ServiceContract"("clientCompanyId", "role", "status");
