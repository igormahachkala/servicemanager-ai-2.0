-- Add deterministic notification dedupe key.
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

UPDATE "Notification" SET "dedupeKey" = "id" WHERE "dedupeKey" IS NULL;

ALTER TABLE "Notification" ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
