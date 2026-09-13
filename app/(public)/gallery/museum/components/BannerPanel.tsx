"use client";

// BannerPanel.tsx
//
// The one panel every room's plaque is drawn on — the render half of
// lib/museum/roomBanner.ts.
//
// Five rooms each had their own hand-rolled version of the same two planes: a
// slightly larger one behind for the raised edge, a smaller one in front for
// the panel, text laid on top by the caller. They were identical apart from the
// literal colours, which is exactly why an admin could theme a room's walls and
// end up with labels that still belonged to the old palette.
//
// This draws that pair from a shared RoomBannerStyle, and adds the three things
// none of them had: an uploaded surface image, a frosted-glass mode, and a
// shimmer riding across the glass.
//
// The *text* stays with the caller. A price tag is one line, a story plaque is
// two, a cosplay plaque is four with a hierarchy — that layout is the one part
// of these plaques that genuinely differs per room, so this component sizes and
// paints the surface and leaves what goes on it alone. Callers put their <Text>
// in front of it at a small +Z, exactly as they already did.

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  type BannerFinish,
} from "@/lib/museum/roomBanner";

/** How far in front of the panel a caller's first text line should sit. Shared
 *  so five callers can't each pick a slightly different epsilon and get
 *  different z-fighting behaviour on the same GPU. */
export const BANNER_TEXT_Z = 0.006;

// The About room's Bio & Skills plaque, whose frosted look this reuses.
// Duplicated as plain numbers rather than imported: AboutRoomContents.tsx is a
// large "use client" module and importing it here would drag the whole About
// room into every room that draws a price tag.
const GLASS_ROUGHNESS = 0.08;
const SOLID_ROUGHNESS = 0.7;
const EDGE_ROUGHNESS = 0.6;
const EDGE_METALNESS = 0.3;

/**
 * Brightness as a colour multiply.
 *
 * three multiplies a material's `map` by its `color`, so one mechanism covers
 * both cases: a textured panel starts from white (the image as uploaded, tinted
 * by the admin's panel colour) and a painted one starts from the panel colour
 * itself. Scaling that colour is therefore the whole implementation — no second
 * light, no emissive, nothing that would also wash the text in front of it.
 */
function scaledColor(hex: string, brightness: number): THREE.Color {
  const color = new THREE.Color(hex);
  color.multiplyScalar(brightness);
  return color;
}

/**
 * The raised edge, as a rectangular *ring* rather than a larger backing plane.
 *
 * Both look identical behind a solid panel — the panel covers the middle
 * either way — but a full plane is opaque, and a glass panel in front of one
 * shows that plane's colour rather than the room. "Glassmorphism on" then
 * looked like nothing had happened on any plaque with an edge, which is the
 * opposite of what the toggle is for: glass is meant to show what is behind
 * the panel. A ring leaves the middle genuinely empty, so it does.
 */
function edgeRingShape(width: number, height: number, thickness: number): THREE.Shape {
  const outerW = width + thickness * 2;
  const outerH = height + thickness * 2;
  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, -outerH / 2);
  shape.lineTo(outerW / 2, outerH / 2);
  shape.lineTo(-outerW / 2, outerH / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-width / 2, -height / 2);
  hole.lineTo(width / 2, -height / 2);
  hole.lineTo(width / 2, height / 2);
  hole.lineTo(-width / 2, height / 2);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

/** The uploaded surface image, or null while it loads / when there isn't one.
 *  Goes through the same downscale+cache path as every other museum texture. */
