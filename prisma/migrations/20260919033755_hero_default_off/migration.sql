-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";

-- AlterTable
ALTER TABLE "DigitalMuseum" ADD COLUMN     "artworkShimmerConfig" TEXT,
ADD COLUMN     "museumBrightnessDim" INTEGER NOT NULL DEFAULT 25;

-- AlterTable
ALTER TABLE "MuseumRoom" ADD COLUMN     "lightColor" TEXT,
ADD COLUMN     "lightModelUrl" TEXT,
ADD COLUMN     "lightScale" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "imageSnapshot" TEXT,
ADD COLUMN     "titleSnapshot" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SiteDesign" ALTER COLUMN "heroEnabled" SET DEFAULT false;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
