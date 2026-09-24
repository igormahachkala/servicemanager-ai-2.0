CREATE TABLE "TechnicianClientBinding" (
  "id" TEXT NOT NULL,
  "providerCompanyId" TEXT NOT NULL,
  "technicianUserId" TEXT NOT NULL,
  "clientCompanyId" TEXT NOT NULL,
  "locationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TechnicianClientBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TechnicianClientBinding_technicianUserId_clientCompanyId_locationI_key"
  ON "TechnicianClientBinding"("technicianUserId", "clientCompanyId", "locationId");
CREATE INDEX "TechnicianClientBinding_providerCompanyId_technicianUserId_idx"
  ON "TechnicianClientBinding"("providerCompanyId", "technicianUserId");
CREATE INDEX "TechnicianClientBinding_clientCompanyId_idx"
  ON "TechnicianClientBinding"("clientCompanyId");
CREATE INDEX "TechnicianClientBinding_locationId_idx"
  ON "TechnicianClientBinding"("locationId");

ALTER TABLE "TechnicianClientBinding"
  ADD CONSTRAINT "TechnicianClientBinding_providerCompanyId_fkey"
  FOREIGN KEY ("providerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TechnicianClientBinding"
  ADD CONSTRAINT "TechnicianClientBinding_technicianUserId_fkey"
  FOREIGN KEY ("technicianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TechnicianClientBinding"
  ADD CONSTRAINT "TechnicianClientBinding_clientCompanyId_fkey"
  FOREIGN KEY ("clientCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TechnicianClientBinding"
  ADD CONSTRAINT "TechnicianClientBinding_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;