// lib/museum/loadDownscaledTexture.ts
//
// Manual texture load + client-side downscale. There's no Supabase image
// transform/resize endpoint in this project (see lib/supabase/storage.ts) —
// original artwork uploads can be several MB at full resolution, which is
// wasteful to hand straight to the GPU as a wall texture. This loads the
// image once, draws it onto an offscreen canvas capped at MAX_TEXTURE_DIM,
// and builds the THREE.Texture from that canvas instead of the raw image.
// Deliberately NOT drei's useTexture — that hook uploads the source image
// as-is with no room for this downscale step.
import * as THREE from "three";
import { imageVariantUrl } from "@/lib/images/variants";
import { isLowEndDevice } from "./deviceTier";

const MAX_TEXTURE_DIM = 1024;
// Old phones get a quarter of the texture memory per image and, unusually,
// *better* sampling for it — see the mipmap note in the loader below.
const MAX_TEXTURE_DIM_LOW_END = 512;

export interface LoadedMuseumTexture {
  texture: THREE.Texture;
  /** Natural width / height of the *original* (pre-downscale) image. */
  aspect: number;
  /**
   * True when the image carries real transparency — a cut-out PNG rather than
   * a rectangular photo. Callers that can draw a silhouette use it to decide
   * whether to (see CosplayStandee.tsx, which turns its printed board into an
   * actual cut-out standee when the uploaded photo has an alpha channel).
   *
   * Probed rather than guessed from the file extension: plenty of PNGs are
   * fully opaque, and drawing a rectangular photo as a "cut-out" would just
   * mean a floating rectangle with no board behind it. False whenever the
   * probe can't run — an unreadable canvas has to mean "treat it as an
   * ordinary photo", which is what every caller did before this existed.
   */
  hasAlpha: boolean;
  /**
   * Where the *opaque* part of the image actually sits, in 0..1 of the frame
   * (x/y from the top-left). `{ x: 0, y: 0, w: 1, h: 1 }` for any ordinary
   * photo, and whenever the probe can't run.
   *
   * A cut-out export is almost never trimmed to its figure — this one carries
   * ~4% empty rows above and below and ~8% empty columns either side. Drawn
   * against the frame, that stands the figure a few centimetres off its own
   * plinth (much more once the standee is scaled up) and renders it that much
   * under the life-size height the room asks for, since most of what it was
   * given is nothing. Callers size and seat the figure by this box instead.
   */
  contentBox: { x: number; y: number; w: number; h: number };
}

/** The whole frame — what an opaque image's content box always is. Exported so
 *  a caller can use the same value as its own pre-load state. */
export const FULL_CONTENT_BOX = { x: 0, y: 0, w: 1, h: 1 };

/** Size of the offscreen square the alpha probe below samples through. Small
 *  on purpose: this answers "is any of this see-through", not "which pixels",
 *  and 64x64 is ~4k reads however large the upload was. Transparency in a
 *  cut-out is a large region (everything around the figure), so it survives
 *  the downsample — a handful of stray soft pixels would not, and shouldn't
 *  flip a photo into silhouette mode anyway. */
const ALPHA_PROBE_DIM = 64;

/** Below this the pixel is see-through enough to count. Not 255: JPEG-ish
 *  edge softening and canvas rounding leave "opaque" pixels at 253-254. */
const ALPHA_OPAQUE_CUTOFF = 250;

/** Alpha at or above this counts as part of the figure when measuring the
 *  content box — half-transparent antialiasing along an outline is edge, not
 *  substance, and including it would inflate the box by a pixel of probe grid
 *  (a whole 1.5% of the frame). */
const ALPHA_CONTENT_CUTOFF = 128;

function probeAlpha(image: HTMLImageElement): Pick<LoadedMuseumTexture, "hasAlpha" | "contentBox"> {
  const opaque = { hasAlpha: false, contentBox: FULL_CONTENT_BOX };
  try {
    const canvas = document.createElement("canvas");
    canvas.width = ALPHA_PROBE_DIM;
    canvas.height = ALPHA_PROBE_DIM;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return opaque;
    ctx.drawImage(image, 0, 0, ALPHA_PROBE_DIM, ALPHA_PROBE_DIM);
    // Throws (a SecurityError on a tainted canvas) if the image ever loads
    // without usable CORS headers — Supabase storage sends
    // `access-control-allow-origin: *`, but a swapped bucket or a proxy that
    // strips it shouldn't take the whole texture down with it.
    const { data } = ctx.getImageData(0, 0, ALPHA_PROBE_DIM, ALPHA_PROBE_DIM);

    let hasAlpha = false;
    let minX = ALPHA_PROBE_DIM;
    let minY = ALPHA_PROBE_DIM;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < ALPHA_PROBE_DIM; y++) {
      for (let x = 0; x < ALPHA_PROBE_DIM; x++) {
        const a = data[(y * ALPHA_PROBE_DIM + x) * 4 + 3];
        if (a < ALPHA_OPAQUE_CUTOFF) hasAlpha = true;
        if (a >= ALPHA_CONTENT_CUTOFF) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!hasAlpha) return opaque;
    // A frame with nothing solid in it at all (a fully transparent upload, or
    // artwork so faint it never crosses the cutoff) has no box worth trusting.
    if (maxX < minX || maxY < minY) return { hasAlpha, contentBox: FULL_CONTENT_BOX };

    // Grid cells are inclusive, so the box runs to the far edge of the last
    // one — a figure spanning cells 0..63 fills the frame, not 63/64 of it.
    return {
      hasAlpha,
      contentBox: {
        x: minX / ALPHA_PROBE_DIM,
        y: minY / ALPHA_PROBE_DIM,
        w: (maxX + 1 - minX) / ALPHA_PROBE_DIM,
        h: (maxY + 1 - minY) / ALPHA_PROBE_DIM,
      },
    };
  } catch {
    return opaque;
  }
}

