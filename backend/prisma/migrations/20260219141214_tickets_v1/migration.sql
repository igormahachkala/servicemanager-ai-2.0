/*
  Warnings:

  - A unique constraint covering the columns `[companyId,name]` on the table `ProblemCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "TicketUrgency" AS ENUM ('URGENT', 'NOT_URGENT');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "requesterName" TEXT,
    "requesterPhone" TEXT,
    "address" TEXT,
    "pointName" TEXT,
    "problemCategoryId" TEXT NOT NULL,
    "problemText" TEXT NOT NULL,
    "urgency" "TicketUrgency" NOT NULL DEFAULT 'NOT_URGENT',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "slaMinutes" INTEGER,
    "assignedTechnicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ticket_companyId_status_idx" ON "Ticket"("companyId", "status");

-- CreateIndex
CREATE INDEX "Ticket_companyId_createdAt_idx" ON "Ticket"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemCategory_companyId_name_key" ON "ProblemCategory"("companyId", "name");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_problemCategoryId_fkey" FOREIGN KEY ("problemCategoryId") REFERENCES "ProblemCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
