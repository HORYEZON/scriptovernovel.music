// lib/storage/cache.ts
//
// Dependency-free on purpose: both halves of the upload story need this value
// — r2.ts (server, pulls in the AWS SDK) and browser.ts (client, must not).
// Same reason lib/supabase/bucket.ts used to exist.

/** Every upload helper's path is a fresh timestamp+random name that is never
 *  reused, so the object at a URL can never change — which is what makes a
 *  one-year cache safe, and what lets Cloudflare's edge serve repeat visits
 *  without touching the bucket at all. Presigned PUTs sign this header too, so
 *  the browser has to send exactly this string. */
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
