// lib/store/product-display.ts
//
// How a product is shown — title, image(s), link — behind one helper so
// every surface (shop, cart, checkout, order history, the homepage merch
// strip) reads the same fields the same way. Written ahead of the Store
// decoupling (Phase 5 of the band-site plan): today a Product carries no
// title or images of its own and borrows its Artwork's, so these fall
// through to `artwork`. Once Product has `title`/`images`/`slug` columns,
// those win and the artwork fallback stays for legacy rows — a schema
// change then, not a call-site hunt.
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

/** The product's own page once it has one (Phase 5's /shop/[slug]); until
 *  then the artwork page it borrows everything else from, or the shop. */
export function productHref(p: ProductDisplayLike | null | undefined): string {
  if (p?.slug) return `/shop/${p.slug}`;
  if (p?.artwork?.slug) return `/artwork/${p.artwork.slug}`;
  return "/shop";
}
