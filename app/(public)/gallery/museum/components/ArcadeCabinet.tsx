"use client";

// ArcadeCabinet.tsx
//
// One mini game, standing on its own arcade cabinet in the Arcade Room — the
// floor-standing counterpart to StoryPodium.tsx (read that first; this follows
// the same conventions).
//
// Built procedurally rather than from a 3D asset so it works the moment a game
// is enabled, with no modelling step. The "screen" is a real plane whose
// texture is the game's own configured artwork, loaded through the same
// downscale+cache path as the wall frames (loadDownscaledTexture) and gated on
// `shouldLoad` so five cabinets don't fetch five full-size images on page load.
//
// That procedural body can be re-surfaced with a tiled image, or replaced
// outright by an admin's own .glb — one room-wide setting either way (see
// lib/museum/arcadeConfig.ts), exactly as the Stories Room's pedestal works.
// The screen and marquee are drawn on top regardless, since those are the
// per-game parts: `screenHeight`/`screenDepth` are where they land on an
// uploaded model, whose dimensions can't be known from here.
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import { CustomSceneObject } from "./CustomSceneObject";
import { tiledClone, useSurfaceTexture } from "./MuseumRoom";
import { TEXTURE_TILE_METERS } from "./roomConstants";
import { BannerPanel, BANNER_TEXT_Z } from "./BannerPanel";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  mixBannerHex,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";

// The marquee title's face now comes from the room's banner style; the
// subtitle under it keeps a fixed regular face (see RoomBannerStyle.fontFamily).
const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
// Sized against EYE_HEIGHT (1.7): the screen sits a little below eye level so
// a standing visitor looks slightly down at it, like a real upright cabinet.
const BODY_W = 0.78;
const BODY_D = 0.7;
const BODY_H = 1.6;
const SCREEN_W = 0.62;
const SCREEN_H = 0.5;
const SCREEN_Y = 1.16;
const MARQUEE_H = 0.28;

/** Radius a visitor is kept out of (see PlayerControls' `obstacles`). Half the
 *  body's width — the widest part — so the collider matches what's visible. */
export const CABINET_COLLIDER_RADIUS = BODY_W / 2;

const BODY_COLOR = "#211d2e";
const ACCENT_COLOR = "#5b21b6";
const SCREEN_OFF_COLOR = "#0a0a14";

const PLAQUE_MAX_CHARS = 22;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface ArcadeCabinetDisplay {
  /** Game name — shown on the marquee. */
  title: string;
  /** The game's configured artwork; null shows a dark screen. */
  imageUrl: string | null;
  /** Small line under the marquee, e.g. "Medium". */
  subtitle: string;
}

