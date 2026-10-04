-- CreateEnum
CREATE TYPE "MaterialHolderType" AS ENUM ('COMPANY_STOCK', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "MaterialMovementType" AS ENUM ('PURCHASE', 'ISSUE', 'CONSUMPTION', 'RETURN', 'TRANSFER', 'ADJUSTMENT_PLUS', 'ADJUSTMENT_MINUS');

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialBalance" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "holderType" "MaterialHolderType" NOT NULL,
    "holderUserId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialBalance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MaterialBalance_quantity_nonnegative" CHECK ("quantity" >= 0),
    CONSTRAINT "MaterialBalance_holder_shape" CHECK (
      ("holderType" = 'COMPANY_STOCK' AND "holderUserId" IS NULL)
      OR ("holderType" = 'TECHNICIAN' AND "holderUserId" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "MaterialMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MaterialMovementType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "fromHolderType" "MaterialHolderType",
    "fromUserId" TEXT,
    "toHolderType" "MaterialHolderType",
    "toUserId" TEXT,
    "ticketId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,2),
    "totalAmount" DECIMAL(18,2),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MaterialMovement_quantity_positive" CHECK ("quantity" > 0),
    CONSTRAINT "MaterialMovement_unitPrice_nonnegative" CHECK ("unitPrice" IS NULL OR "unitPrice" >= 0),
    CONSTRAINT "MaterialMovement_totalAmount_nonnegative" CHECK ("totalAmount" IS NULL OR "totalAmount" >= 0),
    CONSTRAINT "MaterialMovement_from_holder_shape" CHECK (
      ("fromHolderType" IS NULL AND "fromUserId" IS NULL)
      OR ("fromHolderType" = 'COMPANY_STOCK' AND "fromUserId" IS NULL)
      OR ("fromHolderType" = 'TECHNICIAN' AND "fromUserId" IS NOT NULL)
    ),
    CONSTRAINT "MaterialMovement_to_holder_shape" CHECK (
      ("toHolderType" IS NULL AND "toUserId" IS NULL)
      OR ("toHolderType" = 'COMPANY_STOCK' AND "toUserId" IS NULL)
      OR ("toHolderType" = 'TECHNICIAN' AND "toUserId" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Material_companyId_name_key" ON "Material"("companyId", "name");
CREATE UNIQUE INDEX "Material_companyId_sku_key" ON "Material"("companyId", "sku");
CREATE INDEX "Material_companyId_active_idx" ON "Material"("companyId", "active");
CREATE INDEX "Material_companyId_category_idx" ON "Material"("companyId", "category");

CREATE UNIQUE INDEX "MaterialBalance_companyId_materialId_holderType_holderUserId_key"
  ON "MaterialBalance"("companyId", "materialId", "holderType", "holderUserId");
CREATE UNIQUE INDEX "MaterialBalance_company_stock_key"
  ON "MaterialBalance"("companyId", "materialId")
  WHERE "holderType" = 'COMPANY_STOCK' AND "holderUserId" IS NULL;
CREATE INDEX "MaterialBalance_companyId_holderType_holderUserId_idx"
  ON "MaterialBalance"("companyId", "holderType", "holderUserId");
CREATE INDEX "MaterialBalance_materialId_idx" ON "MaterialBalance"("materialId");

CREATE INDEX "MaterialMovement_companyId_materialId_createdAt_idx"
  ON "MaterialMovement"("companyId", "materialId", "createdAt");
CREATE INDEX "MaterialMovement_companyId_fromUserId_createdAt_idx"
  ON "MaterialMovement"("companyId", "fromUserId", "createdAt");
CREATE INDEX "MaterialMovement_companyId_toUserId_createdAt_idx"
  ON "MaterialMovement"("companyId", "toUserId", "createdAt");
CREATE INDEX "MaterialMovement_ticketId_type_createdAt_idx"
  ON "MaterialMovement"("ticketId", "type", "createdAt");
CREATE INDEX "MaterialMovement_actorUserId_createdAt_idx"
  ON "MaterialMovement"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialBalance" ADD CONSTRAINT "MaterialBalance_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialBalance" ADD CONSTRAINT "MaterialBalance_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialBalance" ADD CONSTRAINT "MaterialBalance_holderUserId_fkey"
  FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaterialMovement" ADD CONSTRAINT "MaterialMovement_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
