-- AlterTable
ALTER TABLE "SiteDesign" ADD COLUMN     "menuCloseEffect" TEXT NOT NULL DEFAULT 'drop',
ADD COLUMN     "menuCloseHoverBgColor" TEXT NOT NULL DEFAULT '#141414',
ADD COLUMN     "menuCloseHoverEffect" TEXT NOT NULL DEFAULT 'spin',
ADD COLUMN     "menuCloseHoverIconColor" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN     "menuCloseSpeedMs" INTEGER NOT NULL DEFAULT 500;
