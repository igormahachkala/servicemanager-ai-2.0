-- Workforce shifts and per-ticket work logs V1.

CREATE TYPE "WorkShiftStatus" AS ENUM ('OPEN', 'CLOSED', 'AUTO_CLOSED');
CREATE TYPE "WorkLogStatus" AS ENUM ('RUNNING', 'STOPPED', 'AUTO_STOPPED');

ALTER TABLE "Company"
  ADD COLUMN "shiftAutoCloseTime" TEXT NOT NULL DEFAULT '19:00';

CREATE TABLE "WorkShift" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "WorkShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "closeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "status" "WorkLogStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "durationMinutes" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkShift_companyId_openedAt_idx" ON "WorkShift"("companyId", "openedAt");
CREATE INDEX "WorkShift_companyId_status_openedAt_idx" ON "WorkShift"("companyId", "status", "openedAt");
CREATE INDEX "WorkShift_userId_openedAt_idx" ON "WorkShift"("userId", "openedAt");
CREATE UNIQUE INDEX "WorkShift_one_open_per_user_key" ON "WorkShift"("userId") WHERE "status" = 'OPEN';

CREATE INDEX "WorkLog_companyId_startedAt_idx" ON "WorkLog"("companyId", "startedAt");
CREATE INDEX "WorkLog_companyId_userId_startedAt_idx" ON "WorkLog"("companyId", "userId", "startedAt");
CREATE INDEX "WorkLog_shiftId_startedAt_idx" ON "WorkLog"("shiftId", "startedAt");
CREATE INDEX "WorkLog_ticketId_startedAt_idx" ON "WorkLog"("ticketId", "startedAt");
CREATE UNIQUE INDEX "WorkLog_one_running_per_user_key" ON "WorkLog"("userId") WHERE "status" = 'RUNNING';

ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkShift" ADD CONSTRAINT "WorkShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PermissionBlock" ("id", "code", "name", "description", "createdAt")
VALUES
  (gen_random_uuid()::text, 'WORKFORCE_SHIFT_USE', 'Use work shifts', 'Open and close own shifts and track ticket work', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'WORKFORCE_VIEW', 'View workforce time', 'View employee shifts and work logs', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "companyType", "permissionBlockId", "createdAt")
SELECT gen_random_uuid()::text, grants.role::"UserRole", grants.company_type::"CompanyType", permission."id", CURRENT_TIMESTAMP
FROM (VALUES
  ('ADMIN', 'CLIENT', 'WORKFORCE_SHIFT_USE'),
  ('ADMIN', 'CLIENT', 'WORKFORCE_VIEW'),
  ('ADMIN', 'PROVIDER', 'WORKFORCE_SHIFT_USE'),
  ('ADMIN', 'PROVIDER', 'WORKFORCE_VIEW'),
  ('MASTER', 'PROVIDER', 'WORKFORCE_SHIFT_USE'),
  ('MASTER', 'PROVIDER', 'WORKFORCE_VIEW'),
  ('DISPATCHER', 'PROVIDER', 'WORKFORCE_SHIFT_USE'),
  ('DISPATCHER', 'PROVIDER', 'WORKFORCE_VIEW'),
  ('TECHNICIAN', 'PROVIDER', 'WORKFORCE_SHIFT_USE'),
  ('NETWORK_DIRECTOR', 'CLIENT', 'WORKFORCE_VIEW'),
  ('TERRITORIAL_MANAGER', 'CLIENT', 'WORKFORCE_VIEW')
) AS grants(role, company_type, code)
JOIN "PermissionBlock" permission ON permission."code" = grants.code
ON CONFLICT ("role", "companyType", "permissionBlockId") DO NOTHING;

INSERT INTO "RolePermission" ("id", "role", "companyType", "permissionBlockId", "createdAt")
SELECT gen_random_uuid()::text, 'PLATFORM_ADMIN'::"UserRole", NULL, permission."id", CURRENT_TIMESTAMP
FROM "PermissionBlock" permission
WHERE permission."code" = 'WORKFORCE_VIEW'
  AND NOT EXISTS (
    SELECT 1 FROM "RolePermission" existing
    WHERE existing."role" = 'PLATFORM_ADMIN'::"UserRole"
      AND existing."companyType" IS NULL
      AND existing."permissionBlockId" = permission."id"
  );
