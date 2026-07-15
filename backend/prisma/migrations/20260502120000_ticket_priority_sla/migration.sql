-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('NORMAL', 'URGENT');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL';
