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
import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { FRAME_WALL_OFFSET, ROOM_HEIGHT, ROOM_WIDTH } from "./roomConstants";

const FONT_DISPLAY = "/fonts/DMSans-Regular.woff";

export interface LyricsWallProps {
  wall: "north" | "east" | "west";
  depth: number;
  textColor: string;
  glowColor: string;
  /** The line to show now — null when idle. */
  currentLine: string | null;
  previousLine?: string | null;
  nextLine?: string | null;
  /** 0–1: how lit the glow is (follows the deck's reverb/lo-fi amounts). */
  glow?: number;
  idleText?: string;
  /** Title/track label shown small under the current line. */
  caption?: string | null;
}

const PANEL_BOTTOM = 1.15;
const PANEL_TOP = ROOM_HEIGHT - 0.55;

export function LyricsWall({
  wall,
  depth,
  textColor,
  glowColor,
  currentLine,
  previousLine = null,
  nextLine = null,
  glow = 0.3,
  idleText = "Put a record on.",
  caption = null,
}: LyricsWallProps) {
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
  const glowColorObj = useMemo(() => new THREE.Color(glowColor), [glowColor]);
  const active = Boolean(currentLine);
  const mainSize = Math.min(0.42, (width / Math.max(12, (currentLine ?? idleText).length)) * 1.1);

  return (
    <group position={position} rotation={[0, rotationY, 0]} name="lyrics-wall">
      {/* Glass */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#08080a"
          roughness={0.25}
          metalness={0.1}
          emissive={glowColorObj}
          emissiveIntensity={active ? 0.06 + glow * 0.22 : 0.03}
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Frame line */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.08, height + 0.08]} />
        <meshStandardMaterial color={glowColor} emissive={glowColorObj} emissiveIntensity={active ? 0.5 + glow : 0.15} roughness={0.5} />
      </mesh>

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
          font={FONT_DISPLAY}
        >
          {previousLine}
        </Text>
      )}
      <Text
        position={[0, active ? 0.02 : 0, 0.012]}
        fontSize={active ? mainSize : 0.3}
        maxWidth={width * 0.9}
        color={active ? textColor : "#9a9184"}
        anchorX="center"
        anchorY="middle"
        textAlign="center"
        font={FONT_DISPLAY}
        outlineWidth={active ? mainSize * 0.04 : 0}
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
          font={FONT_DISPLAY}
        >
          {nextLine}
        </Text>
      )}
      {caption && (
        <Text
          position={[0, -height / 2 + 0.22, 0.01]}
          fontSize={0.13}
          color={glowColor}
          anchorX="center"
          anchorY="middle"
          font={FONT_DISPLAY}
          letterSpacing={0.2}
        >
          {caption.toUpperCase()}
        </Text>
      )}
    </group>
  );
}
