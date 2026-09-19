// app/api/artworks/availability/route.ts
//
// GET /api/artworks/availability?ids=a,b,c — public, unauthenticated.
//
// The Wishlist (lib/wishlist-store.ts) is a localStorage snapshot of an
// artwork's title/image/price at the moment it was saved, and it can
// outlive the artwork itself — an admin deleting or unpublishing the piece
// afterward leaves the visitor's saved card looking exactly as it did, with
// nothing on screen to say the artwork it points to is gone. This is how
// WishlistClient finds out: for each requested id, whether the artwork
// still passes the exact gate its own detail page uses
// (app/(public)/artwork/[slug]/page.tsx's getArtwork — published, not
// deleted), so "still available" here means precisely "would not 404 if
// you clicked through."
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A wishlist is a handful of saved pieces, not a catalog — capped well
// above any real one so a hand-edited request can't turn this into an
// unbounded query.
const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) return NextResponse.json({});

  const ids = [...new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_IDS
  );
  if (ids.length === 0) return NextResponse.json({});

  const rows = await prisma.artwork
    .findMany({
      where: { id: { in: ids }, published: true, deletedAt: null },
      select: { id: true },
    })
    .catch(() => []);

  const available = new Set(rows.map((r) => r.id));
  const result: Record<string, boolean> = {};
  for (const id of ids) result[id] = available.has(id);
  return NextResponse.json(result);
}
