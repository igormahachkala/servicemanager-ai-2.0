ALTER TABLE "InspectionTemplateItem" ADD COLUMN "defaultCategoryId" TEXT;

ALTER TABLE "InspectionRunItem" ADD COLUMN "defaultCategoryId" TEXT;

CREATE INDEX "InspectionTemplateItem_defaultCategoryId_idx" ON "InspectionTemplateItem"("defaultCategoryId");

CREATE INDEX "InspectionRunItem_defaultCategoryId_idx" ON "InspectionRunItem"("defaultCategoryId");
