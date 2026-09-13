"use client";

// StoryPodium.tsx
//
// One story, standing on one podium in the Stories Room. This is the piece
// that makes the room different from every other room in the museum: its
// contents sit on the floor and are read, rather than hanging on a wall and
// being looked at.
//
// Built procedurally rather than from a 3D asset so it works the moment a
// story is published, with no modelling step — and so the *book* is real
// geometry whose cover is that story's own uploaded coverImageUrl, not a
// generic prop. An admin who wants a nicer pedestal can upload a .glb for
// the room (see `modelUrl`); the book and its cover are still drawn here on
// top of it, since those are per-story and can't live in a shared model.
//
// Texture loading goes through the same downscale+cache path as the wall
// frames (lib/museum/loadDownscaledTexture.ts) and is gated on `shouldLoad`
// for the same reason: a library of twenty books would otherwise fetch twenty
// full-size covers on page load, before the visitor has taken a step.
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import { storyTypeLabel } from "@/lib/stories";
import { CustomSceneObject } from "./CustomSceneObject";
import { tiledClone, useSurfaceTexture } from "./MuseumRoom";
import { TEXTURE_TILE_METERS } from "./roomConstants";
import { BannerPanel, BANNER_TEXT_Z } from "./BannerPanel";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  mixBannerHex,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";

// The title's face now comes from the room's banner style; only the type line
// under it still uses a fixed regular face (see RoomBannerStyle.fontFamily).
const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
// Sized against EYE_HEIGHT (1.7): the book's face lands around chest height,
// so a standing visitor looks slightly down at it the way they would at a
// real display case.
const PLINTH_W = 0.7;
const PLINTH_H = 0.09;
const COLUMN_W = 0.36;
const COLUMN_H = 0.94;
const TOP_W = 0.66;
const TOP_H = 0.07;

/** Total height of the procedural pedestal — where the book sits. */
export const PODIUM_HEIGHT = PLINTH_H + COLUMN_H + TOP_H;

/** Radius a visitor is kept out of (see PlayerControls' `obstacles`). Half
 *  the plinth's width — the widest part of the pedestal — so the collider
 *  matches what's actually visible rather than a guess. An uploaded .glb
 *  pedestal reuses this: a per-model collider would need its bounding box,
 *  and the book on top is drawn at the same scale either way. */
export const PODIUM_COLLIDER_RADIUS = PLINTH_W / 2;

const BOOK_W = 0.32;
const BOOK_H = 0.44;
const BOOK_D = 0.06;
/** Tilt of the reading stand — enough to face a standing visitor without the
 *  book looking like it would slide off. */
const BOOK_TILT = -Math.PI / 9; // 20°

const PAPER_COLOR = "#f2ece0";
const BOOK_EDGE_COLOR = "#3a3126";

// Plaque under the book — same idea and the same sizing trick as
// ServicesRoomContents.tsx's PriceTag: drei's Text can't be measured before
// it lays out, so the backing plate is sized from the string's length. A
// small over-estimate just makes the plate slightly wide; an under-estimate
// would clip the title.
const PLAQUE_H = 0.22;
const PLAQUE_PAD_X = 0.14;
const PLAQUE_CHAR_W = 0.062;
const PLAQUE_FONT_SIZE = 0.098;
const PLAQUE_MAX_CHARS = 26;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface PodiumStory {
  id: string;
  title: string;
  type: string;
  coverImageUrl: string;
}

