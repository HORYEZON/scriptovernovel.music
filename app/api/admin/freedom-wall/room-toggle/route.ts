// app/api/admin/freedom-wall/room-toggle/route.ts
// PATCH — admin only. Toggles the Freedom Wall room's isActive flag.
// Mirrors the MuseumRoom enabled PATCH pattern from
// app/api/digital-museum/rooms/[id]/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive (boolean) required" }, { status: 400 });
    }

    const settings = await prisma.freedomWallSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", isActive: body.isActive },
      update: { isActive: body.isActive },
      select: { isActive: true, activeEventId: true },
    });

    revalidatePath("/", "layout");
    revalidatePath("/gallery/freedom-wall");
    revalidatePath("/admin/artworks");

    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({ error: "Failed to toggle room" }, { status: 500 });
  }
}
