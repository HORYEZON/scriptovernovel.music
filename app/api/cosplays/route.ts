// app/api/cosplays/route.ts
//
// Cosplays = costume photography shown on standees in the Digital Museum's
// Cosplay Room (lib/museum/cosplayRoom.ts). Shaped deliberately like
// app/api/stories/route.ts — same requireAdmin gate on writes, same write-once
// slug rule, same soft delete + revalidatePath pattern — so the two modules stay
// predictable against each other.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/** Every write path revalidates the same three: the museum (whose Cosplay Room
 *  mirrors this list), the admin module, and the layout. There is no public
 *  /cosplays page — the museum room *is* the public surface. */
function revalidateCosplayPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/cosplays");
  revalidatePath("/gallery/museum");
}

/** Trim to null so an empty field never becomes an empty string a component has
 *  to treat as content — the same normalization the Stories routes apply. */
function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** A year, or null. Rejects nothing — a nonsense value simply doesn't stick,
 *  same tolerance Story.year's parseInt has. */
function parsedYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const year = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(year) ? year : null;
}

// GET /api/cosplays — list all (optionally filtered by published)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");

    const cosplays = await prisma.cosplay.findMany({
      where: {
        deletedAt: null,
        ...(published !== null && { published: published === "true" }),
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(cosplays);
  } catch {
    return NextResponse.json({ error: "Failed to fetch cosplays" }, { status: 500 });
  }
}

// POST /api/cosplays — create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const {
      title,
      description,
      character,
      series,
      standeeImageUrl,
      backdropImageUrl,
      cosplayer,
      photographer,
      year,
      event,
      published,
      displayOrder,
    } = body;

    // The standee shot is the one image the room can't do without — it is what
    // the standee itself is printed with. The backdrop photo is optional (a
    // cosplay with one shot gets a standee against a plain panel).
    if (!title || !standeeImageUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Set once, here, and never touched again on later edits (see PATCH in
    // [id]/route.ts) — same reasoning as Story.slug.
    let slug = slugify(title);
    const existingSlug = await prisma.cosplay.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const cosplay = await prisma.cosplay.create({
      data: {
        title,
        description: trimmed(description),
        character: trimmed(character),
        series: trimmed(series),
        standeeImageUrl,
        backdropImageUrl: trimmed(backdropImageUrl),
        cosplayer: trimmed(cosplayer),
        photographer: trimmed(photographer),
        year: parsedYear(year),
        event: trimmed(event),
        published: published ?? true,
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
        slug,
      },
    });

    revalidateCosplayPaths();

    return NextResponse.json(cosplay, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create cosplay" }, { status: 500 });
  }
}
