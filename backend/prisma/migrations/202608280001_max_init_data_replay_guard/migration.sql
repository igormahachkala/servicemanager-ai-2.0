-- SMA-MAX-SECURE-USER-BINDING-054
-- Single-use guard for verified MAX Mini App `initData` payloads.
--
-- Purely additive: one new table, no touch to `MaxUserBinding` or anything else. The
-- binding table already exists physically in Production (created by a rolled-back release
-- and re-adopted by 202608270001_max_user_binding_foundation), so this migration
-- deliberately does not go near it — no ALTER, no DROP, no recreate.
--
-- Guarded and idempotent for the same reason its predecessor is: these statements may meet
-- a database where a prior attempt already created the objects.
--   * fresh / Stage / test  -> table and indexes created.
--   * Production-like       -> IF NOT EXISTS short-circuits, zero rows touched.
--
-- Why the table exists: MAX signs `initData` but documents no replay protection. Without a
-- consumption record a captured payload stays valid for its whole freshness window, which
-- is long enough to bind a victim's MAX identity to an attacker's ServiceManager account.
-- The unique index below is the actual protection — it makes the first writer win.

CREATE TABLE IF NOT EXISTS "MaxInitDataNonce" (
  "id" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "authDate" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MaxInitDataNonce_pkey" PRIMARY KEY ("id")
);

-- The security-bearing constraint. A second insert of the same digest must fail, which is
-- how a replayed payload is detected under concurrency rather than by a read-then-write
-- check that two requests could both pass.
CREATE UNIQUE INDEX IF NOT EXISTS "MaxInitDataNonce_digest_key" ON "MaxInitDataNonce"("digest");

-- Supports sweeping rows whose payloads are already too old to be accepted.
CREATE INDEX IF NOT EXISTS "MaxInitDataNonce_expiresAt_idx" ON "MaxInitDataNonce"("expiresAt");
