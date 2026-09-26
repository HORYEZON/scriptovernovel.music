// lib/store/availability.ts
//
// The one answer to "what can a visitor do with this product right now".
// Client-safe.
//
// Before this, the Store card worked it out from stock alone ("out" / "last" /
// "ok") and the product page recomputed the same sum inline. Adding a
// coming-soon state to two places that each did their own arithmetic is how
// they end up disagreeing — a card saying Sold out over a page with an Add to
// cart button. Everything asks here instead.

export type ProductState =
  /** Announced, not on sale yet. Not buyable; offers an alert. */
  | "coming_soon"
  /** On sale, more than one left. */
  | "available"
  /** On sale, exactly one left — worth saying so. */
  | "last_one"
  /** Was on sale, nothing left. Not buyable; offers an alert. */
  | "sold_out";

export interface AvailabilityLike {
  stock: number;
  comingSoon?: boolean;
  releaseAt?: Date | string | null;
  variants: { stock: number }[];
}

/** Total stock: the variants' when there are variants, else the product's own.
 *  A product with variants ignores its own `stock` column — that value is only
 *  what it sells for when there are none (see lib/utils' formatPriceRange for
 *  the same rule on price). */
export function totalStock(p: AvailabilityLike): number {
  return p.variants.length > 0 ? p.variants.reduce((sum, v) => sum + v.stock, 0) : p.stock;
}

export function productState(p: AvailabilityLike): ProductState {
  // Coming soon outranks stock. A pressing on the way may well have its stock
  // typed in already, and it still isn't for sale until the admin says so.
  if (p.comingSoon) return "coming_soon";
  const stock = totalStock(p);
  if (stock <= 0) return "sold_out";
  if (stock === 1) return "last_one";
  return "available";
}

/** Can this be added to a cart? The one check every buy button uses. */
export function isBuyable(p: AvailabilityLike): boolean {
  const state = productState(p);
  return state === "available" || state === "last_one";
}

/** Would someone want telling when this changes? */
export function acceptsStockAlerts(p: AvailabilityLike): boolean {
  const state = productState(p);
  return state === "coming_soon" || state === "sold_out";
}

/** The short badge for a card, or null when there is nothing to say. */
export function productStateBadge(state: ProductState): string | null {
  switch (state) {
    case "coming_soon":
      return "Coming soon";
    case "sold_out":
      return "Sold out";
    case "last_one":
      return "Last one";
    default:
      return null;
  }
}

/** "Expected 12 October 2026", or null. Deliberately "expected" rather than a
 *  promise: a pressing date moves. */
export function releaseDateLabel(releaseAt: Date | string | null | undefined): string | null {
  if (!releaseAt) return null;
  const d = new Date(releaseAt);
  if (Number.isNaN(d.getTime())) return null;
  return `Expected ${d.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  })}`;
}

/** The sentence under a coming-soon product. */
export function comingSoonLine(releaseAt: Date | string | null | undefined): string {
  return releaseDateLabel(releaseAt) ?? "On sale soon";
}

/** Schema.org availability for a product page's offer. */
export function schemaAvailability(state: ProductState): string {
  switch (state) {
    case "coming_soon":
      return "https://schema.org/PreOrder";
    case "sold_out":
      return "https://schema.org/SoldOut";
    default:
      return "https://schema.org/InStock";
  }
}
