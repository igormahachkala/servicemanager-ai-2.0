ALTER TABLE "Ticket" ADD COLUMN "createdByUserId" TEXT;

UPDATE "Ticket" t
SET "createdByUserId" = src."actorUserId"
FROM (
  SELECT DISTINCT ON (de."entityId")
    de."entityId",
    de."actorUserId",
    u."companyId" AS "actorCompanyId"
  FROM "DomainEvent" de
  JOIN "User" u ON u."id" = de."actorUserId"
  WHERE de."entityType" = 'Ticket'
    AND de."type" = 'ticket.created'
    AND de."actorUserId" IS NOT NULL
  ORDER BY de."entityId", de."createdAt" ASC
) src
WHERE t."id" = src."entityId"
  AND t."companyId" = src."actorCompanyId";

UPDATE "Ticket" t
SET "createdByUserId" = src."actorUserId"
FROM (
  SELECT DISTINCT ON (de."entityId")
    de."entityId",
    de."actorUserId",
    u."companyId" AS "actorCompanyId"
  FROM "DomainEvent" de
  JOIN "User" u ON u."id" = de."actorUserId"
  WHERE de."entityType" = 'Ticket'
    AND de."type" = 'ticket.comment_added'
    AND de."actorUserId" IS NOT NULL
    AND de."payload"->>'source' = 'create_flow'
  ORDER BY de."entityId", de."createdAt" ASC
) src
WHERE t."id" = src."entityId"
  AND t."companyId" = src."actorCompanyId"
  AND t."createdByUserId" IS NULL;

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Ticket_companyId_createdByUserId_idx" ON "Ticket"("companyId", "createdByUserId");
