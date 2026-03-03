-- Re-created migration to match DB state:
-- 20260302115458_add_permission_blocks_v1

CREATE TABLE IF NOT EXISTS "PermissionBlock" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PermissionBlock_code_key" ON "PermissionBlock"("code");

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissionBlockId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permissionBlockId_key"
ON "RolePermission"("role","permissionBlockId");

CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission"("role");
CREATE INDEX IF NOT EXISTS "RolePermission_permissionBlockId_idx" ON "RolePermission"("permissionBlockId");

ALTER TABLE "RolePermission"
  ADD CONSTRAINT "RolePermission_permissionBlockId_fkey"
  FOREIGN KEY ("permissionBlockId") REFERENCES "PermissionBlock"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permissionBlockId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermission_userId_permissionBlockId_key"
ON "UserPermission"("userId","permissionBlockId");

CREATE INDEX IF NOT EXISTS "UserPermission_userId_idx" ON "UserPermission"("userId");
CREATE INDEX IF NOT EXISTS "UserPermission_permissionBlockId_idx" ON "UserPermission"("permissionBlockId");

ALTER TABLE "UserPermission"
  ADD CONSTRAINT "UserPermission_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPermission"
  ADD CONSTRAINT "UserPermission_permissionBlockId_fkey"
  FOREIGN KEY ("permissionBlockId") REFERENCES "PermissionBlock"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
