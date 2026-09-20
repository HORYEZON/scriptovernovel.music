-- CreateEnum
CREATE TYPE "ReleaseType" AS ENUM ('SINGLE', 'EP', 'ALBUM', 'LIVE', 'COMPILATION');

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "type" "ReleaseType" NOT NULL DEFAULT 'SINGLE',
    "coverImageUrl" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "description" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "spotifyUrl" TEXT,
    "bandcampUrl" TEXT,
    "youtubeUrl" TEXT,
    "soundcloudUrl" TEXT,
    "appleMusicUrl" TEXT,
    "primaryPlayer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseTrack" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationSec" INTEGER,
    "url" TEXT,
    "lyrics" TEXT,

    CONSTRAINT "ReleaseTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Release_slug_key" ON "Release"("slug");

-- CreateIndex
CREATE INDEX "Release_published_releaseDate_idx" ON "Release"("published", "releaseDate");

-- CreateIndex
CREATE INDEX "Release_deletedAt_idx" ON "Release"("deletedAt");

-- CreateIndex
CREATE INDEX "ReleaseTrack_releaseId_trackNumber_idx" ON "ReleaseTrack"("releaseId", "trackNumber");

-- AddForeignKey
ALTER TABLE "ReleaseTrack" ADD CONSTRAINT "ReleaseTrack_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
