// lib/store/product-display.ts
//
// How a product is shown — title, image(s), link — behind one helper so
// every surface (shop, cart, checkout, order history, the homepage merch
// strip) reads the same fields the same way. A merch product's own
// title/description/images win; a legacy product from the gallery days
// has none and falls through to its Artwork's.
//
// Client-safe: plain functions over a structural type.

export interface ProductDisplayLike {
  title?: string | null;
  description?: string | null;
  images?: string[] | null;
  slug?: string | null;
  artwork?: {
    title: string;
    imageUrl: string;
    description?: string | null;
    slug?: string | null;
  } | null;
}

/** Null (not a placeholder) when nothing names it, so an order line can
 *  still fall through to its own titleSnapshot. */
export function productTitle(p: ProductDisplayLike | null | undefined): string | null {
  if (!p) return null;
  return p.title?.trim() || p.artwork?.title || null;
}

export function productDescription(p: ProductDisplayLike | null | undefined): string | null {
  if (!p) return null;
  return p.description?.trim() || p.artwork?.description || null;
}

export function productImages(p: ProductDisplayLike | null | undefined): string[] {
  if (!p) return [];
  if (p.images && p.images.length > 0) return p.images;
  return p.artwork?.imageUrl ? [p.artwork.imageUrl] : [];
}

export function productImage(p: ProductDisplayLike | null | undefined): string | null {
  return productImages(p)[0] ?? null;
}

/** The product's own page (/shop/[slug]); a legacy product without a slug
 *  goes to the artwork page it borrows everything else from, or the shop. */
export function productHref(p: ProductDisplayLike | null | undefined): string {
  if (p?.slug) return `/shop/${p.slug}`;
  if (p?.artwork?.slug) return `/artwork/${p.artwork.slug}`;
  return "/shop";
}

/** Whether the product still stands on an artwork (gallery-era row). */
export function isLegacyProduct(p: ProductDisplayLike | null | undefined): boolean {
  return Boolean(p?.artwork) && !p?.title?.trim();
}
