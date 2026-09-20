// lib/videos-server.ts — server-only Video helpers (Prisma). Mirrors
// lib/releases-server.ts.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PublicVideo } from "@/lib/videos";

export const VIDEO_INCLUDE = {
  release: { select: { id: true, title: true, slug: true } },
} satisfies Prisma.VideoInclude;

export type VideoWithRelease = Prisma.VideoGetPayload<{ include: typeof VIDEO_INCLUDE }>;

export const PUBLIC_VIDEO_WHERE: Prisma.VideoWhereInput = { published: true, deletedAt: null };
export const PUBLIC_VIDEO_ORDER: Prisma.VideoOrderByWithRelationInput[] = [
  { featured: "desc" },
  { sortOrder: "asc" },
  { createdAt: "desc" },
];

export async function getPublicVideos(take?: number): Promise<PublicVideo[]> {
  const rows = await prisma.video.findMany({
    where: PUBLIC_VIDEO_WHERE,
    include: VIDEO_INCLUDE,
    orderBy: PUBLIC_VIDEO_ORDER,
    ...(take ? { take } : {}),
  });
  return rows.map(toPublicVideo);
}

export function toPublicVideo(v: VideoWithRelease): PublicVideo {
  return {
    id: v.id,
    title: v.title,
    youtubeUrl: v.youtubeUrl,
    youtubeId: v.youtubeId,
    kind: v.kind,
    description: v.description,
    featured: v.featured,
    release: v.release,
  };
}

export function revalidateVideoPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/videos");
  revalidatePath("/admin/videos");
}
