// app/(admin)/admin/band-members/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BandMembersClient } from "./BandMembersClient";

export const metadata: Metadata = { title: "Band Members" };
export const dynamic = "force-dynamic";

export default async function AdminBandMembersPage() {
  const members = await prisma.bandMember.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return (
    <div>
      <AdminPageHeader
        title="Band Members"
        description="Who's in the band — name, what they play, a photo and a line each — for the About page's members grid. The bio, tagline and band photos are under About."
      />
      <BandMembersClient initialMembers={JSON.parse(JSON.stringify(members))} />
    </div>
  );
}
