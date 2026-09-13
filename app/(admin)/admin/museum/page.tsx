// app/(admin)/admin/museum/page.tsx
//
// Standalone Digital Museum module. Was a tab on /admin/artworks until the
// Artworks page was trimmed down to just Artworks / Sections. The Museum
// Scene Editor sub-page still lives under /admin/artworks/museum-editor/[roomId].
import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { DigitalMuseumPanel } from "../artworks/DigitalMuseumPanel";

export const metadata: Metadata = { title: "Digital Museum" };
export const dynamic = "force-dynamic";

export default async function AdminMuseumPage() {
  const artworks = await prisma.artwork.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      published: true,
      slug: true,
    },
  });

  return (
    <div>
      <AdminPageHeader
        title="Digital Museum"
        description="3D gallery rooms, exhibitions, the splash screen and the walkthrough experience."
        action={
          <AdminGoToMenu
            links={[{ label: "Go to Museum Page", href: "/gallery/museum" }]}
            icon={<Landmark size={16} />}
          />
        }
      />
      <DigitalMuseumPanel artworks={artworks} />
    </div>
  );
}
