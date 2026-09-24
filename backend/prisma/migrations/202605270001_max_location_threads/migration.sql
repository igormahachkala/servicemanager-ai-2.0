-- Thread MAX notifications by location inside one group.

CREATE TABLE "MaxLocationThread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "anchorMessageId" TEXT NOT NULL,
    "anchorMessageCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaxLocationThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaxLocationThread_locationId_chatId_key" ON "MaxLocationThread"("locationId", "chatId");
CREATE INDEX "MaxLocationThread_companyId_chatId_idx" ON "MaxLocationThread"("companyId", "chatId");

ALTER TABLE "MaxLocationThread" ADD CONSTRAINT "MaxLocationThread_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaxLocationThread" ADD CONSTRAINT "MaxLocationThread_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
