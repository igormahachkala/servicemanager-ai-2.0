-- SMA-EQUIPMENT-HISTORY-PARTS-110B
--
-- Справочник комплектующих и история установленных деталей.
--
-- Миграция аддитивная: две новые таблицы, ни одна существующая не меняется.
-- Истории заявок она не касается вовсе — вкладка «История» читает канонические
-- Ticket, TicketStatusHistory и TicketAttachment, своей копии жизненного цикла
-- не заводится.
--
-- Складского здесь нет намеренно: ни остатков, ни цен, ни резервов, ни списаний.
-- Будущий шов — PartDefinition → Stock → Issue → Ticket → InstalledPart, и Stock
-- придёт отдельной таблицей, а не колонками в этих.
--
-- Каждый шаг переживает повторный прогон: таблицы и индексы через
-- IF NOT EXISTS, внешние ключи через проверку pg_constraint. Prisma применённую
-- миграцию не повторяет, но частично применённая должна доводиться, а не падать.

CREATE TABLE IF NOT EXISTS "PartDefinition" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "manufacturer" TEXT,
  "model" TEXT,
  "article" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'шт',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstalledPart" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "partDefinitionId" TEXT,
  "displayName" TEXT NOT NULL,
  "serialNumber" TEXT,
  "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "installedTicketId" TEXT,
  "removedTicketId" TEXT,
  "installedByUserId" TEXT,
  "removedByUserId" TEXT,
  "comment" TEXT,
  "removalComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstalledPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartDefinition_companyId_name_idx" ON "PartDefinition"("companyId", "name");
CREATE INDEX IF NOT EXISTS "PartDefinition_companyId_article_idx" ON "PartDefinition"("companyId", "article");
CREATE INDEX IF NOT EXISTS "PartDefinition_companyId_isActive_idx" ON "PartDefinition"("companyId", "isActive");

-- «Что стоит сейчас» — это removedAt IS NULL, основная выборка карточки.
CREATE INDEX IF NOT EXISTS "InstalledPart_equipmentId_removedAt_idx" ON "InstalledPart"("equipmentId", "removedAt");
CREATE INDEX IF NOT EXISTS "InstalledPart_equipmentId_installedAt_idx" ON "InstalledPart"("equipmentId", "installedAt");
CREATE INDEX IF NOT EXISTS "InstalledPart_companyId_equipmentId_idx" ON "InstalledPart"("companyId", "equipmentId");
CREATE INDEX IF NOT EXISTS "InstalledPart_installedTicketId_idx" ON "InstalledPart"("installedTicketId");
CREATE INDEX IF NOT EXISTS "InstalledPart_removedTicketId_idx" ON "InstalledPart"("removedTicketId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PartDefinition_companyId_fkey') THEN
    ALTER TABLE "PartDefinition"
      ADD CONSTRAINT "PartDefinition_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_companyId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_equipmentId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_equipmentId_fkey"
      FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Позицию каталога можно вывести из обращения, не потеряв историю: ссылка
-- обнуляется, displayName в строке остаётся.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_partDefinitionId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_partDefinitionId_fkey"
      FOREIGN KEY ("partDefinitionId") REFERENCES "PartDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_installedTicketId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_installedTicketId_fkey"
      FOREIGN KEY ("installedTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_removedTicketId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_removedTicketId_fkey"
      FOREIGN KEY ("removedTicketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_installedByUserId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_installedByUserId_fkey"
      FOREIGN KEY ("installedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InstalledPart_removedByUserId_fkey') THEN
    ALTER TABLE "InstalledPart"
      ADD CONSTRAINT "InstalledPart_removedByUserId_fkey"
      FOREIGN KEY ("removedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
