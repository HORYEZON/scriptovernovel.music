-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "comingSoon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releaseAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StockNotification" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "email" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockNotification_productId_notifiedAt_idx" ON "StockNotification"("productId", "notifiedAt");

-- CreateIndex
CREATE INDEX "StockNotification_email_idx" ON "StockNotification"("email");

-- AddForeignKey
ALTER TABLE "StockNotification" ADD CONSTRAINT "StockNotification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockNotification" ADD CONSTRAINT "StockNotification_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
