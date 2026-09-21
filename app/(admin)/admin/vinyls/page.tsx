// app/(admin)/admin/vinyls/page.tsx
//
// The Vinyls module: the records that hang in the Digital Museum's Vinyl
// Room. Each is one Release plus one uploaded audio file; the room mirrors
// the published ones on its next load (lib/museum/vinylRoom.ts).
import type { Metadata } from "next";
import { Disc3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { getMuseumRoomStatus, museumEditorLink, museumRoomLink } from "@/lib/museum/roomStatus";
import { VINYL_INCLUDE, toAdminVinyl } from "@/lib/vinyls-server";
import { VinylsClient } from "./VinylsClient";

export const metadata: Metadata = { title: "Vinyls" };
export const dynamic = "force-dynamic";

export default async function AdminVinylsPage() {
  const [vinyls, releases, museumRooms] = await Promise.all([
    prisma.vinylRecord.findMany({
      where: { deletedAt: null },
      include: VINYL_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.release.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, slug: true, coverImageUrl: true, published: true, _count: { select: { tracks: true } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Vinyls"
        description="Records for the Digital Museum's Vinyl Room — a release plus the audio a visitor hears when they put it on the turntable. Published records hang on the wall on the room's next load."
        action={
          <AdminGoToMenu
            links={[
              museumRoomLink(museumRooms, "vinyl", "Digital Museum / Vinyl Room"),
              museumEditorLink(museumRooms, "vinyl", "Scene Editor / Vinyl Room"),
            ]}
            icon={<Disc3 size={16} />}
          />
        }
      />
      <VinylsClient
        initialVinyls={JSON.parse(JSON.stringify(vinyls.map(toAdminVinyl)))}
        releases={releases.map((r) => ({ id: r.id, title: r.title, slug: r.slug, coverImageUrl: r.coverImageUrl, published: r.published, trackCount: r._count.tracks }))}
      />
    </div>
  );
}
