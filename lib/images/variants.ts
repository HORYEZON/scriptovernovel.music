// lib/images/variants.ts
//
// Naming convention for the resized copies every image upload now produces
// (see lib/images/compress.ts). Pure string work, no I/O, so it's safe to
// import from client components and the public pages that render grids.
//
// A compressed upload lands in the bucket as three siblings that share one
// basename:
//
//   img/<id>.webp      full   — lightbox, artwork page, museum info panel
//   img/<id>.m.webp    medium — museum wall textures, hero carousel
//   img/<id>.t.webp    thumb  — gallery/shop grids, cart & wishlist rows
//
// Only the *full* URL is stored in the database. The other two are derived
// from it here, which is what lets this ship without a schema change and
// without touching the ~20 places that already read `imageUrl`. Anything not
// under the `img/` prefix (every upload from before this existed, Unsplash
// seeds, GIFs — see compress.ts for why those are left alone) has no
// siblings, so the helper hands the original URL straight back rather than
// pointing at a file that isn't there.

export const IMAGE_PREFIX = "img";

export type ImageVariant = "full" | "medium" | "thumb";

const SUFFIX: Record<ImageVariant, string> = {
  full: ".webp",
  medium: ".m.webp",
  thumb: ".t.webp",
};

/** Matches `.../img/<id>.webp` and only that — a sibling URL passed back in
 *  (`.m.webp` / `.t.webp`) wouldn't match because `<id>` never contains a
 *  dot, so re-deriving from an already-derived URL is a no-op too. */
const FULL_URL_RE = new RegExp(`/${IMAGE_PREFIX}/([^/.]+)\\.webp$`);

/** Bucket-relative paths of all three siblings for one upload id. */
export function variantPaths(id: string): Record<ImageVariant, string> {
  return {
    full: `${IMAGE_PREFIX}/${id}${SUFFIX.full}`,
    medium: `${IMAGE_PREFIX}/${id}${SUFFIX.medium}`,
    thumb: `${IMAGE_PREFIX}/${id}${SUFFIX.thumb}`,
  };
}

/** The URL of one resized sibling of a stored (full-size) image URL, or the
 *  input unchanged when it isn't a compressed upload. Null/undefined pass
 *  through so callers can use it inline on optional fields. */
export function imageVariantUrl(url: string, variant: ImageVariant): string;
export function imageVariantUrl(url: string | null | undefined, variant: ImageVariant): string | null | undefined;
export function imageVariantUrl(url: string | null | undefined, variant: ImageVariant) {
  if (!url || variant === "full") return url;
  const m = FULL_URL_RE.exec(url);
  if (!m) return url;
  return url.slice(0, m.index) + `/${IMAGE_PREFIX}/${m[1]}${SUFFIX[variant]}`;
}

/** Inverse of the above for cleanup: given a stored full-size URL, the
 *  bucket-relative paths of every sibling to delete alongside it — or null
 *  when the URL isn't a compressed upload (delete just the one path). */
export function siblingPathsFromUrl(url: string): string[] | null {
  const m = FULL_URL_RE.exec(url);
  if (!m) return null;
  return Object.values(variantPaths(m[1]));
}
