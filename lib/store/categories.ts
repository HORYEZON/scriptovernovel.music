// lib/store/categories.ts — what kinds of merch the Store sells. A string
// column with this allow-list rather than an enum, so adding one is a code
// change, not a migration. Client-safe.
export const PRODUCT_CATEGORIES = [
  { value: "shirt", label: "Shirts" },
  { value: "vinyl", label: "Vinyl" },
  { value: "cd", label: "CDs & cassettes" },
  { value: "poster", label: "Posters & prints" },
  { value: "accessory", label: "Accessories" },
  { value: "other", label: "Other" },
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["value"];
const VALUES = PRODUCT_CATEGORIES.map((c) => c.value);

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && (VALUES as readonly string[]).includes(value);
}

export function productCategoryLabel(value: string | null | undefined): string | null {
  return PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? null;
}

export const MAX_PRODUCT_TITLE = 120;
export const MAX_PRODUCT_DESCRIPTION = 3000;
export const MAX_PRODUCT_IMAGES = 8;
