-- AlterTable
ALTER TABLE "SiteDesign" ADD COLUMN     "headerMenuHoverBgColor" TEXT NOT NULL DEFAULT '#0D0D0D',
ADD COLUMN     "headerMenuHoverEffect" TEXT NOT NULL DEFAULT 'spin',
ADD COLUMN     "headerMenuHoverTextColor" TEXT NOT NULL DEFAULT '#F2EFE6',
ADD COLUMN     "menuItemsEffect" TEXT NOT NULL DEFAULT 'fade',
ADD COLUMN     "menuItemsSpeedMs" INTEGER NOT NULL DEFAULT 500;
