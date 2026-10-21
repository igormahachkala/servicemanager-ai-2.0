-- DropIndex
DROP INDEX "InspectionRun_reportNumber_idx";

-- AlterTable
ALTER TABLE "ServiceContract" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AssignmentDecision" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "technicianId" TEXT,
    "candidatesCount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentDecision_ticketId_createdAt_idx" ON "AssignmentDecision"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentDecision_technicianId_createdAt_idx" ON "AssignmentDecision"("technicianId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentDecision_createdAt_idx" ON "AssignmentDecision"("createdAt");

-- RenameIndex
ALTER INDEX "TechnicianClientBinding_technicianUserId_clientCompanyId_locati" RENAME TO "TechnicianClientBinding_technicianUserId_clientCompanyId_lo_key";
