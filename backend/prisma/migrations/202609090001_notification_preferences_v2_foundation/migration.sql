-- Notification Preferences V2 foundation.
-- Scope: additive preference types/tables only. Existing Notification and PushPreference
-- behaviour remains intact; V2 is not wired into delivery in this task.

-- CreateEnum
CREATE TYPE "NotificationContour" AS ENUM ('CLIENT', 'PRIMARY_PROVIDER', 'SECONDARY_PROVIDER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'PUSH', 'MAX');

-- CreateTable
CREATE TABLE "CompanyNotificationRolePreference" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contour" "NotificationContour" NOT NULL,
    "role" "UserRole" NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "CompanyNotificationRolePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contour" "NotificationContour" NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNotifRolePref_scope_key" ON "CompanyNotificationRolePreference"("companyId", "contour", "role", "eventType", "channel");

-- CreateIndex
CREATE INDEX "CompanyNotifRolePref_role_idx" ON "CompanyNotificationRolePreference"("companyId", "contour", "role");

-- CreateIndex
CREATE INDEX "CompanyNotifRolePref_event_idx" ON "CompanyNotificationRolePreference"("eventType", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotifPref_scope_key" ON "UserNotificationPreference"("userId", "contour", "eventType", "channel");

-- CreateIndex
CREATE INDEX "UserNotifPref_company_contour_idx" ON "UserNotificationPreference"("companyId", "contour");

-- CreateIndex
CREATE INDEX "UserNotifPref_event_idx" ON "UserNotificationPreference"("eventType", "channel");

-- AddForeignKey
ALTER TABLE "CompanyNotificationRolePreference" ADD CONSTRAINT "CompanyNotificationRolePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotificationPreference" ADD CONSTRAINT "UserNotificationPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deterministic compatibility backfill: only legacy false push toggles become V2
-- user-level disabled PUSH overrides. Legacy true/default values remain inherited
-- so future company-role settings are not accidentally overridden by old defaults.
WITH mapped_disabled_push AS (
  SELECT
    pp."userId",
    u."companyId",
    contours."contour",
    events."eventType",
    'PUSH'::"NotificationChannel" AS "channel"
  FROM "PushPreference" pp
  JOIN "User" u ON u."id" = pp."userId"
  JOIN "Company" c ON c."id" = u."companyId"
  CROSS JOIN LATERAL (
    VALUES
      ('ticket.comment_added', pp."chat"),
      ('ticket.attachment_uploaded', pp."chat"),
      ('ticket.created', pp."ticketNew"),
      ('ticket.assigned', pp."assignment"),
      ('ticket.claimed', pp."assignment"),
      ('ticket.assignment_requested', pp."assignment"),
      ('ticket.status_changed', pp."statusChange"),
      ('ticket.in_progress', pp."statusChange"),
      ('ticket.done', pp."statusChange"),
      ('ticket.awaiting_acceptance', pp."acceptance"),
      ('ticket.accepted', pp."acceptance"),
      ('ticket.rejected', pp."acceptanceReject"),
      ('ticket.sla_warning', pp."sla"),
      ('ticket.sla_breached', pp."sla")
  ) AS events("eventType", "legacyEnabled")
  CROSS JOIN LATERAL (
    SELECT 'CLIENT'::"NotificationContour" AS "contour"
    WHERE c."type" = 'CLIENT'
    UNION ALL
    SELECT 'PRIMARY_PROVIDER'::"NotificationContour" AS "contour"
    WHERE c."type" = 'PROVIDER'
    UNION ALL
    SELECT 'SECONDARY_PROVIDER'::"NotificationContour" AS "contour"
    WHERE c."type" = 'PROVIDER'
  ) AS contours
  WHERE events."legacyEnabled" = false
)
INSERT INTO "UserNotificationPreference" (
  "id",
  "userId",
  "companyId",
  "contour",
  "eventType",
  "channel",
  "enabled",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "userId",
  "companyId",
  "contour",
  "eventType",
  "channel",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM mapped_disabled_push
ON CONFLICT ("userId", "contour", "eventType", "channel") DO NOTHING;