export function StoryPodium({
  story,
  position,
  rotationY,
  scale = 1,
  active = false,
  shouldLoad = true,
  modelUrl,
  bookHeight,
  textureUrl,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  story: PodiumStory;
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  /** Room-local, already offset by the room's own floor Y by the parent. */
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  /** True when this is the podium the visitor is close enough to open — same
   *  meaning as ArtworkFrame's `active`, and shown the same way (a warm
   *  highlight rather than an outline). */
  active?: boolean;
  /** Perf gate — see the file header. */
  shouldLoad?: boolean;
  /** Optional admin-uploaded pedestal (.glb) replacing the procedural one.
   *  Room-wide, not per story: the book on top is what varies. */
  modelUrl?: string | null;
  /** How high the book sits when `modelUrl` is used — a model's own height
   *  can't be known here without reading its bounding box, so it's an admin
   *  setting instead. Ignored for the procedural pedestal. */
  bookHeight?: number;
  /** Optional tiled surface image for the procedural pedestal — same upload
   *  and same world-unit tiling as a room's wall/floor/ceiling, so a podium
   *  finished in the floor's material reads as one surface. Ignored when
   *  `modelUrl` is set: that model brings its own materials. */
  textureUrl?: string | null;
}) {
  const [cover, setCover] = useState<THREE.Texture | null>(null);

  // The pedestal's own surface, loaded and tiled exactly the way a room's
  // wall/floor/ceiling is (see MuseumRoom's useSurfaceTexture/tiledClone) —
  // one shared, cached image, cloned per surface so each carries its own
  // repeat without stomping the others. Only fetched when there's no .glb
  // pedestal to override it.
  const surfaceTex = useSurfaceTexture(modelUrl ? null : textureUrl ?? null, shouldLoad);
  const plinthTex = useMemo(
    () => tiledClone(surfaceTex, PLINTH_W / TEXTURE_TILE_METERS, PLINTH_H / TEXTURE_TILE_METERS),
    [surfaceTex]
  );
  const columnTex = useMemo(
    () => tiledClone(surfaceTex, COLUMN_W / TEXTURE_TILE_METERS, COLUMN_H / TEXTURE_TILE_METERS),
    [surfaceTex]
  );
  const topTex = useMemo(
    () => tiledClone(surfaceTex, TOP_W / TEXTURE_TILE_METERS, TOP_H / TEXTURE_TILE_METERS),
    [surfaceTex]
  );

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(story.coverImageUrl)
      .then((loaded) => {
        if (!cancelled) setCover(loaded.texture);
      })
      .catch(() => {
        // Leave the blank cover up — a failed texture shouldn't crash the
        // scene or leave an empty podium.
      });
    return () => {
      cancelled = true;
    };
  }, [story.coverImageUrl, shouldLoad]);

  const bookY = modelUrl ? bookHeight ?? PODIUM_HEIGHT : PODIUM_HEIGHT;

  const plaqueText = useMemo(
    () => truncate(story.title, PLAQUE_MAX_CHARS),
    [story.title]
  );
  // Scaled with the type so a title set larger gets a plate that still fits
  // it, rather than one it overflows.
  const plaqueWidth = plaqueText.length * PLAQUE_CHAR_W * banner.fontScale + PLAQUE_PAD_X * 2;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      {/* ── Pedestal ─────────────────────────────────────────────────── */}
      {modelUrl ? (
        <CustomSceneObject url={modelUrl} />
      ) : (
        <>
          <mesh position={[0, PLINTH_H / 2, 0]} castShadow={false}>
            <boxGeometry args={[PLINTH_W, PLINTH_H, PLINTH_W]} />
            {/* Keyed on the texture's identity so a fresh material — and
                shader — is built when `map` goes from null to a texture, the
                same reason the cover below is keyed. */}
            <meshStandardMaterial
              key={plinthTex ? plinthTex.uuid : "plain"}
              map={plinthTex ?? undefined}
              color={plinthTex ? "#ffffff" : "#8b7f6b"}
              roughness={0.85}
            />
          </mesh>
          <mesh position={[0, PLINTH_H + COLUMN_H / 2, 0]}>
            <boxGeometry args={[COLUMN_W, COLUMN_H, COLUMN_W]} />
            <meshStandardMaterial
              key={columnTex ? columnTex.uuid : "plain"}
              map={columnTex ?? undefined}
              color={columnTex ? "#ffffff" : "#9c8f79"}
              roughness={0.8}
            />
          </mesh>
          <mesh position={[0, PLINTH_H + COLUMN_H + TOP_H / 2, 0]}>
            <boxGeometry args={[TOP_W, TOP_H, TOP_W]} />
            <meshStandardMaterial
              key={topTex ? topTex.uuid : "plain"}
              map={topTex ?? undefined}
              // Warms up when the visitor is in range — the podium's own
              // version of ArtworkFrame's active border, readable from the
              // aisle without needing an outline pass. Tinted rather than
              // replaced when a texture is set, so the cue survives it.
              color={active ? "#c8a96e" : topTex ? "#ffffff" : "#8b7f6b"}
              roughness={0.75}
            />
          </mesh>
        </>
      )}

      {/* ── The book ─────────────────────────────────────────────────── */}
      <group position={[0, bookY, 0]} rotation={[BOOK_TILT, 0, 0]}>
        {/* Page block. The cover is a separate plane in front of this rather
            than a sixth material on the box: one texture that can arrive
            late, without rebuilding a material array, and the three visible
            page edges stay paper-coloured. */}
        <mesh position={[0, BOOK_H / 2, 0]}>
          <boxGeometry args={[BOOK_W, BOOK_H, BOOK_D]} />
          <meshStandardMaterial color={PAPER_COLOR} roughness={0.95} />
        </mesh>

        {/* Spine — a darker sliver down the binding edge so the block reads as
            a book rather than a paper brick from the side. */}
        <mesh position={[-BOOK_W / 2 - 0.004, BOOK_H / 2, 0]}>
          <boxGeometry args={[0.012, BOOK_H, BOOK_D + 0.004]} />
          <meshStandardMaterial color={BOOK_EDGE_COLOR} roughness={0.7} />
        </mesh>

        {/* Cover. Keyed on the texture's identity so a fresh material — and
            shader — is built when `map` goes from null to a texture; flipping
            .map on a mounted material doesn't recompile its shader on its
            own. Same fix ArtworkFrame.tsx documents. */}
        <mesh position={[0, BOOK_H / 2, BOOK_D / 2 + 0.002]}>
          <planeGeometry args={[BOOK_W, BOOK_H]} />
          <meshStandardMaterial
            key={cover ? cover.uuid : "no-cover"}
            map={cover ?? undefined}
            color={cover ? "#ffffff" : PAPER_COLOR}
            roughness={0.7}
          />
        </mesh>
      </group>

      {/* ── Plaque ─────────────────────────────────────────────────────
          Painted from the room's shared plaque style (lib/museum/roomBanner
          .ts), whose defaults are the colours this was hardcoded to. The type
          line under the title is derived from the title colour rather than
          separately settable — see RoomBannerStyle.textColor. */}
      <group position={[0, PLINTH_H + COLUMN_H * 0.62, COLUMN_W / 2 + 0.006]}>
        <BannerPanel
          width={plaqueWidth}
          height={PLAQUE_H * banner.fontScale}
          style={banner}
          active={shouldLoad}
        >
          <Text
            position={[0, 0.028 * banner.fontScale, BANNER_TEXT_Z]}
            fontSize={PLAQUE_FONT_SIZE * banner.fontScale}
            color={banner.textColor}
            anchorX="center"
            anchorY="middle"
            font={banner.fontFamily}
          >
            {plaqueText}
          </Text>
          <Text
            position={[0, -0.055 * banner.fontScale, BANNER_TEXT_Z]}
            fontSize={0.055 * banner.fontScale}
            color={mixBannerHex(banner.textColor, banner.panelColor, 0.35)}
            anchorX="center"
            anchorY="middle"
            font={FONT_REGULAR}
          >
            {storyTypeLabel(story.type).toUpperCase()}
          </Text>
        </BannerPanel>
      </group>
    </group>
  );
}
