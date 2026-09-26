-- AlterTable
ALTER TABLE "ReleaseTrack" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "lyricTimings" JSONB;

-- CreateIndex
-- Unique within a release, not globally: two records may each have a track
-- called "Intro". Every existing row's slug is NULL, and Postgres treats NULLs
-- as distinct in a unique index, so this is safe to add to a populated table.
CREATE UNIQUE INDEX "ReleaseTrack_releaseId_slug_key" ON "ReleaseTrack"("releaseId", "slug");
