-- Add a user-selected planned completion deadline separate from SLA due dates.
ALTER TABLE "Ticket" ADD COLUMN "plannedDueAt" TIMESTAMP(3);

CREATE INDEX "Ticket_companyId_plannedDueAt_idx" ON "Ticket"("companyId", "plannedDueAt");