function useBannerTexture(url: string | null, enabled: boolean) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url || !enabled) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    loadDownscaledTexture(url)
      .then((loaded) => {
        if (cancelled) return;
        // Stretched to the panel, not tiled — see RoomBannerStyle.textureUrl
        // for why a plaque is finished rather than surfaced.
        loaded.texture.wrapS = THREE.ClampToEdgeWrapping;
        loaded.texture.wrapT = THREE.ClampToEdgeWrapping;
        setTexture(loaded.texture);
      })
      .catch(() => {
        // A dead URL leaves the panel painted in its colour, which is the
        // same thing it looked like before the upload — never a blank plaque.
        if (!cancelled) setTexture(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return texture;
}

// --- Shimmer ---------------------------------------------------------------
// A soft band of light travelling across the panel, lifted from the About
// room's own plaque shimmer and generalised to any size.
//
// Drawn as one extra plane the exact size of the panel carrying a repeating 1D
// gradient, animated by scrolling that texture's offset. Doing it in the
// texture rather than by sliding a narrow highlight mesh is what keeps the band
// clipped to the panel for free — a moving mesh would need masking at both
// edges and would slide out over the wall behind on every pass.
const SHIMMER_TEX_WIDTH = 128;
/** Band half-width as a fraction of the panel — wide enough to read as a sheen
 *  crossing the surface rather than a stripe wiping over it. */
const SHIMMER_BAND = 0.1;

function BannerShimmer({
  width,
  height,
  speed,
  strength,
  active,
}: {
  width: number;
  height: number;
  speed: number;
  strength: number;
  /** False while the room is too far away to be drawn — no reason to scroll a
   *  texture nobody is looking at. */
  active: boolean;
}) {
  const texture = useMemo(() => {
    const data = new Uint8Array(SHIMMER_TEX_WIDTH * 4);
    for (let i = 0; i < SHIMMER_TEX_WIDTH; i++) {
      // Gaussian falloff around the middle of the strip, so tiling it leaves
      // one soft band with flat dark space either side of it.
      const t = i / SHIMMER_TEX_WIDTH - 0.5;
      const a = Math.exp(-(t * t) / (2 * SHIMMER_BAND * SHIMMER_BAND));
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = Math.round(a * 255);
    }
    const tex = new THREE.DataTexture(data, SHIMMER_TEX_WIDTH, 1, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Freeing it matters: a DataTexture holds a GPU allocation that outlives the
  // component unless it's disposed.
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (!active || speed <= 0) return;
    // Wall-clock driven rather than delta-accumulated so every plaque in a room
    // sweeps in step — twelve pedestals shimmering out of phase reads as noise,
    // not as one room lit the same way.
    texture.offset.x = -((performance.now() / 1000) * speed) % 1;
  });

  if (speed <= 0 || strength <= 0) return null;

  return (
    <mesh position={[0, 0, 0.004]} renderOrder={1}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={strength}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function BannerPanel({
  width,
  height,
  style = DEFAULT_ROOM_BANNER_STYLE,
  active = true,
  highlightColor = null,
  children,
}: {
  /** Panel size in metres. The edge is drawn outside this, so a caller sizes
   *  the panel to its text and never has to account for the trim. */
  width: number;
  height: number;
  /** Just the finish — a RoomBannerStyle satisfies this, and so does an
   *  individual Banner's own (see sceneBanner.ts's bannerFinish). The type on
   *  it belongs to the caller, which draws the text. */
  style?: BannerFinish;
  /** False when the room isn't near enough to be drawn — stops the shimmer's
   *  per-frame work and skips loading a texture nobody can see. */
  active?: boolean;
  /**
   * A colour to light the panel with while the visitor is standing at whatever
   * this labels — the Arcade marquee's "this is the cabinet you can play" cue.
   *
   * Overrides the admin's panel colour for as long as it is set, and takes an
   * emissive of the same colour so it reads as switched on rather than merely
   * repainted. Deliberately not something the banner style carries: it is an
   * interaction state, not a finish, and a room's plaques are not all
   * highlightable. Null on every plaque that has no such state.
   */
  highlightColor?: string | null;
  /** The caller's text lines, drawn in front of the panel. */
  children?: React.ReactNode;
}) {
  const texture = useBannerTexture(style.textureUrl, active);

  // A textured panel starts from white so the image arrives as uploaded, and
  // the admin's panel colour becomes a tint on it; an untextured one is simply
  // painted. Brightness scales whichever of the two is in play.
  const panelColor = useMemo(
    () => scaledColor(texture ? "#ffffff" : style.panelColor, style.brightness),
    [texture, style.panelColor, style.brightness]
  );
  const edgeColor = useMemo(() => new THREE.Color(style.edgeColor), [style.edgeColor]);
  const edgeShape = useMemo(
    () => edgeRingShape(width, height, style.edgeThickness),
    [width, height, style.edgeThickness]
  );
  // The tint a texture gets, kept separate from `panelColor` above so an
  // uploaded image isn't washed to white: three multiplies map × color, and
  // multiplying by white would leave the admin's panel colour doing nothing.
  const tint = useMemo(
    () => scaledColor(style.panelColor, style.brightness),
    [style.panelColor, style.brightness]
  );

  const glass = style.glassEnabled;
  // Shimmer is glass-only — on a solid painted panel a travelling highlight
  // reads as a rendering fault rather than as light on a surface.
  const shimmering = glass && style.shimmerEnabled;

  return (
    <group>
      {/* Raised edge — a ring of trim around the panel, pushed slightly back so
          the two never z-fight when viewed edge-on. Skipped entirely at zero
          thickness rather than drawn at the panel's own size, which would be an
          invisible plane costing a draw call. See edgeRingShape for why this is
          a ring and not the larger backing plane it started as. */}
      {style.edgeThickness > 0 && (
        <mesh position={[0, 0, -0.004]}>
          <shapeGeometry args={[edgeShape]} />
          <meshStandardMaterial
            color={edgeColor}
            roughness={EDGE_ROUGHNESS}
            metalness={EDGE_METALNESS}
          />
        </mesh>
      )}

      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          // `map` and `color` are both set every render rather than one or the
          // other: three keeps the last map it was given if the prop simply
          // disappears, so clearing an upload has to hand it an explicit null.
          // A highlight drops the texture too — a lit marquee is the fixture
          // switching on, and showing a wood grain through that reads as the
          // panel failing to light rather than as a finish.
          map={highlightColor ? null : texture}
          color={highlightColor ?? (texture ? tint : panelColor)}
          emissive={highlightColor ?? "#000000"}
          emissiveIntensity={highlightColor ? 0.35 : 0}
          transparent={glass}
          opacity={glass ? style.glassOpacity : 1}
          roughness={glass ? GLASS_ROUGHNESS : SOLID_ROUGHNESS}
        />
      </mesh>

      {shimmering && (
        <BannerShimmer
          width={width}
          height={height}
          speed={style.shimmerSpeed}
          strength={style.shimmerStrength}
          active={active}
        />
      )}

      {children}
    </group>
  );
}
