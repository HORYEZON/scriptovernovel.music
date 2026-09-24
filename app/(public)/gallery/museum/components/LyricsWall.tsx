"use client";

// LyricsWall.tsx
//
// The Vinyl Room's second feature: one wide dark-glass panel on a wall that
// projects the playing record's lyrics a line at a time — the current line
// large, the one before and after smaller and dimmer. Text is drei's <Text>
// (troika), the same as the arcade cabinets' marquees. Which line is "now"
// is lib/museum/lyricsTimeline.ts's proportional guess; the deck (MuseumScene)
// feeds it the line index so this component never touches the audio.
//
// Idle (no record on the deck, or one with no lyrics) it shows a single
// invitation instead of going blank — a dark rectangle on a wall reads as
// broken. Hidden entirely when the room's config turns the wall off.
//
// The panel itself is BannerPanel.tsx — the same surface every plaque in the
// museum is drawn on — so the wall gets the uploaded texture, the glass mode,
// the shimmer, the raised edge and the brightness without a second frosted
// panel existing in the codebase. What this file keeps for itself is the part
// a plaque has no equivalent of: the halo that rides on the deck's effect
// amounts, and the three-line lyric layout.
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { BannerPanel } from "./BannerPanel";
import { UploadedWallVideo, YouTubeWallVideo } from "./LyricsWallVideo";
import { FRAME_WALL_OFFSET, ROOM_HEIGHT, ROOM_WIDTH } from "./roomConstants";
import { DEFAULT_LYRICS_WALL, type LyricsWallConfig } from "@/lib/museum/vinylConfig";

export interface LyricsWallProps {
  wall: "north" | "east" | "west";
  depth: number;
  /** The admin's panel + type settings. Defaults keep the look the wall
   *  shipped with, so a caller mid-refactor can omit it. */
  style?: LyricsWallConfig;
  /** The line to show now — null when idle. */
  currentLine: string | null;
  previousLine?: string | null;
  nextLine?: string | null;
  /** 0–1: how lit the glow is (follows the deck's reverb/lo-fi amounts). */
  glow?: number;
  idleText?: string;
  /** Title/track label shown small under the current line. */
  caption?: string | null;
  /** False while the room is too far away to be drawn — stops the shimmer's
   *  per-frame work and skips loading a texture nobody can see. */
  active?: boolean;
}

const PANEL_BOTTOM = 1.15;
const PANEL_TOP = ROOM_HEIGHT - 0.55;

export function LyricsWall({
  wall,
  depth,
  style = DEFAULT_LYRICS_WALL,
  currentLine,
  previousLine = null,
  nextLine = null,
  glow = 0.3,
  idleText = "Put a record on.",
  caption = null,
  active = true,
}: LyricsWallProps) {
  const { textColor, glowColor, fontFamily, fontScale } = style;
  // Where the panel sits: flush on the chosen wall, pushed FRAME_WALL_OFFSET
  // into the room like every wall hanging.
  const { position, rotationY, width } = useMemo(() => {
    const halfW = ROOM_WIDTH / 2;
    const halfD = depth / 2;
    const y = (PANEL_BOTTOM + PANEL_TOP) / 2;
    if (wall === "east") {
      return { position: [halfW - FRAME_WALL_OFFSET, y, 0] as [number, number, number], rotationY: -Math.PI / 2, width: depth * 0.7 };
    }
    if (wall === "west") {
      return { position: [-halfW + FRAME_WALL_OFFSET, y, 0] as [number, number, number], rotationY: Math.PI / 2, width: depth * 0.7 };
    }
    return { position: [0, y, -halfD + FRAME_WALL_OFFSET] as [number, number, number], rotationY: 0, width: ROOM_WIDTH * 0.7 };
  }, [wall, depth]);

  const height = PANEL_TOP - PANEL_BOTTOM;
  const playing = Boolean(currentLine);
  // Fit-to-width first, then the admin's multiplier — that order is what keeps
  // a long lyric on the panel at any scale, instead of letting 200% push a
  // twelve-word line off both edges.
  const mainSize =
    Math.min(0.42, (width / Math.max(12, (currentLine ?? idleText).length)) * 1.1) * fontScale;

  return (
    <group position={position} rotation={[0, rotationY, 0]} name="lyrics-wall">
      <BannerPanel width={width} height={height} style={style} active={active}>
        {/* The admin's video, under everything but the panel itself — see
            LyricsWallVideo.tsx for why the two sources render so differently. */}
        {style.videoSource === "upload" && style.videoUrl && (
          <UploadedWallVideo
            url={style.videoUrl}
            width={width}
            height={height}
            brightness={style.videoBrightness}
            muted={style.videoMuted}
          />
        )}
        {style.videoSource === "youtube" && style.videoYoutubeUrl && active && (
          <YouTubeWallVideo
            url={style.videoYoutubeUrl}
            width={width}
            height={height}
            brightness={style.videoBrightness}
            muted={style.videoMuted}
          />
        )}

        {/* The halo the deck drives, as an additive wash over whatever finish
            the panel is wearing. It was the panel's own emissive before this;
            a separate plane is what lets an uploaded texture or a glass mode
            keep its look while the wall still answers to the music. Behind the
            type (BannerShimmer sits at z 0.004, the lines at 0.01+) so it lights
            the surface rather than veiling the words. */}
        {glow > 0 && (
          <mesh position={[0, 0, 0.005]} renderOrder={1}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={playing ? 0.06 + glow * 0.14 : 0.03}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}

        {previousLine && (
          <Text
            position={[0, height * 0.28, 0.01]}
            fontSize={mainSize * 0.55}
            maxWidth={width * 0.9}
            color={textColor}
            fillOpacity={0.35}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            font={fontFamily}
          >
            {previousLine}
          </Text>
        )}
        <Text
          position={[0, playing ? 0.02 : 0, 0.012]}
          fontSize={playing ? mainSize : 0.3 * fontScale}
          maxWidth={width * 0.9}
          color={playing ? textColor : "#9a9184"}
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          font={fontFamily}
          outlineWidth={playing ? mainSize * 0.04 : 0}
          outlineColor={glowColor}
          outlineOpacity={0.35 + glow * 0.4}
        >
          {currentLine ?? idleText}
        </Text>
        {nextLine && (
          <Text
            position={[0, -height * 0.28, 0.01]}
            fontSize={mainSize * 0.55}
            maxWidth={width * 0.9}
            color={textColor}
            fillOpacity={0.35}
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            font={fontFamily}
          >
            {nextLine}
          </Text>
        )}
        {caption && (
          <Text
            position={[0, -height / 2 + 0.22, 0.01]}
            fontSize={0.13 * fontScale}
            color={glowColor}
            anchorX="center"
            anchorY="middle"
            font={fontFamily}
            letterSpacing={0.2}
          >
            {caption.toUpperCase()}
          </Text>
        )}
      </BannerPanel>
    </group>
  );
}
