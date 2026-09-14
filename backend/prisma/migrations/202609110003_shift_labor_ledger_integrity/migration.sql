-- SMA-SHIFT-LABOR-LEDGER-INTEGRITY-106B
--
-- Additive only. No existing row is read, updated or deleted by this migration, and no
-- historical AUTO_CLOSED shift is rewritten — correcting those needs the audit model this
-- migration introduces, plus a separate owner-approved review pass.
--
-- Three changes:
--   1. WorkShiftCorrection — an append-only audit log of manager corrections.
--   2. Re-assertion of the partial unique index that allows one OPEN shift per user.
--   3. WorkShift.userId / WorkLog.userId foreign keys move from ON DELETE CASCADE to RESTRICT.

-- ── 1. Correction audit log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WorkShiftCorrection" (
  "id"                TEXT NOT NULL,
  "companyId"         TEXT NOT NULL,
  "shiftId"           TEXT NOT NULL,
  "correctedByUserId" TEXT NOT NULL,
  "correctedOpenedAt" TIMESTAMP(3),
  "correctedClosedAt" TIMESTAMP(3),
  "reason"            TEXT NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkShiftCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkShiftCorrection_shiftId_createdAt_idx"
  ON "WorkShiftCorrection"("shiftId", "createdAt");

CREATE INDEX IF NOT EXISTS "WorkShiftCorrection_companyId_createdAt_idx"
  ON "WorkShiftCorrection"("companyId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "WorkShiftCorrection"
    ADD CONSTRAINT "WorkShiftCorrection_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "WorkShiftCorrection"
    ADD CONSTRAINT "WorkShiftCorrection_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RESTRICT: the author of a correction must remain resolvable for the audit trail to mean
-- anything. Users are soft-deleted in this codebase, so this blocks nothing that happens today.
DO $$
BEGIN
  ALTER TABLE "WorkShiftCorrection"
    ADD CONSTRAINT "WorkShiftCorrection_correctedByUserId_fkey"
    FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. One OPEN shift per user ──────────────────────────────────────────────────────────────
-- Created originally by 202608040001_workforce_shifts_worklogs_v1. Prisma cannot express a
-- partial unique index, so it is invisible to the schema and a generated migration may offer to
-- drop it. Re-asserting it here is idempotent where it already exists and self-healing where it
-- does not. openShift depends on the resulting P2002 to collapse a concurrent-open race.
CREATE UNIQUE INDEX IF NOT EXISTS "WorkShift_one_open_per_user_key"
  ON "WorkShift"("userId") WHERE "status" = 'OPEN';

-- ── 3. Labour history survives employee removal ─────────────────────────────────────────────
-- Replacing an FK's ON DELETE action requires dropping and recreating the constraint. The new
-- constraint is validated against existing rows; every row already satisfies it, because the
-- referenced users exist. Small table, brief ACCESS EXCLUSIVE lock.
ALTER TABLE "WorkShift" DROP CONSTRAINT IF EXISTS "WorkShift_userId_fkey";
ALTER TABLE "WorkShift"
  ADD CONSTRAINT "WorkShift_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkLog" DROP CONSTRAINT IF EXISTS "WorkLog_userId_fkey";
ALTER TABLE "WorkLog"
  ADD CONSTRAINT "WorkLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
