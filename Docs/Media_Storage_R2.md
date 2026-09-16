# Media Storage — Cloudflare R2

> **Status:** Live since 2026-09-15. Every media file the site serves comes
> from R2. Supabase is Postgres only. **The old Supabase bucket was deleted on
> 2026-09-16** — R2 is the only copy of the media. See
> [Decommissioning Supabase Storage](#decommissioning-supabase-storage) for
> what was verified first.

## Why

Supabase Storage bills egress and this site's media is heavy — a 3D museum
with dozens of `.glb` props per room. Two quota blowouts in ten days
(`Docs/Museum_AssetOptimization.md` covers the first and the compression that
answered it; the second, 09/11, was images). Compression bought headroom; it
did not change the fact that every visit is metered.

R2 bills **no egress**. Storage is $0.015/GB/month and the site's ~308 MB is
inside the free tier. Media also sits behind Cloudflare's edge cache, which
Supabase's CDN did as well but is now the same company as the bucket.

## Where things are

| | |
|---|---|
| Bucket | `scriptovernovel-music-website` (env `R2_BUCKET`) |
| Public origin | `R2_PUBLIC_URL` — currently the bucket's **Public Development URL** (`https://pub-….r2.dev`) |
| S3 endpoint | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (server-side only) |
| Token | *Object Read & Write*, scoped to this one bucket. Cannot list other buckets or edit bucket settings — CORS and public access are dashboard operations |

Object keys are **identical** to what they were in Supabase (`img/<id>.webp`,
`models/optimized/<id>.glb`, `music/…`, `videos/…`, `events/videos/…`). A
stored URL is therefore just `R2_PUBLIC_URL + "/" + key`, and the migration's
database rewrite was a pure origin swap.

### Layout

| Prefix | Holds | Served? |
|---|---|---|
| `img/` | Every image the site displays: `<id>.webp` full (≤2400px), `<id>.m.webp` medium (≤1280px), `<id>.t.webp` thumb (≤640px) — WebP q82 | Yes — the only image files any page links to |
| `originals/` | The untouched upload, `<id>.<ext>`, same id as its three variants | **No.** Never linked; reachable only by its random key |
| `models/optimized/` | Compressed `.glb` props | Yes |
| `models/` | Raw `.glb` during upload — deleted once optimized | Transient |
| `music/`, `videos/`, `events/videos/` | Audio and video, as uploaded | Yes |
| *(root)* | Nothing new. Pre-2026-09-12 uploads used to live here uncompressed; the backfill below moved every referenced one into `img/` + `originals/` | — |

There is no "folder" in R2 — these are key prefixes, which the dashboard
renders as folders. Which prefix a file lands in is decided by the upload
route it came through (`lib/storage/server.ts`), not by anything the admin
chooses.

#### Why `originals/` exists

The display files are lossy — WebP quality 82, capped at 2400px — which is
the right trade for a screen and the wrong one for anything else. A 2400px
image prints at ~8 inches / 20 cm at 300 DPI; larger than that it softens,
and WebP artefacts that are invisible on a monitor can surface on smooth
gradients in print. Print shops also want TIFF/PNG/JPEG, not WebP.

So every image upload since v6.42 writes the master alongside its three
variants (`uploadCompressedImage`), and `deleteArtworkImage` removes it with
them. It is not linked from any page and the bucket does not allow listing,
so the only way to fetch a master is to already know its key — the same
protection the display files have, applied to a file nothing ever displays.
That is also why there is deliberately **no "print this" feature**: the
moment a high-res file is offered to visitors it can be taken, watermark or
not, and the artist's decision was to never offer it. The masters exist for
the artist, not the public.

Storage cost is nil at this scale (~64 MB for 205 masters, inside the 10 GB
free tier) and there is no egress. Deleting `originals/` later is one prefix
delete if the decision ever changes.

### About the r2.dev URL

The Public Development URL works without owning a domain, which is why it is
in use. Cloudflare rate-limits it and does not recommend it for production; for
this site's traffic it is fine. Moving to a custom domain later (`media.<your
domain>`, which requires the domain's DNS to be on Cloudflare) is:

1. Connect the domain in R2 → bucket → Settings → Custom Domains
2. Change `R2_PUBLIC_URL` in `.env` and Vercel
3. Run `scripts/rewrite-media-urls.ts` with the old and new prefixes

Step 3 is the same script the migration used; it takes the prefixes from env,
so point `NEXT_PUBLIC_SUPABASE_URL`-shaped input at the old r2.dev origin
instead (or generalise the script's `OLD_PREFIX` — it is two lines).

## Code

Three files under `lib/storage/`, and nothing else in the app knows the
backend:

| File | Runs | Role |
|---|---|---|
| `r2.ts` | server | The only module that speaks S3. `putObject`, `getObject`, `deleteObjects`, `listObjects`, `createPresignedPut`, `publicUrl` / `pathFromPublicUrl` |
| `server.ts` | server | Every upload helper the API routes call (`uploadCompressedImage`, `uploadArtworkVideo`, `createModelUploadUrl`, …). Formerly `lib/supabase/storage.ts`; **same exports, same signatures** |
| `browser.ts` | client | `uploadModelViaSignedUrl` / `uploadAudioViaSignedUrl` — a `fetch(..., { method: "PUT" })` to a presigned URL. Dependency-free. Formerly needed supabase-js and the anon key; needs nothing now |
| `cache.ts` | both | `IMMUTABLE_CACHE` — the one value both halves must agree on |

### Uploads that bypass the server

`.glb` props (up to 100 MB) and audio can't be posted through a route handler
(Vercel caps request bodies at ~4.5 MB), so the browser PUTs them straight to
R2. The server mints a **presigned PUT** — one object key, one `Content-Type`,
one `Cache-Control`, ten-minute expiry — and that URL is the entire
authorization. Two consequences the code depends on:

- The browser **must** send the exact `Content-Type` and `Cache-Control` the
  URL was signed with, or R2 returns 403. `browser.ts` does; the audio sign
  route returns the validated `contentType` for the browser to echo back, and
  the `.glb` PUT is always signed as `model/gltf-binary` regardless of what the
  file picker guessed.
- The PUT goes to the S3 endpoint, not the public URL, so the bucket's CORS
  policy has to allow `PUT` from the site's origin (below).

The sign routes' response shape changed from Supabase's `{ path, token,
publicUrl }` to `{ path, uploadUrl, publicUrl }` (`+ contentType` for audio).
`lib/openapi.ts` documents both.

### CORS

Set in the dashboard (R2 → bucket → Settings → CORS Policy). The API token
cannot do this. Without it, **every WebGL texture in the museum fails to load**
— three.js requests images with `crossOrigin="anonymous"`, and a missing
`Access-Control-Allow-Origin` is a hard failure, not a tainted canvas.

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  },
  {
    "AllowedOrigins": ["https://scriptovernovel-music.vercel.app", "https://*.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "MaxAgeSeconds": 3600
  }
]
```

Public reads from anywhere — the objects are public regardless, and the header
is what WebGL needs. Uploads only from the site itself. If the site moves to a
custom domain, add that origin to the second rule.

#### The cache-poisoning gotcha (v6.41.1)

R2 only emits `Access-Control-Allow-Origin` — and `Vary: Origin` — when the
request carried an `Origin` header. A plain `<img>` never sends one, so its
response has **neither**, and the browser caches it for a year (`immutable`).
A later `crossOrigin="anonymous"` request for the same URL is answered from
that cache entry, finds no CORS header, and fails. Supabase Storage sent
`access-control-allow-origin: *` on every response, so this never showed.

```
$ curl -sI …/1786967518364-7weekm.jpg | grep -i 'access-control\|vary'
                                                   # nothing
$ curl -sI -H 'Origin: https://scriptovernovel-music.vercel.app' …/1786967518364-7weekm.jpg | grep -i 'access-control\|vary'
Access-Control-Allow-Origin: *
Vary: Origin
```

It bit `Profile.logoImage`, the one URL loaded both ways: the navbar shows it
in an `<img>` on every page, then the About Room's plaque (a texture) and the
`[R]` screenshot watermark (a canvas draw) request it with CORS — blank
plaque and a "Couldn't save the screenshot" toast for anyone who hadn't
arrived at `/gallery/museum` on a cold cache. (Incognito worked, which is the
tell.)

Fix: every pixel-reading load goes through
[`lib/images/corsUrl.ts`](../lib/images/corsUrl.ts), which appends `?cors=1`
so the CORS request has its own cache key in the browser and at the edge —
`loadDownscaledTexture`, `ScreenshotCapture`'s logo, `CompanionImage`'s GIF
path. The stored URL is untouched; this is fetch-time only. The bucket can't
be told to always send the header (that would need a custom domain plus a
Transform Rule), so the split is the code's responsibility. **Any new
`crossOrigin` / `ImageLoader` / `drawImage`-from-URL path must use it.**

### Cache-Control

Every object is written with `public, max-age=31536000, immutable`. Safe
because object keys are never reused — a new upload is always a new key — so
the bytes at a URL can never change. The migration script set the same header
on every copied object, including files uploaded to Supabase before it set
one.

## The migration, as run

Two scripts in `scripts/`, both re-runnable:

**`migrate-media-to-r2.ts`** — lists the Supabase bucket recursively and
copies each object to R2 at the same key, carrying Content-Type from
Supabase's metadata and setting the immutable Cache-Control. Idempotent: an
object already in R2 at the same size is skipped. `--verify` HEADs every key on
the public URL and compares sizes.

> Run 2026-09-15: **484 objects, 308.1 MB, 130 s, 0 failures. Verify: 484/484.**

**`rewrite-media-urls.ts`** — asks `information_schema` for every `text`,
`varchar`, `text[]` and `json(b)` column in `public`, and substring-replaces
the Supabase prefix with the R2 one wherever it appears. It does not carry a
list of "URL columns" because that list is wrong the moment someone adds one
— the dry run surfaced `SoundEffect.url`, `Profile.callingCardBack` and
`DigitalMuseum.museumMusicUrl`, none of which a hand-written list had. One
transaction; a rollback JSON of every row-value about to change is written
first; the transaction refuses to commit if any reference to the old prefix
survives.

> Run 2026-09-15: **27 columns, 321 row-values, 0 references to Supabase
> remaining.** Before applying, every one of the 305 distinct object paths the
> database referenced was confirmed present on R2. Rollback file:
> `../scriptovernovel-rollbacks/rollback-media-urls-1789486002870.json` (outside the
> repo; the pattern is gitignored).

Substring replacement is the only operation that is correct for all three
shapes a URL takes in this schema: a bare column value, an element of a
`String[]` column (`Artwork.imageUrls`, `Profile.profileImages`), and a URL
nested inside a JSON config blob (`MuseumSceneObject.modelUrl` for the
`arcade-config` and `about-contact` singletons). Anything that treats the
column as a whole URL corrupts the last two.

### Order of operations, and why

1. Code on a branch, **not merged** — deploying it before Vercel had the
   `R2_*` variables would have broken every upload at the first missing-env
   check, while existing media (absolute Supabase URLs in the DB) kept working
2. Copy + verify — additive; Supabase untouched
3. DB references checked against R2 — 305/305
4. CORS confirmed live — a `GET` with an `Origin` header returns
   `Access-Control-Allow-Origin`, a `PUT` preflight returns 204
5. URL rewrite — the only irreversible-feeling step, and the one with a
   rollback file
6. Merge + deploy

## The image backfill (2026-09-16, v6.42)

Upload-time compression (v6.31) only ever touched *new* uploads. Everything
uploaded before 2026-09-12 — 281 files, 90.5 MB, averaging 330 KB with the
largest at 2.39 MB — was still served at its original size everywhere,
including as a 640px grid card. Measured against the live gallery before the
run: **107 of 108 published artworks** served the original; a full scroll of
the gallery was **28.76 MB**.

`scripts/backfill-image-variants.ts`, for each referenced original: download,
compress into the three variants, upload them to `img/`, upload the untouched
file to `originals/` under the same new id, repoint every row that carried
the old URL, then delete the root-level file. Re-runnable; a failure leaves
that image untouched.

Two things the script had to learn for this run, both worth knowing if it is
ever run again:

- **Its column list was incomplete.** A schema-wide scan after the first pass
  found 8 referenced originals it had missed: `Profile.callingCardFront` /
  `callingCardBack`, and six `textureUrl`s nested inside the JSON configs in
  `MuseumSceneObject.modelUrl` (dividers, the story podium, a room banner).
  Plain columns were added to the list; the JSON ones get a `substring: true`
  entry, which replaces the URL *inside* the blob instead of replacing the
  column value — the same lesson the migration's rewrite script was built
  on. There is no generic way to discover "columns that hold an image URL";
  when a new one is added, it has to be added here too.
- **`--keep-originals` became the default and was renamed.** The original is
  never dropped; it moves to `originals/`. `--drop-originals` exists and is
  not recommended.

> Run 2026-09-16: **3 (test) + 202 + 8 = 213 images, 0 failures.** Gallery
> grid: 108/108 artworks on thumbs, **28.76 MB → 6.61 MB** for a full scroll.
> A side-by-side of one original against its full-size WebP (1440×1080 line
> art, 182 KB → 113 KB) showed no visible difference at 1:1.

Left in place: **90 root-level files (~29 MB) referenced by nothing** —
checked against every text, array and JSON column in the schema, not just
the script's list. They are earlier uploads that were replaced or removed
without their file being cleaned up. Deleting them is a separate decision.

## Orphan sweep and two props the optimizer missed (2026-09-16)

After the backfill, 90 root-level files (30.4 MB) remained that nothing
referenced. Deleted after a fresh three-way check *at the moment of
deletion*, not from an earlier audit: every text / array / JSON column in the
database, the repo source (seeds, defaults), and the production HTML of 12
public routes. 0 references on all three. A manifest of names and sizes is in
`../scriptovernovel-rollbacks/` (the bytes are gone; R2 has no versioning here).

The same listing showed two raw `.glb` files under `models/` that were
**referenced** — both uploaded that day, both in the entry room, one of them
**56.1 MB**. `/api/upload/model/optimize` had failed for both and the browser
had stored the raw URL, exactly as its non-fatal fallback is designed to do.
Compressed offline with the route's own `optimizeGlb()` (56.10 → 3.30 MB and
2.21 → 0.15 MB, 1.4 s each), uploaded to `models/optimized/`, rows repointed,
raw files removed.

