// app/api/digital-museum/rooms/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

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
  floor: true,
  wallColor: true,
  floorColor: true,
  ceilingColor: true,
  wallTexture: true,
  floorTexture: true,
  ceilingTexture: true,
  lightColor: true,
  lightScale: true,
  lightModelUrl: true,
  splashIcon: true,
  splashTitle: true,
  splashEnabled: true,
  _count: { select: { artworks: true } },
} as const;

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// GET /api/digital-museum/rooms — list all rooms (admin only)
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    // ABOUT/FREEDOM_WALL/STAIRS are excluded: none are part of this
    // admin-CRUD room list — each renders instead as its own fixed card in
    // RoomsTab.tsx (see lib/museum/aboutRoom.ts, freedomWallRoom.ts,
    // stairsRoom.ts).
    const rooms = await prisma.museumRoom.findMany({
      where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
      orderBy: { displayOrder: "asc" },
      select: ROOM_SELECT,
    });
    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

// POST /api/digital-museum/rooms — create a room
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, description, roomType } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const validTypes = ["MAIN_HALL", "GALLERY", "SPECIAL_EXHIBITION"];
    if (roomType !== undefined && !validTypes.includes(roomType)) {
      return NextResponse.json({ error: "Invalid room type" }, { status: 400 });
    }

    let slug = slugify(name);
    const existing = await prisma.museumRoom.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Scoped away from ABOUT/FREEDOM_WALL/STAIRS — each of those capstone/
    // connector rows' displayOrder is fixed far beyond any curated room's on
    // purpose (see lib/museum/aboutRoom.ts, freedomWallRoom.ts,
    // stairsRoom.ts), so including any of them here would push every
    // newly-created room's displayOrder past it too.
    const maxOrder = await prisma.museumRoom.aggregate({
      where: { roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    // First *curated* room ever created becomes the entry room
    // automatically — the museum should never end up with zero rooms a
    // visitor can spawn into. Scoped away from ABOUT/FREEDOM_WALL/STAIRS so
    // their lazy provisioning (called well before any admin ever creates a
    // curated room) doesn't itself count toward this.
    const roomCount = await prisma.museumRoom.count({
      where: { roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
    });

    await prisma.digitalMuseum.upsert({
      where: { id: MUSEUM_ID },
      update: {},
      create: { id: MUSEUM_ID },
    });

    const room = await prisma.museumRoom.create({
      data: {
        museumId: MUSEUM_ID,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        roomType: roomType ?? "GALLERY",
        displayOrder,
        isEntryRoom: roomCount === 0,
      },
      select: ROOM_SELECT,
    });

    revalidateMuseumPaths();

    return NextResponse.json(room, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
