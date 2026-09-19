-- AlterTable
ALTER TABLE "SiteDesign" ADD COLUMN     "menuOpenEffect" TEXT NOT NULL DEFAULT 'drop',
ADD COLUMN     "menuOpenSpeedMs" INTEGER NOT NULL DEFAULT 500;
