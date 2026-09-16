// lib/images/corsUrl.ts
//
// The URL to *fetch* when an image is going to be read back as pixels — a
// WebGL texture, a canvas drawImage — rather than just shown in an <img>.
// Pure string work, no I/O; safe from client components.
//
// Why this exists: Cloudflare R2 only adds `Access-Control-Allow-Origin` (and
// `Vary: Origin`) to a response when the request carried an `Origin` header.
// A plain <img> never sends one, so the response the browser caches for it —
// for a year, `immutable` — has no CORS header and no Vary. When the same URL
// is then requested with `crossOrigin="anonymous"`, the browser serves it
// straight from that cache entry, sees no CORS header, and fails the load.
// Supabase Storage sent `access-control-allow-origin: *` on every response,
// which is why the museum never hit this before the move to R2.
//
// The one URL loaded both ways is Profile.logoImage: Navbar.tsx shows it in
// an <img>, and the About Room's plaque (a texture) and the [R] screenshot
// watermark (a canvas draw) read it back — both went blank after the
// migration. Everything else the museum loads is either a rendition no <img>
// on the site uses (`.m.webp`, see variants.ts) or exclusive to the museum,
// but that is luck, not a guarantee, so every CORS load goes through here.
//
// A distinct query string is a distinct cache key, both in the browser and at
// Cloudflare's edge, so the two kinds of request can never collide. R2 ignores
// the parameter and serves the object. The stored URL is never touched — this
// is applied at fetch time only, after any variant derivation, and
// lib/storage/r2.ts's pathFromPublicUrl strips a query anyway.

const CORS_PARAM = "cors=1";

/** Appends a cache-splitting query parameter to an http(s) URL. Data, blob
 *  and already-marked URLs pass through unchanged. */
export function corsImageUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  if (url.includes(CORS_PARAM)) return url;
  const [base, hash = ""] = url.split(/(#.*)$/, 2);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${CORS_PARAM}${hash}`;
}
