-- SMA-PROVIDER-SHIFT-POLICY-FOUNDATION-078
-- Optional Provider Shift Policy: Company.requireActiveShiftForWork.
--
-- Backward compatible by construction, per docs/DATABASE_MIGRATION_POLICY.md §8:
-- a single additive column with a NOT NULL default, so every existing row gets
-- `false` and current Production behaviour is preserved exactly. No backfill is
-- required beyond that default, and no existing column is altered or dropped.
--
-- Reversible (§12): the change is undone by
--   ALTER TABLE "Company" DROP COLUMN "requireActiveShiftForWork";
-- which is safe because nothing reads the column while the flag is false.
--
-- Guarded so a re-run is a no-op rather than an error.
--
-- Note on scope: the column lives on Company because that is the canonical carrier
-- of company-level policy in this schema (alongside autoAssignEnabled,
-- allowTechnicianClaim, slaStrictMode, shiftAutoCloseTime). PROVIDER-only
-- applicability is enforced in the domain layer against the existing
-- Company.type discriminator — deliberately NOT duplicated as a second provider flag.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "requireActiveShiftForWork" BOOLEAN NOT NULL DEFAULT false;
