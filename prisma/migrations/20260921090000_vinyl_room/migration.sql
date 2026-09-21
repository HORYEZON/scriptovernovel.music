-- AlterEnum
ALTER TYPE "MuseumRoomType" ADD VALUE 'VINYL';

-- CreateTable
CREATE TABLE "VinylRecord" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "sideLabel" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VinylRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumRoomVinyl" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "vinylId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "positionX" DOUBLE PRECISION,
    "positionY" DOUBLE PRECISION,
    "positionZ" DOUBLE PRECISION,
    "rotationY" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumRoomVinyl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VinylRecord_published_sortOrder_idx" ON "VinylRecord"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "VinylRecord_deletedAt_idx" ON "VinylRecord"("deletedAt");

-- CreateIndex
CREATE INDEX "VinylRecord_releaseId_idx" ON "VinylRecord"("releaseId");

-- CreateIndex
CREATE INDEX "MuseumRoomVinyl_roomId_idx" ON "MuseumRoomVinyl"("roomId");

-- CreateIndex
CREATE INDEX "MuseumRoomVinyl_vinylId_idx" ON "MuseumRoomVinyl"("vinylId");

-- CreateIndex
CREATE UNIQUE INDEX "MuseumRoomVinyl_roomId_vinylId_key" ON "MuseumRoomVinyl"("roomId", "vinylId");

-- AddForeignKey
ALTER TABLE "VinylRecord" ADD CONSTRAINT "VinylRecord_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomVinyl" ADD CONSTRAINT "MuseumRoomVinyl_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "MuseumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumRoomVinyl" ADD CONSTRAINT "MuseumRoomVinyl_vinylId_fkey" FOREIGN KEY ("vinylId") REFERENCES "VinylRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

