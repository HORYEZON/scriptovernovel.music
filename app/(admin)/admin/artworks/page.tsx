// app/(admin)/admin/artworks/page.tsx
import type { Metadata } from "next";
import { Palette } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { ArtworksTabs } from "./ArtworksTabs";

export const metadata: Metadata = { title: "Museum Pieces" };
export const dynamic = "force-dynamic";

export default async function AdminArtworksPage() {
  const [artworks, sections, sectionRecords] = await Promise.all([
    prisma.artwork.findMany({
      where: { deletedAt: null },
      include: {
        product: true,
        section: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.section.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
    // Full rows for the Sections tab (SectionsClient) — mirrors the query the
    // old standalone /admin/sections page ran before it moved in here.
    prisma.section.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { artworks: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Museum Pieces"
        description={
          <>
            <span className="font-bold tabular-nums">{artworks.length}</span>{" "}
            piece{artworks.length !== 1 ? "s" : ""} — live photos, gig posters, press shots and cover art to hang in the Digital Museum&apos;s rooms
          </>
        }
        action={
          <AdminGoToMenu
            links={[
              { label: "Digital Museum", href: "/gallery/museum" },
              { label: "Museum Rooms (admin)", href: "/admin/museum?museumTab=rooms" },
            ]}
            icon={<Palette size={16} />}
          />
        }
      />
      <ArtworksTabs
        initialArtworks={artworks}
        sections={sections}
        sectionRecords={sectionRecords}
      />
    </div>
  );
}
