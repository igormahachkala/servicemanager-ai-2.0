DO $$ BEGIN
    CREATE TYPE "TicketSource" AS ENUM ('INTERNAL', 'PUBLIC_QUICK_REQUEST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PublicRequestType" AS ENUM ('REPAIR', 'NOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "publicRequestEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "publicRequestToken" TEXT,
ADD COLUMN IF NOT EXISTS "publicRequestIntro" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_publicRequestToken_key" ON "Company"("publicRequestToken");

ALTER TABLE "Ticket"
ADD COLUMN IF NOT EXISTS "source" "TicketSource" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN IF NOT EXISTS "publicRequestType" "PublicRequestType";

CREATE INDEX IF NOT EXISTS "Ticket_companyId_source_idx" ON "Ticket"("companyId", "source");
