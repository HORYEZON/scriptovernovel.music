// lib/vinyls-server.ts — server-only Vinyl helpers (Prisma). Mirrors
// lib/videos-server.ts. The Vinyl Room mirrors published records on its next
// load (lib/museum/vinylRoom.ts), so every write here revalidates the museum.
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { publicOrigin } from "@/lib/storage/r2";
import { VINYL_AUDIO_EXTENSIONS } from "@/lib/vinyls";

export const VINYL_INCLUDE = {
  release: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverImageUrl: true,
      published: true,
      _count: { select: { tracks: true } },
    },
  },
} satisfies Prisma.VinylRecordInclude;

export type VinylWithRelease = Prisma.VinylRecordGetPayload<{ include: typeof VINYL_INCLUDE }>;

export function toAdminVinyl(v: VinylWithRelease) {
  return {
    id: v.id,
    releaseId: v.releaseId,
    audioUrl: v.audioUrl,
    sideLabel: v.sideLabel,
    published: v.published,
    sortOrder: v.sortOrder,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    release: {
      id: v.release.id,
      title: v.release.title,
      slug: v.release.slug,
      coverImageUrl: v.release.coverImageUrl,
      published: v.release.published,
      trackCount: v.release._count.tracks,
    },
  };
}

/** The audio file must be one of ours — an https URL on the R2 public host
 *  with an audio extension. Anything else is rejected rather than played
 *  from a stranger's server. */
export function isOurAudioUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 2048) return false;
  let origin: string;
  try {
    origin = publicOrigin();
  } catch {
    return false;
  }
  if (!url.startsWith(origin + "/")) return false;
  const path = url.slice(origin.length + 1).split(/[?#]/)[0].toLowerCase();
  return VINYL_AUDIO_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export function revalidateVinylPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/gallery/museum");
  revalidatePath("/admin/vinyls");
  revalidatePath("/admin/artworks");
}
