CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "equipmentId" TEXT;

CREATE INDEX "Equipment_companyId_locationId_idx" ON "Equipment"("companyId", "locationId");
CREATE INDEX "Equipment_companyId_status_idx" ON "Equipment"("companyId", "status");
CREATE INDEX "Equipment_locationId_status_idx" ON "Equipment"("locationId", "status");
CREATE INDEX "Ticket_equipmentId_idx" ON "Ticket"("equipmentId");

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Equipment"
ADD CONSTRAINT "Equipment_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;