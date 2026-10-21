-- CreateIndex
CREATE INDEX "Ticket_slaDueAt_idx" ON "Ticket"("slaDueAt");

-- CreateIndex
CREATE INDEX "Ticket_slaBreachedAt_idx" ON "Ticket"("slaBreachedAt");

-- CreateIndex
CREATE INDEX "Ticket_companyId_slaDueAt_idx" ON "Ticket"("companyId", "slaDueAt");
