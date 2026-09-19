/*
  Warnings:

  - You are about to drop the column `menuSocialIconColor` on the `SiteDesign` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SiteDesign" DROP COLUMN "menuSocialIconColor",
ADD COLUMN     "menuHoverTextColor" TEXT NOT NULL DEFAULT '#141414',
ALTER COLUMN "menuTextColor" SET DEFAULT '#FFFFFF',
ALTER COLUMN "menuBgColor" SET DEFAULT '#1C1C1C';
