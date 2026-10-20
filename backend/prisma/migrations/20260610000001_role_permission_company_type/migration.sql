-- Phase 1.5: (Role + CompanyType) -> Permission
-- Adds nullable companyType to RolePermission so ADMIN can differ between
-- CLIENT and PROVIDER companies. NULL = wildcard (any company type).

-- 1) Add nullable companyType (safe: existing rows become wildcard).
ALTER TABLE "RolePermission" ADD COLUMN IF NOT EXISTS "companyType" "CompanyType";

-- 2) Drop the old role-only unique (no longer expresses uniqueness correctly).
DROP INDEX IF EXISTS "RolePermission_role_permissionBlockId_key";

-- 3) Composite unique for non-null companyType rows (matches Prisma @@unique).
--    Note: in Postgres NULLs are distinct, so this does NOT dedupe wildcard rows.
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_companyType_permissionBlockId_key"
  ON "RolePermission"("role", "companyType", "permissionBlockId");

-- 4) Partial unique index to dedupe wildcard (companyType IS NULL) rows.
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permissionBlockId_wildcard_key"
  ON "RolePermission"("role", "permissionBlockId")
  WHERE "companyType" IS NULL;

-- 5) Refresh helper index.
DROP INDEX IF EXISTS "RolePermission_role_idx";
CREATE INDEX IF NOT EXISTS "RolePermission_role_companyType_idx"
  ON "RolePermission"("role", "companyType");
