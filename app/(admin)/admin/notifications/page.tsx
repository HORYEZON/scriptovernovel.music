// app/(admin)/admin/notifications/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "./NotificationsClient";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminNotificationsPage() {
  // Matches the API route's default filter (app/api/admin/notifications/
  // route.ts) — trashed, spam-flagged, and archived rows are opt-in views,
  // never part of this initial "All" page-1 load.
  const where = { deletedAt: null, isSpam: false, isArchived: false };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        description="Every new-order and new-highscore alert, oldest ones included — the bell in the corner only ever keeps the most recent 20."
      />
      <NotificationsClient
        initialNotifications={JSON.parse(JSON.stringify(notifications))}
        initialTotal={total}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
