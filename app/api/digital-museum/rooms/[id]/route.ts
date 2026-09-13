// app/api/digital-museum/rooms/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

const MUSEUM_ID = "singleton";

const ROOM_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  roomType: true,
  displayOrder: true,
  enabled: true,
  isEntryRoom: true,
  // 0 = ground floor, 1 = second floor — see prisma/schema.prisma's
  // MuseumRoom.floor and docs/SecondFloorStairs_Spec.md.
  floor: true,
  wallColor: true,
  floorColor: true,
  ceilingColor: true,
  wallTexture: true,
  floorTexture: true,
  ceilingTexture: true,
  splashIcon: true,
  splashTitle: true,
  splashEnabled: true,
  _count: { select: { artworks: true } },
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// GET /api/digital-museum/rooms/[id] — one room's linked artworks, used by
// the Trash module's "Linked Artworks" viewer (TrashClient.tsx). A plain
// findUnique by id with no enabled/deletedAt filter, so this resolves the
// same whether the room is live or already soft-deleted — same convention
// as /api/sections/[id]'s GET, which this mirrors the response shape of
// (flat {id, title/name, artworks: [{id, title, imageUrl, published}]}).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const room = await prisma.museumRoom.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        artworks: {
          orderBy: { displayOrder: "asc" },
          select: {
            artwork: { select: { id: true, title: true, imageUrl: true, published: true } },
          },
        },
      },
    });
    if (!room) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: room.id,
      name: room.name,
      artworks: room.artworks.map((entry) => entry.artwork),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// PATCH /api/digital-museum/rooms/[id] — edit one room's settings
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      roomType,
      enabled,
      isEntryRoom,
      floor,
      wallColor,
      floorColor,
      ceilingColor,
      wallTexture,
      floorTexture,
      ceilingTexture,
      splashIcon,
      splashTitle,
      splashEnabled,
    } = body;

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      data.name = name.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (roomType !== undefined) {
      const validTypes = ["MAIN_HALL", "GALLERY", "SPECIAL_EXHIBITION"];
      if (!validTypes.includes(roomType)) {
        return NextResponse.json({ error: "Invalid room type" }, { status: 400 });
      }
      data.roomType = roomType;
    }
    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.enabled = enabled;
    }
    // 0 = ground floor, 1 = second floor — see docs/SecondFloorStairs_Spec.md.
    // Only these two values exist in v1 (the admin UI is a plain two-way
    // toggle, not a numeric input), even though the column itself is a
    // plain Int for future headroom.
    if (floor !== undefined) {
      if (floor !== 0 && floor !== 1) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.floor = floor;
    }
    if (wallColor !== undefined) {
      if (typeof wallColor !== "string" || !HEX_COLOR.test(wallColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.wallColor = wallColor;
    }
    if (floorColor !== undefined) {
      if (typeof floorColor !== "string" || !HEX_COLOR.test(floorColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.floorColor = floorColor;
    }
    if (ceilingColor !== undefined) {
      if (typeof ceilingColor !== "string" || !HEX_COLOR.test(ceilingColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.ceilingColor = ceilingColor;
    }
    // Texture fields are URLs from /api/upload, or "" / null to clear back
    // to the plain color — same "trim to null" convention as description.
    if (wallTexture !== undefined) {
      if (wallTexture !== null && typeof wallTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.wallTexture = wallTexture?.trim() || null;
    }
    if (floorTexture !== undefined) {
      if (floorTexture !== null && typeof floorTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.floorTexture = floorTexture?.trim() || null;
    }
    if (ceilingTexture !== undefined) {
      if (ceilingTexture !== null && typeof ceilingTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.ceilingTexture = ceilingTexture?.trim() || null;
    }
    // Room-entry splash overrides — see RoomSplashContent.tsx. splashIcon
    // isn't validated against the real icon catalog (same trade-off
    // Profile.splashIcon already makes — see components/ui/icon-values.ts's
    // isIconName doc comment); IconPicker.tsx only ever writes values it
    // found in a live search, so a bad value here would only come from a
    // hand-edited request.
    if (splashIcon !== undefined) {
      if (splashIcon !== null && typeof splashIcon !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashIcon = splashIcon?.trim() || null;
    }
    if (splashTitle !== undefined) {
      if (splashTitle !== null && typeof splashTitle !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashTitle = splashTitle?.trim() || null;
    }
    // Per-room "does this room's entry splash actually fire" toggle —
    // independent of DigitalMuseum.splashEnabled (the museum-wide master
    // switch, patched via /api/digital-museum instead).
    if (splashEnabled !== undefined) {
      if (typeof splashEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashEnabled = splashEnabled;
    }
    if (isEntryRoom !== undefined && typeof isEntryRoom !== "boolean") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (Object.keys(data).length === 0 && isEntryRoom === undefined) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Keep the entry/spawn room off the Second Floor entirely — spawning a
    // visitor upstairs before they've ever walked the Stairs room is a
    // strange first impression (see docs/SecondFloorStairs_Spec.md's open
    // question #1). Blocks either direction: moving the current entry room
    // to floor 1, or marking a floor-1 room as the entry room.
    if (data.floor === 1 || isEntryRoom) {
      const target = await prisma.museumRoom.findUnique({
        where: { id },
        select: { floor: true, isEntryRoom: true },
      });
      const resultingFloor = data.floor ?? target?.floor ?? 0;
      const resultingIsEntry = isEntryRoom ?? target?.isEntryRoom ?? false;
      if (resultingFloor === 1 && resultingIsEntry) {
        // Distinct wording per which field actually triggered the conflict
        // — "Failed to update Floor" alone left the admin guessing why
        // (see docs/SecondFloorStairs_Spec.md's open question #1).
        const message =
          data.floor === 1
            ? "This room can't move to the Second Floor while it's set as the visitor's respawn point. Change the respawn room first, then try again."
            : "This room can't be set as the visitor's respawn point while it's on the Second Floor. Move it to the Ground Floor first, then try again.";
        return NextResponse.json({ error: message }, { status: 409 });
      }
    }

    // Exactly one room is ever the entry room — flipping this one on means
    // unsetting it everywhere else, in the same transaction so there's
    // never a moment (or a failure path) with zero or two entry rooms.
    const room = isEntryRoom
      ? (
          await prisma.$transaction([
            prisma.museumRoom.updateMany({
              where: { museumId: MUSEUM_ID, NOT: { id } },
              data: { isEntryRoom: false },
            }),
            prisma.museumRoom.update({
              where: { id },
              data: { ...data, isEntryRoom: true },
              select: ROOM_SELECT,
            }),
          ])
        )[1]
      : await prisma.museumRoom.update({ where: { id }, data, select: ROOM_SELECT });

    revalidateMuseumPaths();

    void logActivity({
      category: "CONTENT",
      action: "museum.room.updated",
      summary: `Updated museum room “${room.name}”.`,
      entityType: "museum-room",
      entityId: room.id,
      metadata: { changed: Object.keys(data) },
      request,
    });

    return NextResponse.json(room);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update room" }, { status: 500 });
  }
}

// DELETE /api/digital-museum/rooms/[id] — soft delete (moves to trash)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const enabledCount = await prisma.museumRoom.count({ where: { enabled: true, deletedAt: null } });
    const target = await prisma.museumRoom.findUnique({
      where: { id },
      select: { enabled: true, roomType: true },
    });

    // The Services Room is provisioned, never created or destroyed (see
    // lib/museum/servicesRoom.ts) — trashing it would only make
    // ensureServicesRoom hand back the soft-deleted row on the next load,
    // leaving a room that's invisible to visitors and un-restorable from this
    // UI. RoomsTab.tsx hides its Trash button for the same reason; this is
    // the server-side half of that rule.
    if (target?.roomType === "SERVICES") {
      return NextResponse.json(
        { error: "The Services Room can't be deleted — turn it off with its toggle instead." },
        { status: 409 }
      );
    }

    // Same rule, same reasoning, for the Stories Room (lib/museum/storiesRoom.ts).
    if (target?.roomType === "STORIES") {
      return NextResponse.json(
        { error: "The Stories Room can't be deleted — turn it off with its toggle instead." },
        { status: 409 }
      );
    }

    // Same rule again for the Arcade Room (lib/museum/arcadeRoom.ts).
    if (target?.roomType === "ARCADE") {
      return NextResponse.json(
        { error: "The Arcade Room can't be deleted — turn it off with its toggle instead." },
        { status: 409 }
      );
    }

    // Same rule again for the Cosplay Room (lib/museum/cosplayRoom.ts).
    if (target?.roomType === "COSPLAY") {
      return NextResponse.json(
        { error: "The Cosplay Room can't be deleted — turn it off with its toggle instead." },
        { status: 409 }
      );
    }

    // Never let the museum end up with zero reachable rooms — block trashing
    // the last enabled one rather than silently locking every visitor out.
    if (target?.enabled && enabledCount <= 1) {
      return NextResponse.json(
        { error: "Can't delete the only enabled room — enable another room first." },
        { status: 409 }
      );
    }

    await prisma.museumRoom.update({ where: { id }, data: { deletedAt: new Date() } });

    // If the trashed room happened to be the entry room, promote another
    // enabled room so visitors still have somewhere to spawn.
    const stillHasEntry = await prisma.museumRoom.findFirst({ where: { isEntryRoom: true, deletedAt: null } });
    if (!stillHasEntry) {
      const fallback = await prisma.museumRoom.findFirst({
        where: { enabled: true, deletedAt: null },
        orderBy: { displayOrder: "asc" },
      });
      if (fallback) {
        await prisma.museumRoom.update({ where: { id: fallback.id }, data: { isEntryRoom: true } });
      }
    }

    revalidateMuseumPaths();
    revalidatePath("/admin/trash");

    void logActivity({
      category: "CONTENT",
      action: "museum.room.deleted",
      summary: `Moved a museum room to trash.`,
      entityType: "museum-room",
      entityId: id,
      metadata: { roomType: target?.roomType ?? null },
      request: _request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to delete room" }, { status: 500 });
  }
}
