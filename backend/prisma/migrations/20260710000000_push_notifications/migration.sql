-- Web Push (mobile push notifications). See docs/PUSH_NOTIFICATIONS_ARCHITECTURE_V1.md §4.
-- Scope: only the three Push* tables. Unrelated pre-existing drift (AiPhotoCheck /
-- SourceOfTruth) is intentionally NOT touched by this migration.

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "platform" TEXT,
    "userAgent" TEXT,
    "declarative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chat" BOOLEAN NOT NULL DEFAULT true,
    "ticketNew" BOOLEAN NOT NULL DEFAULT true,
    "assignment" BOOLEAN NOT NULL DEFAULT true,
    "statusChange" BOOLEAN NOT NULL DEFAULT true,
    "acceptance" BOOLEAN NOT NULL DEFAULT true,
    "acceptanceReject" BOOLEAN NOT NULL DEFAULT true,
    "sla" BOOLEAN NOT NULL DEFAULT true,
    "news" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursFrom" INTEGER,
    "quietHoursTo" INTEGER,

    CONSTRAINT "PushPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDeliveryLog" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_companyId_idx" ON "PushSubscription"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PushPreference_userId_key" ON "PushPreference"("userId");

-- CreateIndex
CREATE INDEX "PushDeliveryLog_subscriptionId_createdAt_idx" ON "PushDeliveryLog"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushPreference" ADD CONSTRAINT "PushPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
