-- Optional object scope for a service contract. No rows means all active
-- locations of the client (backward-compatible); one or more rows restrict
-- the provider to the selected objects.

CREATE TABLE "ServiceContractLocation" (
  "id" TEXT NOT NULL,
  "serviceContractId" TEXT NOT NULL,
  "clientCompanyId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceContractLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceContractLocation_serviceContractId_locationId_key"
  ON "ServiceContractLocation"("serviceContractId", "locationId");
CREATE INDEX "ServiceContractLocation_clientCompanyId_locationId_idx"
  ON "ServiceContractLocation"("clientCompanyId", "locationId");
CREATE INDEX "ServiceContractLocation_locationId_idx"
  ON "ServiceContractLocation"("locationId");

ALTER TABLE "ServiceContractLocation" ADD CONSTRAINT "ServiceContractLocation_serviceContractId_fkey"
  FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceContractLocation" ADD CONSTRAINT "ServiceContractLocation_clientCompanyId_fkey"
  FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceContractLocation" ADD CONSTRAINT "ServiceContractLocation_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
