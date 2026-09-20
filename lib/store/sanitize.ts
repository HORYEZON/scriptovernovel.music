// lib/store/sanitize.ts — validation the products API shares between create
// and update. Client-safe (the admin form reuses the limits).
import { MAX_PRODUCT_DESCRIPTION, MAX_PRODUCT_IMAGES, MAX_PRODUCT_TITLE, isProductCategory } from "@/lib/store/categories";

export type VariantInput = { label?: string; price?: number | string; stock?: number | string };

export function parseVariants(input: unknown): { label: string; price: number; stock: number; sortOrder: number }[] | null {
  if (!Array.isArray(input)) return null;
  return input
    .filter((v: VariantInput) => v?.label?.trim() && v.price !== undefined && v.price !== "")
    .map((v: VariantInput, i: number) => ({
      label: v.label!.trim(),
      price: Math.max(0, parseFloat(String(v.price)) || 0),
      stock: Math.max(0, parseInt(String(v.stock)) || 0),
      sortOrder: i,
    }));
}

/** Merch fields from a request body → validated partial, or an error. Only
 *  fields present in the body are returned, so PATCH stays partial. */
export function sanitizeMerchFields(body: Record<string, unknown>):
  | { data: { title?: string | null; description?: string | null; images?: string[]; category?: string | null; featured?: boolean } }
  | { error: string } {
  const data: { title?: string | null; description?: string | null; images?: string[]; category?: string | null; featured?: boolean } = {};
  if ("title" in body) {
    const t = body.title;
    if (t === null || t === "") data.title = null;
    else if (typeof t === "string" && t.trim().length <= MAX_PRODUCT_TITLE) data.title = t.trim();
    else return { error: `Title is at most ${MAX_PRODUCT_TITLE} characters.` };
  }
  if ("description" in body) {
    const d = body.description;
    if (d === null || d === "") data.description = null;
    else if (typeof d === "string" && d.length <= MAX_PRODUCT_DESCRIPTION) data.description = d.trim() || null;
    else return { error: `Description is at most ${MAX_PRODUCT_DESCRIPTION} characters.` };
  }
  if ("images" in body) {
    const imgs = body.images;
    if (!Array.isArray(imgs) || imgs.some((u) => typeof u !== "string" || u.length > 2000)) return { error: "Images must be a list of URLs." };
    if (imgs.length > MAX_PRODUCT_IMAGES) return { error: `At most ${MAX_PRODUCT_IMAGES} photos.` };
    data.images = imgs.map((u: string) => u.trim()).filter(Boolean);
  }
  if ("category" in body) {
    const c = body.category;
    if (c === null || c === "") data.category = null;
    else if (isProductCategory(c)) data.category = c;
    else return { error: "Unknown category." };
  }
  if ("featured" in body) {
    if (typeof body.featured !== "boolean") return { error: "Invalid payload" };
    data.featured = body.featured;
  }
  return { data };
}
