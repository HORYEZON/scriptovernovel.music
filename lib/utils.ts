// lib/utils.ts

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * What a product costs, in one short string.
 *
 * A product with size/format variants (ProductVariant — A4 / A3 prints and
 * the like) has no single price: the base price on the Product row is only
 * what it sells for when there are *no* variants, and /shop swaps the
 * displayed figure as the visitor picks a size. Anywhere that has to state a
 * price without a size chosen yet — the admin product table, the Services
 * Room's wall plaques, the museum's info panel — has to show the span
 * instead, or it quotes a number the visitor can't actually pay.
 *
 * Falls back to a single formatted price when there are no variants, or when
 * every variant happens to cost the same (a range of one value reads as a
 * mistake, not as information).
 */
export function formatPriceRange(basePrice: number, variantPrices: number[]): string {
  if (variantPrices.length === 0) return formatPrice(basePrice);
  const min = Math.min(...variantPrices);
  const max = Math.max(...variantPrices);
  // En dash, not a hyphen — this is a numeric span.
  return min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Byte count → "1.4 MB". Used across the System Health tab (database size,
 * storage usage, heap) so every size on that page reads the same way.
 *
 * Lives here rather than in lib/system-health.ts because that module imports
 * prisma, and SystemHealthPanel.tsx is a client component — it can take the
 * *types* from there (erased at compile time) but not a runtime value.
 *
 * Binary units (1024), since these are disk and memory figures where that is
 * what the underlying tools report. One decimal below 100, none above: "1.4 GB"
 * and "412 MB" both read cleanly, "412.3 MB" is noise.
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Safely extract a human-readable message from an unknown catch value. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

/** Safely extract a `.code` property (e.g. Prisma error codes) from an unknown catch value. */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  PAID: "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  CANCELLED: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20",
  SHIPPED: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
};
