-- Owner-only Engineering Agent task module: store tasks for the digital developer.

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'NEW',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTask_companyId_status_idx" ON "AgentTask"("companyId", "status");
CREATE INDEX "AgentTask_companyId_createdAt_idx" ON "AgentTask"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
