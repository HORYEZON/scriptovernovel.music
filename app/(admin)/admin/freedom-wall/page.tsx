// app/(admin)/admin/freedom-wall/page.tsx
//
// Standalone route for the Freedom Wall admin panel. The exact same
// <FreedomWallTab /> is also mounted as the "Freedom Wall" sub-tab of
// /admin/artworks?tab=museum (DigitalMuseumPanel.tsx) — this page is the
// second way in, reachable straight from the sidebar so admins who think of
// the Freedom Wall as its own module don't have to dig through the Digital
// Museum tabs. Both entry points share one component, so there is no second
// copy of the CRUD logic to keep in sync; the breadcrumb below points back at
// the museum tab to make the relationship obvious.
import type { Metadata } from "next";
import { StickyNote } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";
import { FreedomWallTab } from "../artworks/FreedomWallTab";

export const metadata: Metadata = { title: "Freedom Wall" };
export const dynamic = "force-dynamic";

export default async function AdminFreedomWallPage() {
  const [eventCount, noteCount, museumRooms] = await Promise.all([
    prisma.freedomWallEvent
      .count({ where: { isArchived: false, deletedAt: null } })
      .catch(() => 0),
    prisma.freedomWallNote
      .count({
        where: {
          isArchived: false,
          deletedAt: null,
          event: { deletedAt: null },
        },
      })
      .catch(() => 0),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          {
            label: "Digital Museum",
            href: "/admin/museum?museumTab=freedom-wall",
          },
          { label: "Freedom Wall" },
        ]}
        title="Freedom Wall"
        description={
          <>
            <span className="font-bold tabular-nums">{eventCount}</span> active
            event{eventCount !== 1 ? "s" : ""} ·{" "}
            <span className="font-bold tabular-nums">{noteCount}</span> sticky
            note{noteCount !== 1 ? "s" : ""} on the wall, also shown in the
            Digital Museum&rsquo;s Freedom Wall Room
          </>
        }
        action={
          <AdminGoToMenu
            icon={<StickyNote size={16} />}
            links={[
              {
                label: "Gallery / Freedom Wall Page",
                href: "/gallery/freedom-wall",
              },
              museumRoomLink(museumRooms, "freedom-wall", "Digital Museum / Freedom Wall Room"),
              museumEditorLink(museumRooms, "freedom-wall", "Scene Editor / Freedom Wall Room"),
            ]}
          />
        }
      />
      <FreedomWallTab />
    </div>
  );
}
