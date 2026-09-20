// lib/store/queries.ts — server-only. The one definition of "a product a
// visitor can buy", shared by the Store, the homepage strip, checkout and
// the header search so a paused or deleted product can never be bought
// from a stale cart. A merch product has no artwork; a legacy one must
// still have a live artwork behind it.
import type { Prisma } from "@prisma/client";

export const LIVE_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  available: true,
  deletedAt: null,
  OR: [{ artworkId: null }, { artwork: { deletedAt: null } }],
};

/** What every public reader selects off the artwork fallback. */
export const PRODUCT_ARTWORK_SELECT = {
  select: { id: true, title: true, imageUrl: true, description: true, slug: true, medium: true, tags: true },
} as const;

export const PUBLIC_PRODUCT_ORDER: Prisma.ProductOrderByWithRelationInput[] = [
  { featured: "desc" },
  { sortOrder: "asc" },
  { createdAt: "desc" },
];
