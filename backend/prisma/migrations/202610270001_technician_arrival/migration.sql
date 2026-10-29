-- CreateEnum
CREATE TYPE "TechnicianArrivalSide" AS ENUM ('INSIDE', 'OUTSIDE');

-- CreateEnum
CREATE TYPE "TechnicianArrivalEventKind" AS ENUM ('ARRIVED', 'DEPARTED', 'CORRECTION');

-- CreateTable
CREATE TABLE "TechnicianArrival" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "arrivedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "lastDistanceMeters" DOUBLE PRECISION,
    "lastCheckedAt" TIMESTAMP(3),
    "candidateSide" "TechnicianArrivalSide",
    "candidateStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicianArrival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianArrivalEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "arrivalId" TEXT NOT NULL,
    "kind" "TechnicianArrivalEventKind" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianArrivalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianArrivalCorrection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "arrivalId" TEXT NOT NULL,
    "correctedByUserId" TEXT NOT NULL,
    "correctedArrivedAt" TIMESTAMP(3),
    "correctedDepartedAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianArrivalCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianArrival_ticketId_userId_key" ON "TechnicianArrival"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "TechnicianArrival_companyId_userId_idx" ON "TechnicianArrival"("companyId", "userId");

-- CreateIndex
CREATE INDEX "TechnicianArrival_userId_idx" ON "TechnicianArrival"("userId");

-- CreateIndex
CREATE INDEX "TechnicianArrivalEvent_arrivalId_createdAt_idx" ON "TechnicianArrivalEvent"("arrivalId", "createdAt");

-- CreateIndex
CREATE INDEX "TechnicianArrivalEvent_companyId_createdAt_idx" ON "TechnicianArrivalEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TechnicianArrivalCorrection_arrivalId_createdAt_idx" ON "TechnicianArrivalCorrection"("arrivalId", "createdAt");

-- CreateIndex
CREATE INDEX "TechnicianArrivalCorrection_companyId_createdAt_idx" ON "TechnicianArrivalCorrection"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "TechnicianArrival" ADD CONSTRAINT "TechnicianArrival_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrival" ADD CONSTRAINT "TechnicianArrival_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrival" ADD CONSTRAINT "TechnicianArrival_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrivalEvent" ADD CONSTRAINT "TechnicianArrivalEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrivalEvent" ADD CONSTRAINT "TechnicianArrivalEvent_arrivalId_fkey" FOREIGN KEY ("arrivalId") REFERENCES "TechnicianArrival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrivalCorrection" ADD CONSTRAINT "TechnicianArrivalCorrection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrivalCorrection" ADD CONSTRAINT "TechnicianArrivalCorrection_arrivalId_fkey" FOREIGN KEY ("arrivalId") REFERENCES "TechnicianArrival"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianArrivalCorrection" ADD CONSTRAINT "TechnicianArrivalCorrection_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
