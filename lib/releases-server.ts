// lib/releases-server.ts
//
// Server-only Release helpers: the Prisma include every reader uses, the
// public query, and the "which release fronts the site" pick. Imported by
// the API routes, /music, and the homepage's hero and Latest release
// sections. Not client-safe (imports Prisma).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const RELEASE_INCLUDE = {
  tracks: { orderBy: { trackNumber: "asc" as const } },
} satisfies Prisma.ReleaseInclude;

export type ReleaseWithTracks = Prisma.ReleaseGetPayload<{ include: typeof RELEASE_INCLUDE }>;

/** Live, published releases: newest release date first, undated last, then
 *  the admin's manual order. */
export const PUBLIC_RELEASE_ORDER: Prisma.ReleaseOrderByWithRelationInput[] = [
  { releaseDate: { sort: "desc", nulls: "last" } },
  { sortOrder: "asc" },
  { createdAt: "desc" },
];

export const PUBLIC_RELEASE_WHERE: Prisma.ReleaseWhereInput = { published: true, deletedAt: null };

export async function getPublicReleases(): Promise<ReleaseWithTracks[]> {
  return prisma.release.findMany({
    where: PUBLIC_RELEASE_WHERE,
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
}

/** The release the homepage leads with: the featured one (newest if several),
 *  else the newest published. Null when nothing is published. */
export async function getLeadRelease(): Promise<ReleaseWithTracks | null> {
  const featured = await prisma.release.findFirst({
    where: { ...PUBLIC_RELEASE_WHERE, featured: true },
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
  if (featured) return featured;
  return prisma.release.findFirst({
    where: PUBLIC_RELEASE_WHERE,
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
}

/** Every page a release shows on. */
export function revalidateReleasePaths() {
  revalidatePath("/", "layout");
  revalidatePath("/music");
  revalidatePath("/admin/releases");
}
