-- Failure Causes V1: make the existing CLIENT_ADMIN read route reachable
-- without granting company settings or any ticket mutation capability.
INSERT INTO "RolePermission" ("id", "role", "companyType", "permissionBlockId", "createdAt")
SELECT
  gen_random_uuid()::text,
  'CLIENT_ADMIN'::"UserRole",
  'CLIENT'::"CompanyType",
  permission."id",
  CURRENT_TIMESTAMP
FROM "PermissionBlock" permission
WHERE permission."code" = 'TICKETS_VIEW'
ON CONFLICT ("role", "companyType", "permissionBlockId") DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "RolePermission" role_permission
    JOIN "PermissionBlock" permission
      ON permission."id" = role_permission."permissionBlockId"
    WHERE role_permission."role" = 'CLIENT_ADMIN'::"UserRole"
      AND role_permission."companyType" = 'CLIENT'::"CompanyType"
      AND permission."code" = 'TICKETS_VIEW'
  ) THEN
    RAISE EXCEPTION 'Required PermissionBlock TICKETS_VIEW is missing';
  END IF;
END $$;
