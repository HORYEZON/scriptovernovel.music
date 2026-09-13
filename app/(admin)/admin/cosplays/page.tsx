// app/(admin)/admin/cosplays/page.tsx
import type { Metadata } from "next";
import { Shirt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";
import { CosplaysClient } from "./CosplaysClient";

export const metadata: Metadata = { title: "Cosplays" };
export const dynamic = "force-dynamic";

export default async function AdminCosplaysPage() {
  const [cosplays, museumRooms] = await Promise.all([
    prisma.cosplay.findMany({
      where: { deletedAt: null },
      // The order standees are placed around the Cosplay Room's walls — the
      // admin grid shows that same order so its reorder arrows mean something
      // (see lib/museum/cosplayRoom.ts's sync).
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Cosplays"
        description={
          <>
            <span className="font-bold tabular-nums">{cosplays.length}</span> costume
            {cosplays.length !== 1 ? "s" : ""} — each one a standee in the Digital
            Museum&rsquo;s Cosplay Room, with its second photo hung behind it
          </>
        }
        action={
          <AdminGoToMenu
            icon={<Shirt size={16} />}
            links={[
              museumRoomLink(museumRooms, "cosplay", "Digital Museum / Cosplay Room"),
              museumEditorLink(museumRooms, "cosplay", "Scene Editor / Cosplay Room"),
            ]}
          />
        }
      />
      <CosplaysClient initialCosplays={JSON.parse(JSON.stringify(cosplays))} />
    </div>
  );
}
