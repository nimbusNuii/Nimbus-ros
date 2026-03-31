-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentChannelId" TEXT,
ADD COLUMN     "paymentChannelSnapshot" TEXT;

-- AlterTable
ALTER TABLE "PrinterPresence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PaymentChannel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PaymentMethod" NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "qrCodeUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentChannel_isActive_sortOrder_name_idx" ON "PaymentChannel"("isActive", "sortOrder", "name");

-- CreateIndex
CREATE INDEX "Order_paymentChannelId_idx" ON "Order"("paymentChannelId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentChannelId_fkey" FOREIGN KEY ("paymentChannelId") REFERENCES "PaymentChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
