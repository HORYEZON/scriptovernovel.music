"use client";

// ArcadePoster.tsx
//
// The Arcade Room's alternative to ArcadeCabinet — a framed game poster on a
// slim stand, for admins who'd rather the room read as a gallery of games than
// a physical arcade. Chosen per-game (or room-wide) in the Museum Scene Editor;
// see lib/museum/arcadeConfig.ts.
//
// Same procedural + downscaled-texture + `shouldLoad` conventions as
// ArcadeCabinet / StoryPodium.
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import type { ArcadeCabinetDisplay } from "./ArcadeCabinet";
import { BannerPanel, BANNER_TEXT_Z } from "./BannerPanel";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  mixBannerHex,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";

// The caption's title face now comes from the room's banner style; the
// subtitle under it keeps a fixed regular face (see RoomBannerStyle.fontFamily).
const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
const POSTER_W = 1.0;
const POSTER_H = 1.4;
const FRAME_BORDER = 0.06;
const CENTER_Y = 1.5; // poster centre height off the floor
const POST_W = 0.08;

/** Half-footprint of the stand — a poster is thin, so this is small. */
export const POSTER_COLLIDER_RADIUS = 0.3;

const FRAME_COLOR = "#3a3126";

const TITLE_MAX_CHARS = 30;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function ArcadePoster({
  game,
  position,
  rotationY,
  scale = 1,
  active = false,
  shouldLoad = true,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  game: ArcadeCabinetDisplay;
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  active?: boolean;
  shouldLoad?: boolean;
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
}) {
  const [art, setArt] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!shouldLoad || !game.imageUrl) return;
    let cancelled = false;
    loadDownscaledTexture(game.imageUrl)
      .then((loaded) => {
        if (!cancelled) setArt(loaded.texture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [game.imageUrl, shouldLoad]);

  const title = useMemo(() => truncate(game.title, TITLE_MAX_CHARS), [game.title]);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      {/* Stand */}
      <mesh position={[0, (CENTER_Y - POSTER_H / 2) / 2, 0]}>
        <boxGeometry args={[POST_W, CENTER_Y - POSTER_H / 2, POST_W]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.36]} />
        <meshStandardMaterial color={FRAME_COLOR} roughness={0.8} />
      </mesh>

      {/* Frame + poster face */}
      <group position={[0, CENTER_Y, 0]}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[POSTER_W + FRAME_BORDER * 2, POSTER_H + FRAME_BORDER * 2]} />
          <meshStandardMaterial
            color={active ? "#c8a96e" : FRAME_COLOR}
            roughness={0.6}
            metalness={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[POSTER_W, POSTER_H]} />
          <meshStandardMaterial
            key={art ? art.uuid : "no-art"}
            map={art ?? undefined}
            color={art ? "#ffffff" : "#1c1830"}
            emissiveMap={art ?? undefined}
            emissive={art ? "#ffffff" : "#000000"}
            emissiveIntensity={active ? 0.4 : 0.22}
            roughness={0.5}
          />
        </mesh>

        {/* Caption strip along the bottom — the room's shared plaque style
            (lib/museum/roomBanner.ts), so a poster's caption and a cabinet's
            marquee are one design rather than the two different browns/purples
            they used to be. */}
        <group position={[0, -POSTER_H / 2 + 0.14, 0.004]}>
          <BannerPanel width={POSTER_W} height={0.28} style={banner} active={shouldLoad}>
            <Text
              position={[0, 0.04, BANNER_TEXT_Z]}
              fontSize={0.082 * banner.fontScale}
              maxWidth={POSTER_W - 0.1}
              textAlign="center"
              color={banner.textColor}
              anchorX="center"
              anchorY="middle"
              font={banner.fontFamily}
            >
              {title}
            </Text>
            <Text
              position={[0, -0.07, BANNER_TEXT_Z]}
              fontSize={0.05 * banner.fontScale}
              color={mixBannerHex(banner.textColor, banner.panelColor, 0.35)}
              anchorX="center"
              anchorY="middle"
              font={FONT_REGULAR}
            >
              {game.subtitle.toUpperCase()}
            </Text>
          </BannerPanel>
        </group>
      </group>
    </group>
  );
}
