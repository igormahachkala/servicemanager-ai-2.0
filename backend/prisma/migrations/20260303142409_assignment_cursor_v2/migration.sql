-- CreateTable
CREATE TABLE "AssignmentCursor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentCursor_companyId_idx" ON "AssignmentCursor"("companyId");

-- CreateIndex
CREATE INDEX "AssignmentCursor_companyId_strategy_idx" ON "AssignmentCursor"("companyId", "strategy");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentCursor_companyId_strategy_key" ON "AssignmentCursor"("companyId", "strategy");
