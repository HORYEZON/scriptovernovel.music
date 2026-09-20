// lib/band-members-server.ts — server-only BandMember helpers.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PublicBandMember } from "@/lib/band-members";

export async function getPublicBandMembers(): Promise<PublicBandMember[]> {
  return prisma.bandMember.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, role: true, photoUrl: true, blurb: true },
  });
}

export function revalidateMemberPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/about");
  revalidatePath("/admin/band-members");
}
