// app/(admin)/admin/releases/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RELEASE_INCLUDE } from "@/lib/releases-server";
import { ReleasesClient } from "./ReleasesClient";

export const metadata: Metadata = { title: "Releases" };
export const dynamic = "force-dynamic";

export default async function AdminReleasesPage() {
  const releases = await prisma.release.findMany({
    where: { deletedAt: null },
    include: RELEASE_INCLUDE,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <AdminPageHeader
        title="Releases"
        description="Singles, EPs and albums on the Music page — cover, tracklist, lyrics and where each one streams. The featured release fronts the homepage."
      />
      <ReleasesClient initialReleases={JSON.parse(JSON.stringify(releases))} />
    </div>
  );
}
