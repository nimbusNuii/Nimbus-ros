-- CreateTable
CREATE TABLE "PrinterPresence" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "supportsCashier" BOOLEAN NOT NULL DEFAULT true,
    "supportsKitchen" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT,
    "rawStatus" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrinterPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrinterPresence_agentId_target_key" ON "PrinterPresence"("agentId", "target");

-- CreateIndex
CREATE INDEX "PrinterPresence_lastSeenAt_idx" ON "PrinterPresence"("lastSeenAt");

-- CreateIndex
CREATE INDEX "PrinterPresence_target_lastSeenAt_idx" ON "PrinterPresence"("target", "lastSeenAt");
