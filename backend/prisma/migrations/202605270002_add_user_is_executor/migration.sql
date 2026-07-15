-- AlterTable
ALTER TABLE "User" ADD COLUMN "isExecutor" BOOLEAN NOT NULL DEFAULT false;

-- Existing TECHNICIANs become executors automatically; all other roles default to false.
UPDATE "User" SET "isExecutor" = true WHERE role = 'TECHNICIAN';
