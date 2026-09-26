// app/(admin)/admin/releases/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RELEASE_INCLUDE } from "@/lib/releases-server";
import { ReleasesClient } from "./ReleasesClient";

export const metadata: Metadata = { title: "Releases" };
export const dynamic = "force-dynamic";

export default async function AdminReleasesPage() {
  const [releases, vinyls] = await Promise.all([
    prisma.release.findMany({
      where: { deletedAt: null },
      include: RELEASE_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    // What the lyric sync taps against: one audio file per record. Queried
    // separately rather than included on the release rows, because the API's
    // own responses use RELEASE_INCLUDE (no vinyls) and a save would otherwise
    // replace a row and drop it.
    prisma.vinylRecord.findMany({
      where: { published: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { releaseId: true, audioUrl: true },
    }),
  ]);

  const vinylAudioByRelease: Record<string, string> = {};
  for (const v of vinyls) {
    // First published vinyl wins — a record with an A and a B side is timed
    // against the one the turntable reaches for first.
    if (!vinylAudioByRelease[v.releaseId]) vinylAudioByRelease[v.releaseId] = v.audioUrl;
  }

  return (
    <div>
      <AdminPageHeader
        title="Releases"
        description="Singles, EPs and albums on the Music page — cover, tracklist, lyrics and where each one streams. Each track gets its own lyrics page, and lyrics can be tap-synced to the record. The featured release fronts the homepage."
      />
      <ReleasesClient
        initialReleases={JSON.parse(JSON.stringify(releases))}
        vinylAudioByRelease={vinylAudioByRelease}
      />
    </div>
  );
}
