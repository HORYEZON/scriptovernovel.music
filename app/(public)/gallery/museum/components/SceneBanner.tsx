"use client";

// app/(public)/gallery/museum/components/SceneBanner.tsx
//
// Draws a titled plaque: a coloured backing panel with a raised edge, an
// optional small spaced-out eyebrow line, and a title.
//
// One component, two callers, on purpose:
//
//   • **Banner** (kind "banner", lib/museum/sceneBanner.ts) — the admin adds
//     these from the Museum Scene Editor's Add Banner, types the text, picks
//     the colours, and drags them wherever a room needs a sign.
//   • **The Freedom Wall's event plaque** (kind "freedom-wall-banner", see
//     lib/museum/freedomWallBanner.ts) — auto-provisioned, one per Freedom
//     Wall room, its title mirroring whichever event is active and its eyebrow
//     fixed to "FREEDOM WALL".
//
// The plaque came first and the banner is it made general (see
// sceneBanner.ts's header for what had to change). Keeping one renderer means
// the two can never drift apart visually while sitting in the same museum —
// and the Freedom Wall's plaque is now three lines calling this rather than
// eighty lines of its own geometry.
//
// Note what is *not* shared: the config. "A caption the admin typed" and "the
// name of the currently active event" are different data with different
// lifetimes, so each caller keeps its own and hands this component the
// resolved strings and colours.

import { Text } from "@react-three/drei";
import { BANNER_EYEBROW_MAX_CHARS, BANNER_MAX_CHARS } from "@/lib/museum/sceneBanner";
import { BannerPanel } from "./BannerPanel";
import type { BannerFinish } from "@/lib/museum/roomBanner";

/** The eyebrow's font — fixed rather than following the title's admin-chosen
 *  face. It renders at 0.085 world units, where a decorative display font is
 *  simply unreadable, and it reads as a label rather than as a voice. */
const FONT_BOLD = "/fonts/DMSans-Bold.woff";
const EYEBROW_SIZE = 0.085;

/** How far the text floats in front of the panel. Tiny: the planes are
 *  coplanar in spirit, and the offset exists only to give the depth buffer an
 *  unambiguous order. Without it the text z-fights the panel and the plaque
 *  flickers as the camera moves. */
const TEXT_Z = 0.008;

export function SceneBanner({
  text,
  eyebrow,
  width,
  height,
  finish,
  textColor,
  fontFamily,
  fontSize,
  position,
  rotationY = 0,
  active = true,
}: {
  text: string;
  /** Empty or omitted draws no eyebrow, and the title centres in the plaque
   *  instead of sitting below where one would have been. */
  eyebrow?: string;
  width: number;
  height: number;
  /**
   * The surface this is painted on — panel colour, edge, an uploaded image,
   * glass, shimmer, brightness. Drawn by BannerPanel, the same component the
   * rooms' built-in labels use, rather than by two planes of this component's
   * own: a sign an admin placed should be able to wear the finishes a price
   * tag can, and two hand-rolled frosted panels in one museum is exactly the
   * drift this file's header warns about.
   */
  finish: BannerFinish;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  position: [number, number, number];
  rotationY?: number;
  /** False while the room is too far off to be drawn — pauses the shimmer and
   *  skips fetching a panel image nobody can see. */
  active?: boolean;
}) {
  // Truncated at render rather than on input, so pasting a long line degrades
  // to an ellipsis instead of silently discarding what was typed — the admin
  // can still see what they pasted in the editor's field and shorten it.
  const label =
    text.length > BANNER_MAX_CHARS ? `${text.slice(0, BANNER_MAX_CHARS - 1)}…` : text;
  const eyebrowLabel = eyebrow
    ? eyebrow.length > BANNER_EYEBROW_MAX_CHARS
      ? `${eyebrow.slice(0, BANNER_EYEBROW_MAX_CHARS - 1)}…`
      : eyebrow
    : "";

  // With an eyebrow the two lines sit above and below centre; without one the
  // title owns the whole panel. Proportional to the plaque's height so a tall
  // banner spreads its lines rather than clustering them in the middle.
  const eyebrowY = height * 0.28;
  const titleY = eyebrowLabel ? -height * 0.1 : 0;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <BannerPanel width={width} height={height} style={finish} active={active}>
        {eyebrowLabel && (
          <Text
            position={[0, eyebrowY, TEXT_Z]}
            fontSize={EYEBROW_SIZE}
            letterSpacing={0.28}
            // The eyebrow has always taken the edge's colour — it is trim,
            // read as part of the frame rather than as a second title.
            color={finish.edgeColor}
            anchorX="center"
            anchorY="middle"
            font={FONT_BOLD}
          >
            {eyebrowLabel}
          </Text>
        )}

        <Text
          position={[0, titleY, TEXT_Z]}
          fontSize={fontSize}
          maxWidth={width - 0.4}
          textAlign="center"
          color={textColor}
          anchorX="center"
          anchorY="middle"
          font={fontFamily}
        >
          {label}
        </Text>
      </BannerPanel>
    </group>
  );
}
