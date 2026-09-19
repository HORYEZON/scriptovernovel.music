// lib/orders/item-display.ts
//
// What an order line is called and looks like, whether or not its product
// still exists. While the product is in the catalogue its own artwork wins;
// once it has been permanently deleted (Trash → Empty / Delete Forever) the
// line falls back to the title/image stamped on it at that moment (see
// lib/trash-actions.ts's purge of products and artworks). A line with
// neither — a product deleted straight in the database, before the
// snapshots existed — still gets a readable label rather than a crash.

export interface OrderItemLike {
  titleSnapshot?: string | null;
  imageSnapshot?: string | null;
  product?: { artwork: { title: string; imageUrl: string } } | null;
}

export const REMOVED_PRODUCT_TITLE = "Removed product";

export function orderItemTitle(item: OrderItemLike): string {
  return item.product?.artwork.title ?? item.titleSnapshot ?? REMOVED_PRODUCT_TITLE;
}

/** Null when there is nothing to show — callers render a placeholder. */
export function orderItemImage(item: OrderItemLike): string | null {
  return item.product?.artwork.imageUrl ?? item.imageSnapshot ?? null;
}

/** A neutral tile for a line with no picture left — a data URL so it needs
 *  no file and passes next/image's src check. */
export const REMOVED_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2a2724"/>' +
      '<path d="M20 44l8-10 6 7 4-5 6 8z" fill="#5c554d"/><circle cx="24" cy="22" r="4" fill="#5c554d"/></svg>'
  );

/** Always an image — the real one, the snapshot, or the placeholder. */
export function orderItemImageOrPlaceholder(item: OrderItemLike): string {
  return orderItemImage(item) ?? REMOVED_PRODUCT_IMAGE;
}