**Why it failed — found and fixed (v6.42.2).** `draco3dgltf` locates its
`.wasm` with `__dirname + "/draco_encoder.wasm"` and `readFileSync`. Next
bundles route handlers with webpack, so in production `__dirname` was the
route chunk's directory, the file wasn't there, and `createEncoderModule()`
rejected:

```
RuntimeError: Aborted(Error: ENOENT: no such file or directory,
  open '…/.next/server/app/api/upload/model/optimize/draco_decoder_gltf.wasm')
```

Under `tsx` nothing is bundled, so every offline run — and the "measured on
the largest real model" number in `Museum_AssetOptimization.md` — worked,
while every production upload since the route shipped on 09/06 fell back to
raw. Reproduced locally with `next build && next start` against the old
config (that exact error) and the new one (`optimized: true`).

Fix in `next.config.ts`: `serverExternalPackages: ["draco3dgltf", "sharp"]`
keeps the package out of the bundle so it is `require()`d from node_modules
with `__dirname` intact, and the file tracer carries both `.wasm` files into
the function (`outputFileTracingIncludes` pins it for that route as a
belt-and-braces). Verified in the built chunk: `require("draco3dgltf")`
external, both `.wasm` listed in `route.js.nft.json`.

Before that was found, the more important fix was that **nothing surfaced
it**: the route's `catch` returned the error as `warning` in a 200 response,
and none of the seven call sites read it. Two changes so it cannot go
unnoticed again:

