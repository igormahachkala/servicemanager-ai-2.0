-- AlterTable User: add phone and soft-delete support
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- AlterTable Location: add soft-delete support
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
