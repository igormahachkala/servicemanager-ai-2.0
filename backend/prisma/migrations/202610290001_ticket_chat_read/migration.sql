-- Существующим пользователям отметка ставится временем выкатки: переписка,
-- накопленная до появления индикатора, считается прочитанной.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "chatReadBaseline" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "TicketChatRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketChatRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketChatRead_ticketId_idx" ON "TicketChatRead"("ticketId");

-- CreateIndex
CREATE INDEX "TicketChatRead_updatedAt_idx" ON "TicketChatRead"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketChatRead_userId_ticketId_key" ON "TicketChatRead"("userId", "ticketId");

-- AddForeignKey
ALTER TABLE "TicketChatRead" ADD CONSTRAINT "TicketChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketChatRead" ADD CONSTRAINT "TicketChatRead_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
