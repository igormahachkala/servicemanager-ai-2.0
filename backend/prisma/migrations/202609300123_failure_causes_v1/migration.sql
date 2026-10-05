-- Failure Causes V1: company dictionary + immutable per-acceptance-attempt assessment.

CREATE TABLE "FailureCause" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FailureCause_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketFailureCauseAssessment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "ticketStatusHistoryId" TEXT NOT NULL,
  "failureCauseId" TEXT NOT NULL,
  "failureCauseNameSnapshot" TEXT NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketFailureCauseAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FailureCause_companyId_name_key" ON "FailureCause"("companyId", "name");
CREATE INDEX "FailureCause_companyId_active_idx" ON "FailureCause"("companyId", "active");

CREATE UNIQUE INDEX "TicketFailureCauseAssessment_ticketStatusHistoryId_key"
  ON "TicketFailureCauseAssessment"("ticketStatusHistoryId");
CREATE INDEX "TicketFailureCauseAssessment_companyId_createdAt_idx"
  ON "TicketFailureCauseAssessment"("companyId", "createdAt");
CREATE INDEX "TicketFailureCauseAssessment_ticketId_createdAt_idx"
  ON "TicketFailureCauseAssessment"("ticketId", "createdAt");
CREATE INDEX "TicketFailureCauseAssessment_failureCauseId_createdAt_idx"
  ON "TicketFailureCauseAssessment"("failureCauseId", "createdAt");

ALTER TABLE "FailureCause"
  ADD CONSTRAINT "FailureCause_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFailureCauseAssessment"
  ADD CONSTRAINT "TicketFailureCauseAssessment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFailureCauseAssessment"
  ADD CONSTRAINT "TicketFailureCauseAssessment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFailureCauseAssessment"
  ADD CONSTRAINT "TicketFailureCauseAssessment_ticketStatusHistoryId_fkey"
  FOREIGN KEY ("ticketStatusHistoryId") REFERENCES "TicketStatusHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketFailureCauseAssessment"
  ADD CONSTRAINT "TicketFailureCauseAssessment_failureCauseId_fkey"
  FOREIGN KEY ("failureCauseId") REFERENCES "FailureCause"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TicketFailureCauseAssessment"
  ADD CONSTRAINT "TicketFailureCauseAssessment_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
