-- SMA-OFFLINE-IDEMPOTENCY-113B
--
-- Additive only: one new enum, one new table. No existing row is read, updated or deleted, and
-- no existing table is altered.

DO $$
BEGIN
  CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
  "id"               TEXT NOT NULL,
  "companyId"        TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "operationType"    TEXT NOT NULL,
  "key"              TEXT NOT NULL,
  "fingerprint"      TEXT NOT NULL,
  "status"           "IdempotencyRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "resultEntityType" TEXT,
  "resultEntityId"   TEXT,
  "storageKey"       TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  "completedAt"      TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- The concurrency primitive. Two simultaneous retries of the same queued operation race to
-- insert; exactly one wins and performs the domain write, the loser waits for its result.
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_scope_key_key"
  ON "IdempotencyRecord"("companyId", "userId", "operationType", "key");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx"
  ON "IdempotencyRecord"("expiresAt");

CREATE INDEX IF NOT EXISTS "IdempotencyRecord_companyId_createdAt_idx"
  ON "IdempotencyRecord"("companyId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "IdempotencyRecord"
    ADD CONSTRAINT "IdempotencyRecord_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
