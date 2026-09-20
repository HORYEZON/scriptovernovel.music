-- CreateTable
CREATE TABLE "BandMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "photoUrl" TEXT,
    "blurb" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BandMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BandMember_published_sortOrder_idx" ON "BandMember"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "BandMember_deletedAt_idx" ON "BandMember"("deletedAt");

