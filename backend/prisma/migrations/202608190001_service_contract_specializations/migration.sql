-- Contract-level allowed specializations for a service contract.
-- This is distinct from technician skill assignments and problem category
-- required specializations.

CREATE TABLE "ServiceContractSpecialization" (
  "id" TEXT NOT NULL,
  "serviceContractId" TEXT NOT NULL,
  "specializationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceContractSpecialization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceContractSpecialization_serviceContractId_specializationId_key"
  ON "ServiceContractSpecialization"("serviceContractId", "specializationId");
CREATE INDEX "ServiceContractSpecialization_serviceContractId_idx"
  ON "ServiceContractSpecialization"("serviceContractId");
CREATE INDEX "ServiceContractSpecialization_specializationId_idx"
  ON "ServiceContractSpecialization"("specializationId");

ALTER TABLE "ServiceContractSpecialization" ADD CONSTRAINT "ServiceContractSpecialization_serviceContractId_fkey"
  FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceContractSpecialization" ADD CONSTRAINT "ServiceContractSpecialization_specializationId_fkey"
  FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
