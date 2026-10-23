-- Permission catalog: TICKETS_VIEW must exist before
-- 202610050001_failure_causes_client_admin_read grants it to CLIENT_ADMIN.
-- On existing contours the row was created by the permissions seed; on a
-- fresh database (CI) no earlier migration creates it. Name and description
-- match PERMISSION_BLOCKS in src/common/permissions-matrix.ts.
-- Idempotent: an existing row is left untouched. No role or user grants here.
INSERT INTO "PermissionBlock" ("id", "code", "name", "description", "createdAt")
VALUES (
  gen_random_uuid()::text,
  'TICKETS_VIEW',
  'View tickets',
  'Доска/список/карточка/таймлайн/комментарии',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;