export function ArcadeCabinet({
  game,
  position,
  rotationY,
  scale = 1,
  active = false,
  shouldLoad = true,
  modelUrl,
  textureUrl,
  screenHeight,
  screenDepth,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  game: ArcadeCabinetDisplay;
  /** Room-local, already offset by the room's own floor Y by the parent. */
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  /** True when the visitor is close enough to press [E] — same meaning and
   *  same warm highlight as StoryPodium's `active`. */
  active?: boolean;
  shouldLoad?: boolean;
  /** The room's uploaded cabinet .glb, standing in for the procedural body.
   *  Null/absent = the built-in cabinet, which is the default. */
  modelUrl?: string | null;
  /** Tiled surface image for the *procedural* body. Ignored while `modelUrl`
   *  is set: that model brings its own materials. */
  textureUrl?: string | null;
  /** Where the screen sits on an uploaded model — ignored for the built-in
   *  cabinet, which knows its own geometry. */
  screenHeight?: number;
  screenDepth?: number;
}) {
  const [screen, setScreen] = useState<THREE.Texture | null>(null);

  // The body's own surface, loaded and tiled the way a room's wall/floor/
  // ceiling is (see MuseumRoom's useSurfaceTexture/tiledClone) — one shared,
  // cached image cloned per face so each carries its own repeat. Only fetched
  // when there's no .glb to override it.
  const surfaceTex = useSurfaceTexture(modelUrl ? null : textureUrl ?? null, shouldLoad);
  const bodyTex = useMemo(
    () => tiledClone(surfaceTex, BODY_W / TEXTURE_TILE_METERS, BODY_H / TEXTURE_TILE_METERS),
    [surfaceTex]
  );

  useEffect(() => {
    if (!shouldLoad || !game.imageUrl) return;
    let cancelled = false;
    loadDownscaledTexture(game.imageUrl)
      .then((loaded) => {
        if (!cancelled) setScreen(loaded.texture);
      })
      .catch(() => {
        // Leave the dark screen up — a failed texture shouldn't crash the scene.
      });
    return () => {
      cancelled = true;
    };
  }, [game.imageUrl, shouldLoad]);

  const marqueeText = useMemo(() => truncate(game.title, PLAQUE_MAX_CHARS), [game.title]);

  // Where the face furniture — screen, bezel, marquee — lands. The built-in
  // cabinet knows its own geometry; an uploaded model is placed by the admin's
  // two numbers instead. The marquee keeps the gap above the screen it has on
  // the built-in cabinet, so one height setting moves the whole face as a unit.
  const faceY = modelUrl ? screenHeight ?? SCREEN_Y : SCREEN_Y;
  const faceZ = modelUrl ? screenDepth ?? BODY_D / 2 : BODY_D / 2;
  const marqueeY = faceY + (BODY_H - MARQUEE_H / 2 - SCREEN_Y);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      {/* ── Body ─────────────────────────────────────────────────────── */}
      {modelUrl ? (
        <CustomSceneObject url={modelUrl} />
      ) : (
        <>
          <mesh position={[0, BODY_H / 2, 0]}>
            <boxGeometry args={[BODY_W, BODY_H, BODY_D]} />
            {/* Keyed on the texture's identity so a fresh material — and
                shader — is built when `map` goes from null to a texture, the
                same reason the screen below is keyed. */}
            <meshStandardMaterial
              key={bodyTex ? bodyTex.uuid : "plain"}
              map={bodyTex ?? undefined}
              color={bodyTex ? "#ffffff" : BODY_COLOR}
              roughness={0.7}
              metalness={0.1}
            />
          </mesh>

          {/* Side accent stripes — read as a cabinet rather than a plain box
              from an angle, and warm up when the visitor is in range. */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (BODY_W / 2 + 0.002), BODY_H * 0.55, 0]}>
              <planeGeometry args={[BODY_D * 0.9, BODY_H * 0.7]} />
              <meshStandardMaterial
                color={active ? "#c8a96e" : ACCENT_COLOR}
                roughness={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* Control-deck lip below the screen, angled toward the visitor. */}
          <mesh position={[0, 0.86, BODY_D / 2 + 0.12]} rotation={[-Math.PI / 3.2, 0, 0]}>
            <planeGeometry args={[BODY_W, 0.28]} />
            <meshStandardMaterial color="#171320" roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}

      {/* ── Screen ───────────────────────────────────────────────────── */}
      <mesh position={[0, faceY, faceZ + 0.006]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        {/* Keyed on the texture identity so a fresh material/shader is built
            when `map` goes from null to a texture — same fix ArtworkFrame /
            StoryPodium document. `emissive` makes the screen glow like a real
            display, brighter when the visitor is close. */}
        <meshStandardMaterial
          key={screen ? screen.uuid : "off"}
          map={screen ?? undefined}
          color={screen ? "#ffffff" : SCREEN_OFF_COLOR}
          emissive={screen ? "#ffffff" : "#000000"}
          emissiveMap={screen ?? undefined}
          emissiveIntensity={active ? 0.7 : 0.4}
          roughness={0.35}
        />
      </mesh>
      {/* Screen bezel */}
      <mesh position={[0, faceY, faceZ + 0.003]}>
        <planeGeometry args={[SCREEN_W + 0.06, SCREEN_H + 0.06]} />
        <meshStandardMaterial color="#000000" roughness={0.9} />
      </mesh>

      {/* ── Marquee ────────────────────────────────────────────────────
          The room's shared plaque style (lib/museum/roomBanner.ts) paints it,
          except while the visitor is standing at the cabinet — `active` lights
          it warm, which is the "this is the one you can play" cue and an
          interaction state rather than a finish, so it overrides whatever the
          admin picked for as long as it lasts. */}
      <group position={[0, marqueeY, faceZ + 0.01]}>
        <BannerPanel
          width={BODY_W}
          height={MARQUEE_H}
          style={banner}
          active={shouldLoad}
          highlightColor={active ? "#c8a96e" : null}
        >
          <Text
            position={[0, 0.03, BANNER_TEXT_Z]}
            fontSize={0.088 * banner.fontScale}
            maxWidth={BODY_W - 0.08}
            textAlign="center"
            color={banner.textColor}
            anchorX="center"
            anchorY="middle"
            font={banner.fontFamily}
          >
            {marqueeText}
          </Text>
          <Text
            position={[0, -MARQUEE_H / 2 + 0.02, BANNER_TEXT_Z]}
            fontSize={0.05 * banner.fontScale}
            color={mixBannerHex(banner.textColor, banner.panelColor, 0.3)}
            anchorX="center"
            anchorY="middle"
            font={FONT_REGULAR}
          >
            {game.subtitle.toUpperCase()}
          </Text>
        </BannerPanel>
      </group>
    </group>
  );
}
