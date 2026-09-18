-- SMA-TICKET-REPLY-V1-BACKEND-FOUNDATION-120H
--
-- Additive only: one new table. No existing table is altered, and no existing row in
-- DomainEvent or TicketStatusHistory is read, updated or deleted. Historical comments stay
-- exactly where they are and keep being read the way they are read today; there is no
-- backfill here on purpose — COMMENT_ADDED carries five different payload.source values, so
-- "which of those rows is a chat message" is a product decision, not a deterministic mapping.
--
-- Safe for a rolling deploy: a backend without this release simply never selects from the
-- new table, and nothing it does select has changed.
--
-- companyId is present because the multi-tenant rule of docs/DATABASE_MIGRATION_POLICY.md
-- requires it on every domain table; the exceptions there are PermissionBlock and system
-- tables, and a ticket comment is neither.

CREATE TABLE IF NOT EXISTS "TicketComment" (
  "id"           TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "ticketId"     TEXT NOT NULL,
  "authorUserId" TEXT,
  "body"         TEXT NOT NULL,
  "replyToId"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- Чтение ленты одной заявки в хронологическом порядке — основной запрос.
CREATE INDEX IF NOT EXISTS "TicketComment_ticketId_createdAt_idx"
  ON "TicketComment"("ticketId", "createdAt");

CREATE INDEX IF NOT EXISTS "TicketComment_companyId_createdAt_idx"
  ON "TicketComment"("companyId", "createdAt");

-- Обратная сторона связи ответа: по исходному сообщению находятся его ответы.
CREATE INDEX IF NOT EXISTS "TicketComment_replyToId_idx"
  ON "TicketComment"("replyToId");

DO $$
BEGIN
  ALTER TABLE "TicketComment"
    ADD CONSTRAINT "TicketComment_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TicketComment"
    ADD CONSTRAINT "TicketComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Автор может быть удалён, сообщение остаётся: история обслуживания живёт дольше
-- учётной записи. То же правило, что у TicketStatusHistory.changedByUserId.
DO $$
BEGIN
  ALTER TABLE "TicketComment"
    ADD CONSTRAINT "TicketComment_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ссылка на исходное сообщение. SET NULL, а не CASCADE: удаление исходного
-- сообщения не должно уносить с собой ответы на него — ответ остаётся в ленте,
-- а интерфейс показывает «Исходное сообщение недоступно».
DO $$
BEGIN
  ALTER TABLE "TicketComment"
    ADD CONSTRAINT "TicketComment_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "TicketComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
