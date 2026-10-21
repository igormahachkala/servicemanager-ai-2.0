-- SMA-MAX-BOT-V2-FOUNDATION-037
-- Re-introduce MaxUserBinding into the tracked schema.
--
-- Forward-schema compatibility is mandatory here. The physical table and its enum
-- already exist in the Production database, created by 202608080001_max_work_console_v1
-- from a release that was later rolled back at the application level but never at the
-- database level. That migration is NOT present in this repository, so Prisma will run
-- the statements below against a database where the objects are already there.
--
-- Every statement is therefore guarded and idempotent:
--   * Production            -> all guards short-circuit, zero changes, zero rows touched.
--   * Stage / fresh / test  -> objects are created with exactly the historical shape.
--
-- The shape below is byte-compatible with the deployed table (verified against
-- `\d "MaxUserBinding"` on Production): same columns, types, defaults, nullability,
-- primary key, unique index, secondary indexes and foreign keys.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaxUserBindingStatus') THEN
    CREATE TYPE "MaxUserBindingStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "MaxUserBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "maxUserId" TEXT NOT NULL,
  "maxChatId" TEXT,
  "status" "MaxUserBindingStatus" NOT NULL DEFAULT 'ACTIVE',
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MaxUserBinding_pkey" PRIMARY KEY ("id")
);

-- One MAX identity may map to at most one ServiceManager user. This is the constraint
-- that makes the binding an identity rather than a hint: without it a single MAX account
-- could resolve to several users and the resolver could not fail closed deterministically.
CREATE UNIQUE INDEX IF NOT EXISTS "MaxUserBinding_maxUserId_key" ON "MaxUserBinding"("maxUserId");
CREATE INDEX IF NOT EXISTS "MaxUserBinding_userId_idx" ON "MaxUserBinding"("userId");
CREATE INDEX IF NOT EXISTS "MaxUserBinding_companyId_status_idx" ON "MaxUserBinding"("companyId", "status");
CREATE INDEX IF NOT EXISTS "MaxUserBinding_maxChatId_idx" ON "MaxUserBinding"("maxChatId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaxUserBinding_userId_fkey'
  ) THEN
    ALTER TABLE "MaxUserBinding"
      ADD CONSTRAINT "MaxUserBinding_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaxUserBinding_companyId_fkey'
  ) THEN
    ALTER TABLE "MaxUserBinding"
      ADD CONSTRAINT "MaxUserBinding_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
