# Workforce CLIENT_ADMIN read-only — controlled RolePermission apply

Runtime grant for the reconciled delta: **(CLIENT_ADMIN, CLIENT, WORKFORCE_VIEW)**.

**Why a targeted apply (not `seed:permissions`):** `scripts/seed-permissions-matrix.ts`
runs `rolePermission.deleteMany({})` then recreates the whole matrix — that wipes
any runtime/Access-Constructor customization. `scripts/rollback-permissions.ts` is
worse (deletes ALL RolePermission + UserPermission + PermissionBlock). Neither may be
used for this one-permission delta.

The statements below mirror `prisma/migrations/202610050001_failure_causes_client_admin_read`
(same idempotent `INSERT … ON CONFLICT DO NOTHING` shape). They are **not** a Prisma
migration — they live outside `prisma/migrations`, so nothing auto-runs at container
start. Execute manually under controlled change management. Both are safe to re-run.

## Apply (idempotent)

```sql
-- Workforce CLIENT_ADMIN read-only: targeted, idempotent runtime apply.
--
-- Grants EXACTLY one RolePermission: (CLIENT_ADMIN, CLIENT, WORKFORCE_VIEW).
-- Mirrors migrations/202610050001_failure_causes_client_admin_read — same safe
-- INSERT ... ON CONFLICT DO NOTHING shape. It does NOT recreate the matrix and
-- does NOT touch any other RolePermission / UserPermission / custom config, so
-- runtime/Access-Constructor customizations survive. Safe to re-run.
--
-- NOT a Prisma migration (lives outside prisma/migrations) — it will not auto-run
-- at container start. Execute manually under controlled change management only.
INSERT INTO "RolePermission" ("id", "role", "companyType", "permissionBlockId", "createdAt")
SELECT
  gen_random_uuid()::text,
  'CLIENT_ADMIN'::"UserRole",
  'CLIENT'::"CompanyType",
  permission."id",
  CURRENT_TIMESTAMP
FROM "PermissionBlock" permission
WHERE permission."code" = 'WORKFORCE_VIEW'
ON CONFLICT ("role", "companyType", "permissionBlockId") DO NOTHING;

-- Verify the single intended grant exists after apply.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "RolePermission" role_permission
    JOIN "PermissionBlock" permission
      ON permission."id" = role_permission."permissionBlockId"
    WHERE role_permission."role" = 'CLIENT_ADMIN'::"UserRole"
      AND role_permission."companyType" = 'CLIENT'::"CompanyType"
      AND permission."code" = 'WORKFORCE_VIEW'
  ) THEN
    RAISE EXCEPTION 'Expected RolePermission CLIENT_ADMIN/CLIENT/WORKFORCE_VIEW is missing (is PermissionBlock WORKFORCE_VIEW seeded?)';
  END IF;
END $$;
```

## Rollback (targeted — only this grant)

```sql
-- Workforce CLIENT_ADMIN read-only: targeted, safe rollback.
--
-- Deletes ONLY the (CLIENT_ADMIN, CLIENT, WORKFORCE_VIEW) RolePermission row.
-- Does NOT touch TICKETS_VIEW (the other CLIENT_ADMIN grant), any other role,
-- any UserPermission, or any PermissionBlock. This is the opposite of
-- scripts/rollback-permissions.ts (which wipes ALL RolePermission/UserPermission/
-- PermissionBlock) — do NOT use that script for this delta.
DELETE FROM "RolePermission" role_permission
USING "PermissionBlock" permission
WHERE permission."id" = role_permission."permissionBlockId"
  AND role_permission."role" = 'CLIENT_ADMIN'::"UserRole"
  AND role_permission."companyType" = 'CLIENT'::"CompanyType"
  AND permission."code" = 'WORKFORCE_VIEW';
```
