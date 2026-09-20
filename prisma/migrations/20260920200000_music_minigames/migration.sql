-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MiniGameType" ADD VALUE 'GUESS_THE_COVER';
ALTER TYPE "MiniGameType" ADD VALUE 'TRACKLIST_ORDER';
ALTER TYPE "MiniGameType" ADD VALUE 'LYRIC_FILL';
ALTER TYPE "MiniGameType" ADD VALUE 'NAME_THAT_TRACK';
ALTER TYPE "MiniGameType" ADD VALUE 'RELEASE_TIMELINE';

-- AlterTable
ALTER TABLE "MiniGame" ADD COLUMN     "releaseId" TEXT,
ADD COLUMN     "secondaryImageUrl" TEXT;

-- AddForeignKey
ALTER TABLE "MiniGame" ADD CONSTRAINT "MiniGame_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

