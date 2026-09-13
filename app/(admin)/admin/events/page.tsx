// app/(admin)/admin/events/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EventsClient } from "./EventsClient";

export const metadata: Metadata = { title: "Timeline / Events" };
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await prisma.event.findMany({
    where: { deletedAt: null },
    include: { media: { orderBy: { order: "asc" } } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <AdminPageHeader
        title="Timeline / Events"
        description="Gigs, exhibits, and events Kyla has attended — pinned on the public Timeline map (About page)."
      />
      <EventsClient initialEvents={JSON.parse(JSON.stringify(events))} />
    </div>
  );
}
