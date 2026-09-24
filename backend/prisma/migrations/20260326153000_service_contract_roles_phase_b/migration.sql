DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServiceContractRole') THEN
    CREATE TYPE "ServiceContractRole" AS ENUM ('PRIMARY', 'SECONDARY');
  END IF;
END $$;

ALTER TABLE "ServiceContract"
ADD COLUMN IF NOT EXISTS "role" "ServiceContractRole" NOT NULL DEFAULT 'PRIMARY';