- the route `console.error`s the failure (Vercel → Functions logs will carry
  the actual cause next time)
- `uploadModelViaSignedUrl` shows a toast whenever compression fell back,
  with the size and the reason — raised once in the helper so every caller
  gets it. `optimized: false` *without* a warning (the file was already
  smaller than its re-encode) is not a failure and stays quiet

**If a prop upload shows that toast, check the Vercel function log for
`[model/optimize]` and send the line.** Until the cause is found, a large raw
prop can be compressed by hand the way these two were.

`models/ktx2/` — 77 files, 114.4 MB — is the KTX2 experiment from
`Docs/Museum_AssetOptimization.md`, copied across in the migration.
Referenced by nothing; whether to delete it is open.

## Decommissioning Supabase Storage

Done 2026-09-16, after the site had run from R2 and the admin had confirmed
the museum, an image upload and a `.glb` upload all worked in production.

Verified immediately before deleting, in this order:

1. **Database** — all 340 text / `text[]` / json(b) columns across every
   table scanned for `supabase.co/storage`: **0 rows**
2. **Code on `main`** — `app/`, `lib/`, `components/`, config: **0 runtime
   references**; only `scripts/migrate-media-to-r2.ts` (one-off) reads Supabase
3. **Live production** — home, gallery, museum, shop, stories, about, events
   fetched and grepped: **0 Supabase refs**, 590 R2 refs

Then: every object removed explicitly (Supabase's `emptyBucket()` returned ok
but left the objects in place — it is eventually consistent, so the deletion
lists and removes in batches until a listing comes back empty), then
`deleteBucket()`. A cache-busted request to an old URL now returns 400; a plain
one may return 200 from Supabase's CDN for a while — that is edge cache with a
one-year `Cache-Control`, not the bucket.

Removed at the same time: `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env`
(**`DATABASE_URL` / `DIRECT_URL` untouched** — Postgres is still Supabase),
and `**.supabase.co` from `images.remotePatterns`. The same three variables
should be removed from Vercel; nothing reads them, so leaving them is harmless
but untidy. `@supabase/supabase-js` stays in `package.json` only because the
historical migration script imports it.

**There is no longer a second copy of the media outside R2.** The backup
export (Settings → Backup, with media) is the way to make one.
