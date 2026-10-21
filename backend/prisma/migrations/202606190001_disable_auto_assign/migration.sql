-- Disable auto-assignment for all existing companies and change column default.
-- After this migration every new ticket is created in NEW status without an
-- assigned technician.  Assignment is always performed explicitly by a user
-- (Assign, Self-assign, or Smart-assign).

-- 1. Set all existing companies to false so the flag is consistent with the
--    new behaviour even if it is ever read directly (e.g. via admin export).
UPDATE "Company" SET "autoAssignEnabled" = false;

-- 2. Change the column default so future INSERT statements that omit the
--    column also get false.
ALTER TABLE "Company" ALTER COLUMN "autoAssignEnabled" SET DEFAULT false;