// One in-flight/-resolved load per URL — several ArtworkFrame instances
// never re-request or re-decode the same image (relevant if an artwork
// somehow gets curated twice, and cheap insurance either way).
//
// Only *successful* loads stay in this map. A rejected promise used to be
// cached here alongside them, which quietly turned one transient network
// blip into a permanent hole for the rest of the page's life: every later
// caller for that URL got the same already-rejected promise back and never
// re-requested. A museum load fires ~30 room surfaces plus every artwork
// image at Supabase at once, so the odd dropped connection is normal — and
// the symptom was a room whose wall/floor/ceiling stayed flat colour while
// its neighbours were textured, a different room each reload. Failures are
// evicted below so the next caller genuinely retries.
const inflight = new Map<string, Promise<LoadedMuseumTexture>>();

// How many times one URL is re-requested before giving up, and how long to
// wait between attempts. Short and bounded: this is covering for dropped
// connections under a burst, not for a genuinely missing file (which fails
// all three attempts fast and cheaply).
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

export function loadDownscaledTexture(sourceUrl: string): Promise<LoadedMuseumTexture> {
  // Every texture here ends up ≤ MAX_TEXTURE_DIM (1024) anyway, so for a
  // compressed upload the ≤1280px "medium" rendition is all the pixels the
  // canvas below can use — at a fraction of the full-size download, and a
  // room fetches every wall, frame and prop at once. Pre-compression URLs
  // pass through unchanged (see lib/images/variants.ts).
  const url = imageVariantUrl(sourceUrl, "medium");
  const cached = inflight.get(url);
  if (cached) return cached;

  const promise = attemptLoad(url, 1);
  // Evict on failure so a retry is possible; keep successes cached forever.
  promise.catch(() => {
    if (inflight.get(url) === promise) inflight.delete(url);
  });
  inflight.set(url, promise);
  return promise;
}

function attemptLoad(url: string, attempt: number): Promise<LoadedMuseumTexture> {
  return loadOnce(url).catch((err) => {
    if (attempt >= MAX_ATTEMPTS) throw err;
    return new Promise<LoadedMuseumTexture>((resolve, reject) => {
      setTimeout(() => attemptLoad(url, attempt + 1).then(resolve, reject), RETRY_DELAY_MS * attempt);
    });
  });
}

function loadOnce(url: string): Promise<LoadedMuseumTexture> {
  return new Promise<LoadedMuseumTexture>((resolve, reject) => {
    const loader = new THREE.ImageLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      url,
      (image) => {
        const { width, height } = image;
        const lowEnd = isLowEndDevice();
        const maxDim = lowEnd ? MAX_TEXTURE_DIM_LOW_END : MAX_TEXTURE_DIM;
        const scale = Math.min(1, maxDim / Math.max(width, height));

        let source: HTMLImageElement | HTMLCanvasElement = image;
        if (scale < 1) {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            source = canvas;
          }
        }

        const texture = new THREE.Texture(source);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        if (lowEnd) {
          // Counter-intuitively, *adding* mipmaps is the optimisation here.
          // An artwork viewed from across the room samples a 512px texture
          // into a few dozen pixels; without a mip chain every one of those
          // fragments reads far-apart texels, which misses the GPU's texture
          // cache on almost every access — the exact pattern a weak mobile
          // memory bus handles worst. A mip chain costs 33% more texture
          // memory but is sampled from a level that roughly matches the
          // on-screen size, so reads stay local and cheap. Paired with the
          // 512 cap above, that's still ~3x *less* memory than the 1024
          // no-mipmap path, and it removes the shimmering that untextured
          // minification causes on angled walls.
          //
          // Safe on NPOT sources here because three r169 is WebGL2-only
          // (WebGL1, where NPOT mipmaps are illegal, was dropped in r163).
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.generateMipmaps = true;
          // Anisotropic filtering is a per-sample multiplier on exactly the
          // grazing-angle lookups mipmapping just made cheap; on the GPUs
          // this branch targets it's not worth its cost.
          texture.anisotropy = 1;
        } else {
          // Unchanged for desktop and current phones — no visual or memory
          // difference from before this branch existed.
          texture.minFilter = THREE.LinearFilter;
          texture.generateMipmaps = false;
          texture.anisotropy = 4;
        }

        resolve({ texture, aspect: width / height, ...probeAlpha(image) });
      },
      undefined,
      (event) =>
        reject(
          event instanceof ErrorEvent
            ? event.error ?? new Error(`Failed to load texture: ${url}`)
            : event ?? new Error(`Failed to load texture: ${url}`)
        )
    );
  });
}
