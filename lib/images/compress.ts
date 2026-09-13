// lib/images/compress.ts
//
// Server-side image compression, run once at upload time. Node-only (sharp)
// — never import this from a client component; the URL helpers a page needs
// live in ./variants.ts.
//
// Why this exists: next.config.ts has `unoptimized: true` (Vercel's free
// image-optimizer quota was the first thing to run out), so until now every
// visitor pulled the artist's *original* upload — routinely 3–8 MB — for
// every card in a grid. That blew through Supabase's free-plan egress
// (13.4 GB against a 5.5 GB quota in Sept 2026) and the bucket was throttled
// for the rest of the cycle, i.e. every image on the site went dead.
//
// Settings, and why they don't cost visible quality:
//   - Longest side capped at 2400px. No page on the site draws an image
//     larger than that; the browser was downscaling anyway.
//   - WebP at quality 82. On photographic/painted content this is visually
//     indistinguishable from a JPEG at 100 and 4–8x smaller. We stay above
//     the ~70 mark where banding starts to show in gradients.
//   - One pass only, at upload. Nothing is ever re-encoded on read.
//   - Metadata (EXIF etc.) stripped — sharp's default — after `.rotate()`
//     has honoured the orientation tag, so phone photos still come out the
//     right way up.
//   - Alpha is preserved (WebP supports it), so cut-out PNGs keep working
//     as museum standees — see lib/museum/loadDownscaledTexture.ts.
//
// GIFs are deliberately passed through untouched: re-encoding would either
// drop the animation or need animated-WebP handling that isn't worth it for
// the handful that exist.
import sharp from "sharp";
import type { ImageVariant } from "./variants";

/** Longest-side caps per variant. `medium` matches the museum's own texture
 *  ceiling (MAX_TEXTURE_DIM = 1024 in loadDownscaledTexture.ts) with a
 *  little headroom; `thumb` covers a 4-across grid at 2x DPR. */
const MAX_DIM: Record<ImageVariant, number> = {
  full: 2400,
  medium: 1280,
  thumb: 640,
};

const WEBP_QUALITY = 82;

/** MIME types this module knows how to compress. Anything else (GIF, SVG,
 *  and non-images the generic restore route may pass) uploads as-is. */
const COMPRESSIBLE = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/tiff"]);

export function isCompressibleImage(mimeType: string): boolean {
  return COMPRESSIBLE.has(mimeType);
}

export interface CompressedImage {
  variants: Record<ImageVariant, Buffer>;
  /** Pixel dimensions of the `full` output, for callers that want to log
   *  or display what was actually kept. */
  width: number;
  height: number;
  beforeBytes: number;
}

/** Produces all three WebP renditions from one source image. Throws on an
 *  undecodable input — callers surface that as an ordinary upload error. */
export async function compressImage(input: Buffer | Uint8Array): Promise<CompressedImage> {
  // `.rotate()` with no args applies the EXIF orientation, which has to
  // happen *before* resize so the cap is measured on the upright image.
  // failOn: "none" keeps a slightly-corrupt-but-viewable JPEG (common from
  // phone exports) from failing the whole upload.
  const base = sharp(input, { failOn: "none" }).rotate();

  const render = (max: number) =>
    base
      .clone()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });

  const [full, medium, thumb] = await Promise.all([
    render(MAX_DIM.full),
    render(MAX_DIM.medium),
    render(MAX_DIM.thumb),
  ]);

  return {
    variants: { full: full.data, medium: medium.data, thumb: thumb.data },
    width: full.info.width,
    height: full.info.height,
    beforeBytes: input.byteLength,
  };
}
