// lib/minigames/images.ts
//
// The games slice one artwork across many tiles, so they need the image as a
// CSS background rather than a <next/image> element — background-image can be
// offset and scaled per tile in a way an <img> cannot.
//
// Originally, CSS backgrounds pointed at /_next/image to keep the Vercel image
// optimizer in the loop. next.config.ts now has `images.unoptimized: true`
// (Vercel free tier only allows 5,000 transformations/month, and the quota was
// exhausted). Because that flag only bypasses the optimizer for <Image>
// components — not for hand-built /_next/image URLs — optimizedImageUrl() now
// returns the raw Supabase CDN URL instead. Supabase handles caching on its
// own, so the games still load quickly. Restore the optimizer call inside
// optimizedImageUrl() when the plan is upgraded.

/** Widths Next's optimizer will actually serve (its default size lists). */
export type OptimizedWidth = 384 | 640 | 828 | 1080;

/** Big enough to stay crisp on a retina phone, small enough to load fast. */
export const GAME_BOARD_WIDTH: OptimizedWidth = 828;
export const GAME_THUMB_WIDTH: OptimizedWidth = 384;

export function optimizedImageUrl(
  url: string,
  width: OptimizedWidth = GAME_BOARD_WIDTH,
  quality = 70
): string {
  if (!url) return "";
  // next.config.ts sets `images.unoptimized: true` to avoid burning Vercel's
  // free-tier image-transformation quota (5,000/month). That flag only applies
  // to <Image> components, not to /_next/image URLs constructed by hand — so
  // we must mirror the same behaviour here: return the raw URL and let the
  // browser fetch it directly from the CDN (Supabase handles caching anyway).
  // When the plan is upgraded, remove this comment and restore the line below:
  //   return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
  void width;
  void quality;
  return url;
}

export interface TileStyleOptions {
  /** Width ÷ height of the source artwork. */
  imageRatio: number;
  /**
   * Width ÷ height of the whole board. Usually equal to imageRatio, so the
   * artwork is shown complete; Rotate & Solve passes 1 because a tile has to
   * be square to survive a 90° turn, and the artwork is fit into that square
   * instead (see `fit`).
   */
  boardRatio: number;
  width?: OptimizedWidth;
  /**
   * How the artwork fills a board whose ratio doesn't match its own.
   * "cover" (default) scales it up to fill the board, cropping whatever
   * overflows — what every game with a matching board ratio wants, since
   * there's nothing to crop. Rotate & Solve's board is forced to 1:1, so it
   * asks for "contain" instead: shrink the artwork to fit inside the square
   * whole, letterboxed, rather than cropping it down to a sliver.
   */
  fit?: "cover" | "contain";
}

/**
 * CSS for one cell of a `size × size` slice of `url`.
 *
 * The naive version of this — background-size N00%, background-position
 * col/(size-1) — silently stretches any artwork whose proportions differ from
 * the board's, which is most of them. So the image is instead scaled to
 * *cover* (or, for a forced-square board, *contain*) the board — the same
 * rule `object-fit` follows — and each tile offsets into that shared,
 * consistently-scaled rectangle.
 *
 * background-position percentages are relative to (container − image), which
 * is what the divisor below is: at 0% the two left edges meet, at 100% the two
 * right edges do. That holds whether the image is larger than its tile slice
 * (cover) or smaller (contain, in the letterboxed border tiles) — CSS
 * resolves the percentage the same way either side of zero. When imageRatio
 * equals boardRatio this reduces exactly to the naive formula.
 */
export function tileBackgroundStyle(
  url: string,
  index: number,
  size: number,
  options: TileStyleOptions
): React.CSSProperties {
  const { imageRatio, boardRatio, width = GAME_BOARD_WIDTH, fit = "cover" } = options;
  const row = Math.floor(index / size);
  const col = index % size;

  // Normalised board: height 1, width boardRatio. `scale` is the image's
  // height in that space (its width is then safeImageRatio * scale) — cover
  // takes the larger of the two axis scales so the image fills the board,
  // contain takes the smaller so the whole image fits inside it.
  const safeImageRatio = imageRatio > 0 ? imageRatio : boardRatio;
  const axisScale = boardRatio / safeImageRatio;
  const scale = fit === "contain" ? Math.min(1, axisScale) : Math.max(1, axisScale);
  const displayWidth = safeImageRatio * scale;
  const displayHeight = scale;

  const tileWidth = boardRatio / size;
  const tileHeight = 1 / size;

  const spanX = displayWidth - tileWidth;
  const spanY = displayHeight - tileHeight;

  // The centring term is what throws away the overflowing edges evenly
  // (cover) or splits the letterbox margin evenly (contain), rather than
  // always favouring one edge of the artwork.
  const offsetX = (displayWidth - boardRatio) / 2 + col * tileWidth;
  const offsetY = (displayHeight - 1) / 2 + row * tileHeight;

  return {
    backgroundImage: `url("${optimizedImageUrl(url, width)}")`,
    backgroundSize: `${(displayWidth / tileWidth) * 100}% ${(displayHeight / tileHeight) * 100}%`,
    backgroundPosition:
      Math.abs(spanX) < 1e-6 || Math.abs(spanY) < 1e-6
        ? "center"
        : `${(offsetX / spanX) * 100}% ${(offsetY / spanY) * 100}%`,
    backgroundRepeat: "no-repeat",
  };
}
