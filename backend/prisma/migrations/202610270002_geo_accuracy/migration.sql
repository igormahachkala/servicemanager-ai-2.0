-- CreateEnum
CREATE TYPE "GeoAccuracyBucketKey" AS ENUM ('LT_10', 'FROM_10_20', 'FROM_20_30', 'FROM_30_40', 'FROM_40_50', 'FROM_50_60', 'FROM_60_100', 'GT_100', 'MISSING');

-- CreateTable
CREATE TABLE "GeoAccuracyBucket" (
    "key" "GeoAccuracyBucketKey" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GeoAccuracyBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GeoAccuracySample" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoAccuracySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformArrivalSettings" (
    "id" TEXT NOT NULL,
    "accuracyMeters" INTEGER NOT NULL DEFAULT 100,
    "freshnessMinutes" INTEGER NOT NULL DEFAULT 10,
    "radiusMeters" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformArrivalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoAccuracySample_companyId_recordedAt_idx" ON "GeoAccuracySample"("companyId", "recordedAt");

-- AddForeignKey
ALTER TABLE "GeoAccuracySample" ADD CONSTRAINT "GeoAccuracySample_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
