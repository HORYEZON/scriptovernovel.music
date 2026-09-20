// app/api/site-search/route.ts
//
// The header search's one endpoint: everything a visitor might look for on
// the band site, as flat `SiteSearchItem`s the overlay filters client-side.
// Today that is the store (merch); releases and videos join here as their
// models land (Phases 2 and 3 of the band-site plan), each contributing a
// `kind` so the overlay can label a row. Public, read-only, no query param
// — the catalogue is small and one fetch per open is cheaper than a round
// trip per keystroke.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productHref, productImage, productTitle } from "@/lib/store/product-display";
import type { SiteSearchItem } from "@/lib/site-search";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product
    .findMany({
      where: { available: true, deletedAt: null, artwork: { deletedAt: null } },
      include: { artwork: { select: { title: true, imageUrl: true, slug: true, tags: true, medium: true } } },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => []);

  const items: SiteSearchItem[] = [];
  for (const p of products) {
    const title = productTitle(p);
    if (!title) continue;
    items.push({
      id: `product:${p.id}`,
      kind: "merch",
      title,
      subtitle: p.artwork?.medium ?? null,
      keywords: p.artwork?.tags ?? [],
      imageUrl: productImage(p),
      href: productHref(p),
    });
  }

  return NextResponse.json({ items });
}
