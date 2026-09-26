// app/(admin)/admin/events/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EventsClient } from "./EventsClient";

export const metadata: Metadata = { title: "Shows / Events" };
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
        title="Shows / Events"
        description="Every gig, upcoming and played — listed on /shows with its tickets and lineup, and pinned on that page's map."
      />
      <EventsClient initialEvents={JSON.parse(JSON.stringify(events))} />
    </div>
  );
}
