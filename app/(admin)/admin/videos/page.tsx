// app/(admin)/admin/videos/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { VIDEO_INCLUDE } from "@/lib/videos-server";
import { VideosClient } from "./VideosClient";

export const metadata: Metadata = { title: "Videos" };
export const dynamic = "force-dynamic";

export default async function AdminVideosPage() {
  const [videos, releases] = await Promise.all([
    prisma.video.findMany({
      where: { deletedAt: null },
      include: VIDEO_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.release.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Videos"
        description="YouTube videos on the Videos page — music videos, live sets, behind the scenes. Featured ones lead the homepage strip."
      />
      <VideosClient initialVideos={JSON.parse(JSON.stringify(videos))} releases={releases} />
    </div>
  );
}
