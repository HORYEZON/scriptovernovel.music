// app/(admin)/admin/stories/page.tsx
import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";
import { StoriesClient } from "./StoriesClient";

export const metadata: Metadata = { title: "Tales" };
export const dynamic = "force-dynamic";

export default async function AdminStoriesPage() {
  const [stories, artworks, museumRooms] = await Promise.all([
    prisma.story.findMany({
      where: { deletedAt: null },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    // Offered as ready-made book covers in the create/edit modal — same
    // shape ../artworks/ArtworkPicker.tsx's PickableArtwork expects.
    prisma.artwork
      .findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          imageUrl: true,
          published: true,
          slug: true,
        },
      })
      .catch(() => []),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Tales"
        description={
          <>
            <span className="font-bold tabular-nums">{stories.length}</span>{" "}
            publication{stories.length !== 1 ? "s" : ""} — books, novels, comics
            &amp; manga, also read in the Digital Museum&rsquo;s Tales Room
          </>
        }
        action={
          <AdminGoToMenu
            icon={<BookOpen size={16} />}
            links={[
              { label: "Tales Page", href: "/stories" },
              museumRoomLink(museumRooms, "stories", "Digital Museum / Tales Room"),
              museumEditorLink(museumRooms, "stories", "Scene Editor / Tales Room"),
            ]}
          />
        }
      />
      <StoriesClient
        initialStories={JSON.parse(JSON.stringify(stories))}
        artworks={artworks}
      />
    </div>
  );
}
