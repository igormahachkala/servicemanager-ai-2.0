CREATE TABLE "UserLocationBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserLocationBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserLocationBinding_userId_locationId_key"
  ON "UserLocationBinding"("userId", "locationId");

CREATE INDEX "UserLocationBinding_companyId_userId_idx"
  ON "UserLocationBinding"("companyId", "userId");

CREATE INDEX "UserLocationBinding_companyId_locationId_idx"
  ON "UserLocationBinding"("companyId", "locationId");

ALTER TABLE "UserLocationBinding"
  ADD CONSTRAINT "UserLocationBinding_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLocationBinding"
  ADD CONSTRAINT "UserLocationBinding_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserLocationBinding"
  ADD CONSTRAINT "UserLocationBinding_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
