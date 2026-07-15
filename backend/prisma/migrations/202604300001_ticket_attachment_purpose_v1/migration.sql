-- CreateEnum
CREATE TYPE "TicketAttachmentPurpose" AS ENUM ('REQUEST', 'WORK_REPORT');

-- AlterTable
ALTER TABLE "TicketAttachment"
ADD COLUMN "purpose" "TicketAttachmentPurpose" NOT NULL DEFAULT 'REQUEST';

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_purpose_createdAt_idx" ON "TicketAttachment"("ticketId", "purpose", "createdAt");
