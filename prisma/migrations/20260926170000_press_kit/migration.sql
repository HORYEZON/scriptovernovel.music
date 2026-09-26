-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "pressShortBio" TEXT,
ADD COLUMN     "pressBookingName" TEXT,
ADD COLUMN     "pressBookingEmail" TEXT,
ADD COLUMN     "pressTechRider" TEXT,
ADD COLUMN     "pressStagePlot" TEXT,
ADD COLUMN     "pressPhotoCredit" TEXT,
ADD COLUMN     "pressQuotes" JSONB;
