// app/api/products/availability/route.ts
//
// GET /api/products/availability?ids=a,b,c — public, unauthenticated.
//
// The Cart (lib/cart-store.ts) is a localStorage snapshot the same way the
// Wishlist is — see app/api/artworks/availability/route.ts's comment for
// the shape of the problem this solves. This is the Shop's counterpart:
// for each requested product id, whether it still passes the exact gate
// the Shop listing itself uses (app/(public)/shop/page.tsx's getProducts —
// available, not deleted, and its artwork not deleted), so "still
// available" here means precisely "still buyable." /api/checkout is the
// actual, server-enforced purchase gate (same predicate, re-checked at
// order time regardless of what the client believes) — this endpoint only
// drives what CartClient shows before a visitor ever reaches checkout.
import { NextRequest, NextResponse } from "next/server";
import { LIVE_PRODUCT_WHERE } from "@/lib/store/queries";
import { prisma } from "@/lib/prisma";

// A cart holds a handful of items, not a catalog — capped well above any
// real one so a hand-edited request can't turn this into an unbounded query.
const MAX_IDS = 200;

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam) return NextResponse.json({});

  const ids = [...new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_IDS
  );
  if (ids.length === 0) return NextResponse.json({});

  const rows = await prisma.product
    .findMany({
      where: { id: { in: ids }, ...LIVE_PRODUCT_WHERE },
      select: { id: true },
    })
    .catch(() => []);

  const available = new Set(rows.map((r) => r.id));
  const result: Record<string, boolean> = {};
  for (const id of ids) result[id] = available.has(id);
  return NextResponse.json(result);
}
