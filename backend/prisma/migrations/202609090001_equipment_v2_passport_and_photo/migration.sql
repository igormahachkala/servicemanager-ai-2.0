-- SMA-EQUIPMENT-V2-110A
--
-- Паспортные поля оборудования и защищённые вложения.
--
-- Миграция аддитивная: ни одной колонки не удаляется, ни один тип не меняется.
-- Все новые поля необязательные, поэтому существующие строки остаются валидными
-- без backfill. На момент задачи в Production оборудования нет вовсе (0 строк),
-- но миграция написана так, чтобы быть безопасной и на непустой таблице.
--
-- Поле status намеренно остаётся TEXT. Значение INACTIVE несёт мягкое удаление
-- (EquipmentService.remove), а предложенный набор ACTIVE/REPAIR/DECOMMISSIONED
-- его не содержит: перевод в enum требует продуктового решения и отдельной задачи.
--
-- Каждый шаг переживает повторный прогон: колонки и индексы через IF NOT EXISTS,
-- внешние ключи через проверку pg_constraint. Prisma применённую миграцию не
-- повторяет, но частично применённая миграция должна доводиться, а не падать.

ALTER TABLE "Equipment"
  ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "inventoryNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "commissionedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "warrantyUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "mainPhotoId" TEXT;

CREATE TABLE IF NOT EXISTS "EquipmentAttachment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "uploadedByUserId" TEXT,
  "originalName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EquipmentAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EquipmentAttachment_companyId_equipmentId_idx"
  ON "EquipmentAttachment"("companyId", "equipmentId");

CREATE INDEX IF NOT EXISTS "EquipmentAttachment_equipmentId_createdAt_idx"
  ON "EquipmentAttachment"("equipmentId", "createdAt");

-- Обложка одна: один снимок не может быть главным сразу у двух единиц.
CREATE UNIQUE INDEX IF NOT EXISTS "Equipment_mainPhotoId_key"
  ON "Equipment"("mainPhotoId");

-- Поиск по серийному и инвентарному номеру идёт в контуре компании.
CREATE INDEX IF NOT EXISTS "Equipment_companyId_serialNumber_idx"
  ON "Equipment"("companyId", "serialNumber");

CREATE INDEX IF NOT EXISTS "Equipment_companyId_inventoryNumber_idx"
  ON "Equipment"("companyId", "inventoryNumber");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentAttachment_companyId_fkey') THEN
    ALTER TABLE "EquipmentAttachment"
      ADD CONSTRAINT "EquipmentAttachment_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentAttachment_equipmentId_fkey') THEN
    ALTER TABLE "EquipmentAttachment"
      ADD CONSTRAINT "EquipmentAttachment_equipmentId_fkey"
      FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EquipmentAttachment_uploadedByUserId_fkey') THEN
    ALTER TABLE "EquipmentAttachment"
      ADD CONSTRAINT "EquipmentAttachment_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Обложка обнуляется вместе с удалённым снимком, сама единица остаётся.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Equipment_mainPhotoId_fkey') THEN
    ALTER TABLE "Equipment"
      ADD CONSTRAINT "Equipment_mainPhotoId_fkey"
      FOREIGN KEY ("mainPhotoId") REFERENCES "EquipmentAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
