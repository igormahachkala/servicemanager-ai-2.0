CREATE SEQUENCE IF NOT EXISTS "Ticket_ticketNumber_seq";

ALTER TABLE "Ticket"
ADD COLUMN "ticketNumber" INTEGER;

ALTER SEQUENCE "Ticket_ticketNumber_seq" OWNED BY "Ticket"."ticketNumber";

UPDATE "Ticket"
SET "ticketNumber" = nextval('"Ticket_ticketNumber_seq"'::regclass)
WHERE "ticketNumber" IS NULL;

SELECT setval(
  '"Ticket_ticketNumber_seq"'::regclass,
  COALESCE((SELECT MAX("ticketNumber") FROM "Ticket"), 1),
  COALESCE((SELECT MAX("ticketNumber") FROM "Ticket"), 0) > 0
);

ALTER TABLE "Ticket"
ALTER COLUMN "ticketNumber" SET DEFAULT nextval('"Ticket_ticketNumber_seq"'::regclass);

ALTER TABLE "Ticket"
ALTER COLUMN "ticketNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON "Ticket"("ticketNumber");