-- CreateEnum
CREATE TYPE "VideoKind" AS ENUM ('MUSIC_VIDEO', 'LIVE', 'BEHIND_THE_SCENES');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "kind" "VideoKind" NOT NULL DEFAULT 'MUSIC_VIDEO',
    "releaseId" TEXT,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Video_published_sortOrder_idx" ON "Video"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "Video_deletedAt_idx" ON "Video"("deletedAt");

-- CreateIndex
CREATE INDEX "Video_releaseId_idx" ON "Video"("releaseId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE SET NULL ON UPDATE CASCADE;

