"use client";

// CosplayStandee.tsx
//
// One cosplay in the Cosplay Room: a life-size printed standee with that
// cosplay's second photo hanging on a backdrop panel right behind it.
//
// The pair is one component, not two, because it is one thing — a standee in
// front of a picture. Drawing them together is what lets a single
// MuseumRoomCosplay placement move both (see that model's doc comment), and
// what keeps the gap between them fixed at the value standeePlacement.ts's
// perimeter walk was built around: the backdrop hangs at local -Z by exactly
// STANDEE_WALL_GAP, which is how far into the room that walk pushes the
// standee, so at a slot's default position the panel lands flat on the wall.
//
// Built procedurally rather than from a 3D asset so it works the moment a
// cosplay is published, with no modelling step — and so the *cut-out* is real
// geometry carrying that cosplay's own uploaded photo, not a generic prop. An
// admin who wants a nicer standee body can upload a .glb for the room (see
// `modelUrl`); the cut-out, its plaque and the backdrop are still drawn here on
// top of it, since those are per-cosplay and can't live in a shared model.
//
// Whether that cut-out is a rectangle or a real silhouette is decided by the
// upload itself, because the answer is already in the file. A rectangular photo
// (any JPEG, an opaque PNG) is drawn the honest way — a photo panel on a base
// with a thin white print margin, which is how a convention standee of a *photo*
// is actually printed and stood up. A PNG with an alpha channel is a figure the
// admin has already cut out, so it gets drawn as one: the backing board and its
// margin go away, the transparent pixels are discarded rather than painted, and
// what stands on the base is the shape of the character with the room — and the
// backdrop photo hanging behind — visible straight through the gaps. Painting
// those pixels instead put a black rectangle around every cut-out upload and hid
// the backdrop the room is built around, which is exactly what an admin who took
// the trouble to export a transparent PNG did not ask for.
//
// The alpha probe lives in loadDownscaledTexture.ts (see `hasAlpha`) rather than
// being guessed from the file extension: plenty of PNGs are fully opaque, and
// stripping the board off a rectangular photo would leave it floating.
//
// Texture loading goes through the same downscale+cache path as the wall frames
// (lib/museum/loadDownscaledTexture.ts) and is gated on `shouldLoad` for the
// same reason: a room of twelve cosplays would otherwise fetch twenty-four
// full-size photos on page load, before the visitor has taken a step.
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { loadDownscaledTexture, FULL_CONTENT_BOX } from "@/lib/museum/loadDownscaledTexture";
import { CustomSceneObject } from "./CustomSceneObject";
import { tiledClone, useSurfaceTexture } from "./MuseumRoom";
import { TEXTURE_TILE_METERS, INTERACT_GLOW_COLOR, FALLBACK_ASPECT } from "./roomConstants";
import { STANDEE_WALL_GAP } from "./standeePlacement";
import { BillboardLights } from "./BillboardLights";
import { BannerPanel, BANNER_TEXT_Z } from "./BannerPanel";
import {
  defaultRoomBannerStyle,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import { FloodLights } from "./FloodLights";
import {
  DEFAULT_STANDEE_CUTOUT_HEIGHT,
  DEFAULT_BACKDROP_WIDTH,
  DEFAULT_BACKDROP_HEIGHT,
  DEFAULT_COSPLAY_STANDEE_CONFIG,
  type LightsAnimation,
  type LightsStyle,
} from "@/lib/museum/cosplayStandee";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
/** The base the cut-out stands on — a shallow plinth, wide enough front-to-back
 *  that a life-size print reads as actually able to stand up. */
const BASE_W = 0.78;
const BASE_D = 0.46;
const BASE_H = 0.07;

/** How wide the cut-out is drawn when its photo's real aspect ratio hasn't
 *  resolved yet — a portrait guess, since a standee is a standing figure and
 *  every cosplay shot meant for one is taller than it is wide. Replaced by the
 *  real ratio the moment the texture lands, same as ArtworkFrame does. */
const CUTOUT_FALLBACK_ASPECT = 1 / FALLBACK_ASPECT;

/** Widest the cut-out is allowed to get, whatever its photo's ratio. A
 *  landscape group shot would otherwise be drawn three metres across and swamp
 *  its neighbours — the height is what a standee is sized by, so an unusually
 *  wide photo loses width rather than gaining it. */
const CUTOUT_MAX_WIDTH = 1.4;

/** The white print margin around the photo, and the thin backing board behind
 *  it — what makes the cut-out read as a printed board rather than a floating
 *  image. Both are dropped for a transparent PNG, which is already a shape and
 *  wants no rectangle around it (see the file header). */
const PRINT_MARGIN = 0.035;
const BOARD_DEPTH = 0.03;

/** Alpha at or above this is printed; below it is cut away. A hard threshold
 *  rather than blended transparency on purpose: a discarded fragment still
 *  writes depth, so the standee sorts against the backdrop panel and the room
 *  from every angle with no draw-order tuning — the usual trade for a cut-out,
 *  and the reason a real one has a crisp edge too. */
const CUTOUT_ALPHA_TEST = 0.5;

/** The strut holding the board up from behind, as a real standee has. Drawn
 *  from the base back and up, so it is visible from the side without ever
 *  poking through the photo. */
const STRUT_W = 0.09;
const STRUT_DEPTH = 0.028;

const BOARD_EDGE_COLOR = "#e8e2d6";
const BASE_COLOR = "#8b7f6b";
const BASE_TOP_COLOR = "#9c8f79";

// Plaque at the standee's foot — the same idea and the same sizing trick as
// StoryPodium.tsx's: drei's Text can't be measured before it lays out, so the
// backing plate is sized from the string's length. A small over-estimate just
// makes the plate slightly wide; an under-estimate would clip the name.
//
// It reads as a museum wall label rather than just a name tag, because the
// Cosplays module's Edit Details form has more to say than a character's name
// and every field of it used to stop at the [E] panel — an admin who filled in
// the event, the year and the credits saw none of it standing in the room, and
// reasonably read that as the edit not having taken. So the plate now grows a
// line at a time as those fields are filled: character, what they're from,
// where and when it was shot, and who wore and shot it. Only the description
// stays behind [E]: it's prose, and a paragraph rendered as 3D text at a
// standee's ankles is unreadable at any size that would fit.
const PLAQUE_PAD_X = 0.13;
/** Breathing room above the first line and below the last. */
const PLAQUE_PAD_Y = 0.042;
/** Gap between one line's box and the next. */
const PLAQUE_LINE_GAP = 0.02;
const PLAQUE_MAX_CHARS = 24;
const PLAQUE_SUB_MAX_CHARS = 30;
const PLAQUE_META_MAX_CHARS = 30;
const PLAQUE_CREDIT_MAX_CHARS = 36;
// The plaque's raised edge used to be a fixed 0.03 here. It is now
// RoomBannerStyle.edgeThickness, defaulted to that same 0.03 for this room
// (see defaultRoomBannerStyle) so nothing already standing changes.

/** Blend `hex` toward `toward` by `amount` (0–1), returning a hex string.
 *
 * The plaque's sub-lines are dimmed versions of its title colour so an admin
 * recolouring the label keeps its hierarchy with one picker instead of four.
 * Mixing toward the *panel* rather than to black matters: on a light panel,
 * darkening a light title would make the small lines the highest-contrast
 * thing on the plate, which is backwards. A transparent material would have
 * been simpler and wrong — it lets the panel show through the glyphs and
 * muddies them at this size. */
function mixHex(hex: string, toward: string, amount: number): string {
  const parse = (value: string) => {
    const clean = value.replace("#", "");
    if (clean.length !== 6) return null;
    const n = parseInt(clean, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null;
  };
  const a = parse(hex);
  const b = parse(toward);
  // A malformed colour keeps the line legible rather than rendering nothing.
  if (!a || !b) return hex;
  const t = Math.min(1, Math.max(0, amount));
  const out = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** One line of the plaque. `charW` is that line's average glyph advance as a
 *  share of its own font size — the plate's width comes from it, since drei's
 *  Text can't be measured up front (see the block comment above). Uppercase
 *  lines carry a wider factor because caps genuinely are wider. */
interface PlaqueLine {
  key: string;
  text: string;
  size: number;
  color: string;
  font: string;
  charW: number;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** What one standee needs to draw itself — the museum's trimmed cosplay
 *  payload, deliberately not the whole row (see MuseumCosplay in types). */
export interface StandeeCosplay {
  id: string;
  title: string;
  character: string | null;
  series: string | null;
  standeeImageUrl: string;
  backdropImageUrl: string | null;
  /** Plaque-only, and the reason this interface isn't just the four fields the
   *  geometry needs — see the plaque block comment above. */
  year: number | null;
  event: string | null;
  cosplayer: string | null;
  photographer: string | null;
}

export function CosplayStandee({
  cosplay,
  position,
  rotationY,
  scale = 1,
  active = false,
  shouldLoad = true,
  modelUrl,
  cutoutHeight,
  textureUrl,
  backdropEnabled = DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEnabled,
  backdropWidth = DEFAULT_BACKDROP_WIDTH,
  backdropHeight = DEFAULT_BACKDROP_HEIGHT,
  backdropFrameColor = DEFAULT_COSPLAY_STANDEE_CONFIG.backdropFrameColor,
  backdropEdgeColor = DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEdgeColor,
  backdropEdgeThickness = DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEdgeThickness,
  banner = defaultRoomBannerStyle("COSPLAY"),
  backdropDistance = STANDEE_WALL_GAP,
  lightsEnabled = false,
  lightsStyle = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsStyle,
  lightsColor = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsColor,
  lightsIntensity = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsIntensity,
  lightsBulbSize = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsBulbSize,
  lightsSpacing = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsSpacing,
  lightsAnimation = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsAnimation,
  lightsSpeed = DEFAULT_COSPLAY_STANDEE_CONFIG.lightsSpeed,
  floodCount = DEFAULT_COSPLAY_STANDEE_CONFIG.floodCount,
  floodBeamHeight = DEFAULT_COSPLAY_STANDEE_CONFIG.floodBeamHeight,
  floodBeamSpread = DEFAULT_COSPLAY_STANDEE_CONFIG.floodBeamSpread,
}: {
  cosplay: StandeeCosplay;
  /** Room-local, already offset by the room's own floor Y by the parent. */
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  /** True when this is the standee the visitor is close enough to open — same
   *  meaning as ArtworkFrame's `active`, and shown the same way (the warm
   *  INTERACT_GLOW_COLOR the whole museum uses for "you can press [E] here"). */
  active?: boolean;
  /** Perf gate — see the file header. */
  shouldLoad?: boolean;
  /** Optional admin-uploaded standee body (.glb) replacing the procedural one.
   *  Room-wide, not per cosplay: the photo on it is what varies. */
  modelUrl?: string | null;
  /** Where the cut-out's centre sits when `modelUrl` is used — a model's own
   *  height can't be known here without reading its bounding box, so it's an
   *  admin setting instead. See lib/museum/cosplayStandee.ts. */
  cutoutHeight?: number;
  /** Optional tiled surface image for the procedural base — same upload and
   *  same world-unit tiling as a room's wall/floor/ceiling. Ignored when
   *  `modelUrl` is set: that model brings its own materials. */
  textureUrl?: string | null;
  /** The backdrop panel behind this standee — room-wide settings, so every
   *  cosplay's photo hangs the same size. See lib/museum/cosplayStandee.ts. */
  backdropEnabled?: boolean;
  backdropWidth?: number;
  backdropHeight?: number;
  backdropFrameColor?: string;
  /** Outer border behind the frame — the Banner plaque's raised-edge look.
   *  Always drawn; matching backdropFrameColor is how you don't have one. */
  backdropEdgeColor?: string;
  backdropEdgeThickness?: number;
  /**
   * The foot plaque's look — now the room-wide banner style every other room's
   * plaques also read (lib/museum/roomBanner.ts), rather than five plaque-only
   * keys of its own. Same knobs it always had plus the surface/glass/shimmer/
   * brightness the shared panel brings; see RoomBannerStyle.textColor for why
   * the sub-lines still derive from the title colour instead of each being
   * separately settable.
   */
  banner?: RoomBannerStyle;
  /** How far behind the standee the panel hangs. Defaults to the full
   *  STANDEE_WALL_GAP, which is what an auto slot is placed for; a standee the
   *  admin dragged nearer its wall passes the shorter distance
   *  standeePlacement.ts's backdropDistance() works out, so the panel can't end
   *  up inside the wall. */
  backdropDistance?: number;
  /** This standee's own switch (MuseumRoomCosplay.lightsEnabled) — per-cosplay,
   *  unlike every other prop here, because *which* standees are lit is the
   *  point of the feature. See the schema's doc comment. */
  lightsEnabled?: boolean;
  /** Which fixture a lit standee gets — the marquee bulbs that ring its
   *  backdrop, or floodlights standing at its feet. Room-wide, like
   *  everything below. See lib/museum/cosplayStandee.ts. */
  lightsStyle?: LightsStyle;
  /** How the bulbs look — room-wide, like the backdrop/plaque settings above.
   *  See lib/museum/cosplayStandee.ts. */
  lightsColor?: string;
  lightsIntensity?: number;
  lightsBulbSize?: number;
  lightsSpacing?: number;
  lightsAnimation?: LightsAnimation;
  lightsSpeed?: number;
  /** Floodlight rig — ignored by the marquee style. */
  floodCount?: number;
  floodBeamHeight?: number;
  floodBeamSpread?: number;
}) {
  const [cutout, setCutout] = useState<THREE.Texture | null>(null);
  const [cutoutAspect, setCutoutAspect] = useState(CUTOUT_FALLBACK_ASPECT);
  const [backdrop, setBackdrop] = useState<THREE.Texture | null>(null);
  // Whether the standee photo is a cut-out figure or a rectangular photo — see
  // the file header. False until the texture lands, so the plain board is what
  // renders in the meantime; a silhouette can't be drawn before there is
  // anything to be a silhouette of.
  const [silhouette, setSilhouette] = useState(false);
  // Where the figure sits inside its own frame — see the loader's contentBox.
  // The whole frame until proven otherwise, which is the truth for a photo.
  const [contentBox, setContentBox] = useState(FULL_CONTENT_BOX);

  // The base's own surface, loaded and tiled exactly the way a room's
  // wall/floor/ceiling is (see MuseumRoom's useSurfaceTexture/tiledClone) — one
  // shared, cached image, cloned per surface so each carries its own repeat
  // without stomping the others. Only fetched when there's no .glb body to
  // override it.
  const surfaceTex = useSurfaceTexture(modelUrl ? null : textureUrl ?? null, shouldLoad);
  const baseTex = useMemo(
    () => tiledClone(surfaceTex, BASE_W / TEXTURE_TILE_METERS, BASE_D / TEXTURE_TILE_METERS),
    [surfaceTex]
  );

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(cosplay.standeeImageUrl)
      .then((loaded) => {
        if (cancelled) return;
        setCutout(loaded.texture);
        setSilhouette(loaded.hasAlpha);
        setContentBox(loaded.contentBox);
        // A zero/NaN aspect from a broken decode would collapse the board to
        // nothing — keep the portrait fallback in that case.
        if (Number.isFinite(loaded.aspect) && loaded.aspect > 0) setCutoutAspect(loaded.aspect);
      })
      .catch(() => {
        // Leave the blank board up — a failed texture shouldn't crash the scene
        // or leave an empty spot on the floor.
      });
    return () => {
      cancelled = true;
    };
  }, [cosplay.standeeImageUrl, shouldLoad]);

  const backdropUrl = backdropEnabled ? cosplay.backdropImageUrl : null;
  useEffect(() => {
    if (!shouldLoad || !backdropUrl) return;
    let cancelled = false;
    loadDownscaledTexture(backdropUrl)
      .then((loaded) => {
        if (!cancelled) setBackdrop(loaded.texture);
      })
      .catch(() => {
        // The empty panel still hangs there — see the cut-out's own catch.
      });
    return () => {
      cancelled = true;
    };
  }, [backdropUrl, shouldLoad]);

  // Height is what a standee is sized by; width follows the photo's real ratio,
  // capped so an unusually wide shot doesn't swamp the room (see
  // CUTOUT_MAX_WIDTH). A .glb body puts the cut-out wherever the admin says its
  // top surface is; the built-in one stands it on its own base.
  const printHeight = modelUrl
    ? cutoutHeight ?? DEFAULT_STANDEE_CUTOUT_HEIGHT
    : DEFAULT_STANDEE_CUTOUT_HEIGHT;
  // Hitting the width cap shortens the print rather than squeezing it: the plane
  // stretches whatever texture it is given to fill itself, so capping width
  // alone drew an unusually wide photo horizontally compressed — a visibly
  // narrowed cosplayer, at a size that matched neither the upload nor the
  // board. Losing height instead keeps the photo's own proportions, which is
  // the point of reading its aspect ratio at all.
  //
  // `printHeight` describes the *figure*, not the file it arrived in. On a
  // silhouette that's the content box's share of the frame, so the plane it is
  // drawn on is scaled up by however much empty space the export left around
  // it — otherwise a cut-out with 4% padding top and bottom renders 8% short of
  // the life-size height the room asked for, which is the whole point of the
  // setting. An opaque photo's box is the full frame, so this is a no-op there.
  const frameH = printHeight / contentBox.h;
  const uncappedW = frameH * cutoutAspect;
  // The cap is on the figure's own width, again not the file's — padding
  // shouldn't count toward "too wide" any more than it counts toward height.
  const capScale = Math.min(1, CUTOUT_MAX_WIDTH / (uncappedW * contentBox.w));
  const cutoutW = uncappedW * capScale;
  const cutoutH = frameH * capScale;
  // A cut-out PNG is its own outline — a margin around it would be a rectangle
  // drawn back on, which is the thing it was exported to avoid.
  const boardW = silhouette ? cutoutW : cutoutW + PRINT_MARGIN * 2;
  const boardH = silhouette ? cutoutH : cutoutH + PRINT_MARGIN * 2;
  // Where the print stands. On the built-in standee that's the top of its base;
  // on an uploaded model it's `cutoutHeight`, the model's own top surface —
  // same convention as the Stories podium's bookHeight.
  const footY = modelUrl ? cutoutHeight ?? DEFAULT_STANDEE_CUTOUT_HEIGHT : BASE_H;
  // A board rests on that line. A silhouette instead puts the *figure's feet*
  // on it and lets its empty rows hang below — otherwise a cut-out exported
  // with padding stands visibly off its own plinth, by more the larger the
  // standee is scaled. Solving for the plane centre that lands the content
  // box's bottom edge on footY: a normalised y (from the top of the frame)
  // sits at centre + height * (0.5 - ny).
  const boardCenterY = silhouette
    ? footY - cutoutH * (0.5 - (contentBox.y + contentBox.h))
    : footY + boardH / 2;

  // Which fixture this standee's lights are, once. The two styles are drawn in
  // completely different places — the marquee rings the panel behind, the
  // floodlights stand on the floor in front — so they can't share a branch,
  // only the switch that turns either on.
  const marqueeLit = lightsEnabled && lightsStyle === "marquee";
  const floodLit = lightsEnabled && lightsStyle === "floodlight";
  /** The print's own width, which is what a flood rig is sized and spread to.
   *  A cut-out's board is its silhouette, so the figure's width is the honest
   *  answer for both. */
  const printWidth = silhouette ? cutoutW : boardW;

  // The plaque reads as a museum label: the character on top, what they're
  // from under it, then where/when, then the credits. Every line but the first
  // appears only when that field is actually filled in, so a cosplay entered
  // with nothing but a photo and a name still gets the compact two-line plate
  // it always had — the plate grows to fit what the admin typed rather than
  // reserving space for what they didn't.
  // Local aliases: the plaque's line-building below predates the shared style
  // and reads better in these terms than as four `banner.` lookups repeated
  // through a forty-line memo.
  const plaquePanelColor = banner.panelColor;
  const plaqueTextColor = banner.textColor;
  const plaqueFontFamily = banner.fontFamily;
  const plaqueFontScale = banner.fontScale;

  const plaqueLines = useMemo<PlaqueLine[]>(() => {
    const lines: PlaqueLine[] = [
      {
        key: "title",
        // Falls back to the cosplay's own title when no character is set, so a
        // standee is never unlabelled.
        text: truncate(cosplay.character || cosplay.title, PLAQUE_MAX_CHARS),
        size: 0.085 * plaqueFontScale,
        color: plaqueTextColor,
        font: plaqueFontFamily,
        charW: 0.63,
      },
    ];
    if (cosplay.series) {
      lines.push({
        key: "series",
        text: truncate(cosplay.series, PLAQUE_SUB_MAX_CHARS).toUpperCase(),
        size: 0.048 * plaqueFontScale,
        // Dimmed from the title rather than its own setting — see
        // CosplayStandeeConfig.plaqueTextColor. Opacity on the material would
        // let the panel show through and muddy it, so this is a real colour
        // mixed toward the panel behind it.
        color: mixHex(plaqueTextColor, plaquePanelColor, 0.3),
        font: FONT_REGULAR,
        charW: 0.72,
      });
    }
    // Where and when, in the order a caption reads them. Joined rather than
    // given a line each: they're one fact about the shot, and two more lines
    // would push the plate up over the print's feet for no gain.
    const meta = [cosplay.event, cosplay.year ? String(cosplay.year) : null]
      .filter(Boolean)
      .join(" · ");
    if (meta) {
      lines.push({
        key: "meta",
        text: truncate(meta, PLAQUE_META_MAX_CHARS),
        size: 0.042 * plaqueFontScale,
        color: mixHex(plaqueTextColor, plaquePanelColor, 0.45),
        font: FONT_REGULAR,
        charW: 0.63,
      });
    }
    // Labelled, unlike the two lines above — "Kyla · Rye" on its own reads as
    // two more names for the character, which is exactly the wrong thing for a
    // credit line to say.
    const credits = [
      cosplay.cosplayer && `Cosplay: ${cosplay.cosplayer}`,
      cosplay.photographer && `Photo: ${cosplay.photographer}`,
    ]
      .filter(Boolean)
      .join("   ");
    if (credits) {
      lines.push({
        key: "credits",
        text: truncate(credits, PLAQUE_CREDIT_MAX_CHARS),
        size: 0.038 * plaqueFontScale,
        color: mixHex(plaqueTextColor, plaquePanelColor, 0.55),
        font: FONT_REGULAR,
        charW: 0.63,
      });
    }
    return lines;
  }, [
    cosplay.character,
    cosplay.title,
    cosplay.series,
    cosplay.event,
    cosplay.year,
    cosplay.cosplayer,
    cosplay.photographer,
    plaqueTextColor,
    plaquePanelColor,
    plaqueFontFamily,
    plaqueFontScale,
  ]);

  const plaqueHeight =
    plaqueLines.reduce((total, line) => total + line.size, 0) +
    PLAQUE_LINE_GAP * (plaqueLines.length - 1) +
    PLAQUE_PAD_Y * 2;
  const plaqueWidth =
    Math.max(...plaqueLines.map((line) => line.text.length * line.size * line.charW)) +
    PLAQUE_PAD_X * 2;
  // Each line's own centre Y, measured down from the plate's top edge — the
  // stack is laid out here rather than with hardcoded offsets because how many
  // lines there are isn't known until the fields are read.
  const plaqueLineY = useMemo(() => {
    let cursor = plaqueHeight / 2 - PLAQUE_PAD_Y;
    return plaqueLines.map((line) => {
      const y = cursor - line.size / 2;
      cursor -= line.size + PLAQUE_LINE_GAP;
      return y;
    });
  }, [plaqueLines, plaqueHeight]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ── Backdrop panel ───────────────────────────────────────────────
          Drawn at local -Z by exactly the distance standeePlacement.ts pushes
          the standee off its wall, so at an auto slot this lands flat against
          that wall — see the file header. Only when the cosplay actually has a
          second photo: an empty frame on the wall reads as a bug, and a standee
          on its own reads as a deliberate arrangement.

          Deliberately a *sibling* of the scaled body below rather than a child
          of it. `scale` is the admin's "how big is this standee", and the panel
          is not part of the standee — it's a photo hung on the wall behind one,
          at its own room-wide size in metres. Scaling it multiplied
          STANDEE_WALL_GAP too, so a standee sized up much past 2x pushed its
          own backdrop straight through the wall it was meant to hang on and out
          of the room (at 2.45x against a side wall: 0.95m × 2.45 = 2.33m back
          from x=9.05, i.e. 1.4m outside a room whose half-width is 10) — the
          uploaded photo simply wasn't there any more. The same multiplier blew
          the panel's admin-set width/height past the ceiling. Both are settings
          in real room units, so neither belongs under a per-standee factor. */}
      {backdropEnabled && cosplay.backdropImageUrl && (
        <group position={[0, 0, -backdropDistance]}>
          {/* Outer edge — a slightly larger, slightly further-back box, so the
              frame reads as sitting *inside* a border rather than being one
              flat slab. Same construction as the Banner plaque's edge (see
              SceneBanner.tsx), and pushed back rather than merely made bigger
              so the two never z-fight when viewed edge-on.

              Deliberately not warmed by `active` the way the frame below is:
              the glow is the cue for "this is the standee you can open", and
              spreading it onto a second, larger surface makes the highlight
              read as the whole wall lighting up. */}
          {(
            <mesh position={[0, backdropHeight / 2 + 0.35, -0.045]}>
              <boxGeometry
                args={[
                  backdropWidth + 0.12 + backdropEdgeThickness * 2,
                  backdropHeight + 0.12 + backdropEdgeThickness * 2,
                  0.04,
                ]}
              />
              <meshStandardMaterial color={backdropEdgeColor} roughness={0.6} metalness={0.3} />
            </mesh>
          )}
          {/* Frame/mat — a shallow box behind the photo, so the panel has an
              edge from the side rather than being a floating plane. */}
          <mesh position={[0, backdropHeight / 2 + 0.35, -0.02]}>
            <boxGeometry args={[backdropWidth + 0.12, backdropHeight + 0.12, 0.04]} />
            <meshStandardMaterial
              // Warms up along with the standee, the same cue an artwork
              // frame's border gives — the photo behind belongs to the cosplay
              // the visitor is standing at, and lighting only one of the pair
              // would read as two separate things.
              color={active ? INTERACT_GLOW_COLOR : backdropFrameColor}
              roughness={0.7}
            />
          </mesh>
          {/* The photo. Keyed on the texture's identity so a fresh material —
              and shader — is built when `map` goes from null to a texture;
              flipping .map on a mounted material doesn't recompile its shader
              on its own. Same fix ArtworkFrame.tsx documents. */}
          <mesh position={[0, backdropHeight / 2 + 0.35, 0.001]}>
            <planeGeometry args={[backdropWidth, backdropHeight]} />
            <meshStandardMaterial
              key={backdrop ? backdrop.uuid : "no-backdrop"}
              map={backdrop ?? undefined}
              color={backdrop ? "#ffffff" : "#d8d2c6"}
              roughness={0.65}
            />
          </mesh>
          {/* Billboard lights — ringing the outer edge, one step further back
              still so the bulbs read as bolted onto the frame rather than
              floating in front of the photo. Only drawn when this standee's
              own switch is on (see MuseumRoomCosplay.lightsEnabled) — a
              room-wide ring would light every cosplay, which is exactly what
              the per-standee switch exists to avoid. */}
          {marqueeLit && (
            <group position={[0, backdropHeight / 2 + 0.35, -0.05]}>
              <BillboardLights
                width={backdropWidth + 0.12 + backdropEdgeThickness * 2}
                height={backdropHeight + 0.12 + backdropEdgeThickness * 2}
                color={lightsColor}
                intensity={lightsIntensity}
                bulbSize={lightsBulbSize}
                spacing={lightsSpacing}
                animation={lightsAnimation}
                speed={lightsSpeed}
              />
            </group>
          )}
        </group>
      )}

      {/* Billboard lights around the print itself — the fallback for a
          standee lit in a room that hangs no backdrop panel (or a cosplay with
          no second photo), so the switch still does something rather than
          silently having no effect. Sits just outside the print board, in the
          same scaled group as the standee body so it grows and shrinks with
          it. */}
      {marqueeLit && !(backdropEnabled && cosplay.backdropImageUrl) && (
        <group position={[0, boardCenterY * scale, 0.01]}>
          <BillboardLights
            width={printWidth * scale + 0.1}
            height={(silhouette ? cutoutH : boardH) * scale + 0.1}
            color={lightsColor}
            intensity={lightsIntensity}
            bulbSize={lightsBulbSize}
            spacing={lightsSpacing}
            animation={lightsAnimation}
            speed={lightsSpeed}
          />
        </group>
      )}

      {/* Everything a visitor reads as "the standee" — body, print and plaque
          — is what `scale` sizes, and all of it sits on the floor at this
          group's own origin, so scaling it moves nothing off its spot. */}
      <group scale={[scale, scale, scale]}>
        {/* ── Floodlights ────────────────────────────────────────────────
            Inside the scaled group, unlike the marquee ring: this rig stands
            on the floor at the standee's own feet and is aimed at its print,
            so it has to grow with the standee or a scaled-up cosplay would be
            lit from the knees down by fixtures sized for a smaller one. That
            is the opposite of the backdrop panel's reasoning (a photo hung on
            a wall at its own size in metres), and the difference is exactly
            whether the thing belongs to the standee or to the room. */}
        {floodLit && (
          <FloodLights
            width={printWidth}
            color={lightsColor}
            intensity={lightsIntensity}
            animation={lightsAnimation}
            speed={lightsSpeed}
            count={floodCount}
            beamHeight={floodBeamHeight}
            beamSpread={floodBeamSpread}
          />
        )}

        {/* ── The standee body ───────────────────────────────────────────── */}
        {modelUrl ? (
          <CustomSceneObject url={modelUrl} />
        ) : (
          <>
            <mesh position={[0, BASE_H / 2, 0]} castShadow={false}>
              <boxGeometry args={[BASE_W, BASE_H, BASE_D]} />
              {/* Keyed on the texture's identity for the same reason the photos
                  above are. */}
              <meshStandardMaterial
                key={baseTex ? baseTex.uuid : "plain"}
                map={baseTex ?? undefined}
                color={baseTex ? "#ffffff" : active ? INTERACT_GLOW_COLOR : BASE_COLOR}
                roughness={0.85}
              />
            </mesh>
            {/* Back strut — behind the board, angled nowhere (a straight prop is
                enough to read as one), so it never intrudes on the photo. */}
            <mesh position={[0, BASE_H + boardH * 0.32, -BOARD_DEPTH / 2 - STRUT_DEPTH / 2]}>
              <boxGeometry args={[STRUT_W, boardH * 0.64, STRUT_DEPTH]} />
              <meshStandardMaterial color={BASE_TOP_COLOR} roughness={0.8} />
            </mesh>
          </>
        )}

        {/* ── The printed cut-out ────────────────────────────────────────── */}
        <group position={[0, boardCenterY, 0]}>
          {/* Backing board — the print's white margin plus its own thickness.
              Skipped entirely for a cut-out upload: a board behind a silhouette
              is a rectangle showing through every gap in it, which is the same
              wrong picture as painting the transparent pixels. */}
          {!silhouette && (
            <mesh>
              <boxGeometry args={[boardW, boardH, BOARD_DEPTH]} />
              <meshStandardMaterial
                color={active ? INTERACT_GLOW_COLOR : BOARD_EDGE_COLOR}
                roughness={0.75}
              />
            </mesh>
          )}
          {/* The photo itself, on the front face — or, with no board under it,
              standing on its own. */}
          <mesh position={[0, 0, silhouette ? 0 : BOARD_DEPTH / 2 + 0.002]}>
            <planeGeometry args={[cutoutW, cutoutH]} />
            <meshStandardMaterial
              // Keyed on the silhouette flag as well as the texture: alphaTest
              // and side are compile-time defines in three's shader, so a
              // material that has already built its program won't pick them up
              // when the probe result arrives a frame later. A fresh material
              // gets a fresh shader.
              key={`${cutout ? cutout.uuid : "no-cutout"}-${silhouette}`}
              map={cutout ?? undefined}
              color={cutout ? "#ffffff" : "#cfc7b8"}
              roughness={0.65}
              // Transparent pixels are discarded, not painted — the room and
              // the backdrop photo show through the shape. See the file header.
              transparent={silhouette}
              alphaTest={silhouette ? CUTOUT_ALPHA_TEST : 0}
              // A cut-out has no board behind it to hide its back, and a
              // visitor can walk right round a standee out on the floor. Real
              // convention cut-outs are printed one side and read mirrored from
              // behind, which is exactly what this does.
              side={silhouette ? THREE.DoubleSide : THREE.FrontSide}
            />
          </mesh>
        </group>

        {/* ── Plaque ─────────────────────────────────────────────────────
            At the foot rather than on the board: the print is the subject, and
            a label across a costume shot would cover the thing a visitor walked
            over to look at. */}
        <group position={[0, BASE_H + plaqueHeight / 2 + 0.02, BASE_D / 2 + 0.01]}>
          <BannerPanel
            width={plaqueWidth}
            height={plaqueHeight}
            style={banner}
            active={shouldLoad}
          >
            {plaqueLines.map((line, i) => (
              <Text
                key={line.key}
                position={[0, plaqueLineY[i], BANNER_TEXT_Z]}
                fontSize={line.size}
                color={line.color}
                anchorX="center"
                anchorY="middle"
                font={line.font}
              >
                {line.text}
              </Text>
            ))}
          </BannerPanel>
        </group>
      </group>
    </group>
  );
}

/** Radius a visitor is kept out of (see PlayerControls' `obstacles`). Half the
 *  base's width — the widest part of the standee — so the collider matches what
 *  is actually visible rather than a guess. An uploaded .glb body reuses this:
 *  a per-model collider would need its bounding box, and the print on top is
 *  drawn at the same scale either way. The backdrop panel deliberately gets no
 *  collider: it hangs on a wall the visitor already can't walk through, and at
 *  an admin-dragged spot out in the room it is a flat panel a visitor may as
 *  well brush past. */
export const STANDEE_COLLIDER_RADIUS = BASE_W / 2;
