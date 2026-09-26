-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('SCHEDULED', 'SOLD_OUT', 'CANCELLED', 'POSTPONED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "city" TEXT,
ADD COLUMN     "lineup" TEXT,
ADD COLUMN     "ticketUrl" TEXT,
ADD COLUMN     "ticketPrice" DOUBLE PRECISION,
ADD COLUMN     "ticketNote" TEXT,
ADD COLUMN     "status" "ShowStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateIndex
CREATE INDEX "Event_enabled_eventDate_idx" ON "Event"("enabled", "eventDate");
