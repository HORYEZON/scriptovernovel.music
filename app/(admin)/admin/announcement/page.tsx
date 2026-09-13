// app/(admin)/admin/announcement/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AnnouncementTabs } from "./AnnouncementTabs";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncementPage() {
  const [announcements, marquees, faqs] = await Promise.all([
    prisma.announcement
      .findMany({
        where: { deletedAt: null },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => []),
    prisma.marqueeAnnouncement
      .findMany({
        where: { deletedAt: null },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => []),
    prisma.faq
      .findMany({
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      })
      .catch(() => []),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Announcements"
        description="Manage site-wide announcements, popups, scrolling marquee banners, and the public FAQ chatbox"
      />
      <AnnouncementTabs
        initialAnnouncements={JSON.parse(JSON.stringify(announcements))}
        initialMarquees={JSON.parse(JSON.stringify(marquees))}
        initialFaqs={JSON.parse(JSON.stringify(faqs))}
      />
    </div>
  );
}
