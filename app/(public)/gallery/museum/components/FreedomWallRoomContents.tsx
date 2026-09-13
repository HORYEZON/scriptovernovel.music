"use client";

// FreedomWallRoomContents.tsx
// 3D sticky-note wall rendered inside the museum corridor.
// Each note is a flat coloured rectangle (THREE.Mesh / planeGeometry) with a
// pin dot on top and Text from @react-three/drei for nickname + content.
// Notes are laid out using their server-assigned positionX/positionY
// (0-100 %) mapped onto the room's north wall, with a random tilt (rotation)
// so the wall looks "lived-in" rather than grid-aligned.
//
// The event-title plaque (FreedomWallPlaque below) is a real, admin-movable/
// deletable MuseumSceneObject (kind: "freedom-wall-banner" — see
// lib/museum/freedomWallBanner.ts), positioned the same way a decorative
// object is (MuseumScene.tsx's bannerPlacements / MuseumEditorScene.tsx's
// EditableSceneObject) — but it is its own dedicated render, not a generic
// Text Label: its content always tracks the active FreedomWallEvent's title
// (renaming the event is the only way to change what it says), and the only
// thing admin-editable about its look is its 3 colors.
//
// Accepts the same shouldLoad gate as AboutRoomContents — textures /
// Text objects only mount when the visitor is in a nearby room.

import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import type { FreedomWallNotePublic } from "@/types";
// All the percent↔world placement math lives in a three.js-free module (see
// its own doc comment for why) so MuseumEditorClient.tsx — not dynamically
// loaded, unlike this file — can reuse it without pulling three.js/@react-
// three/* into a bundle that's supposed to stay clear of them. Re-exported
// here so existing importers of this file (MuseumEditorScene.tsx included)
// don't need two import lines for "the note's math" vs "the note's mesh".
import {
  FRAME_CENTER_Y,
  WALL_USABLE_H,
  resolveNoteWallSegment,
  notePercentToWorld,
  noteFreeValueToPercentX,
  noteWorldYToPercentY,
} from "@/lib/museum/freedomWallNotePlacement";
import type { NoteWallId, NoteWallGeometry } from "@/lib/museum/freedomWallNotePlacement";
import type { BannerColors } from "@/lib/museum/freedomWallBanner";
import { FRAME_WALL_OFFSET, ROOM_WIDTH } from "./roomConstants";
import { SceneBanner } from "./SceneBanner";
import { solidBannerFinish } from "@/lib/museum/sceneBanner";

export {
  WALL_USABLE_H,
  resolveNoteWallSegment,
  notePercentToWorld,
  noteFreeValueToPercentX,
  noteWorldYToPercentY,
};
export type { NoteWallId, NoteWallGeometry };

// ── Layout constants ────────────────────────────────────────────────────────

// Note card dimensions in world units.
const NOTE_W       = 0.72;
const NOTE_H       = 0.82;
const NOTE_DEPTH   = 0.01;
const PIN_R        = 0.045;
const FONT_REGULAR = "/fonts/DMSans-Regular.woff";
const FONT_BOLD    = "/fonts/DMSans-Bold.woff";

// Wall-surface Z offset (same convention as ArtworkFrame/AboutRoomContents)
const WALL_Z       = FRAME_WALL_OFFSET;

// ── Colour palette ──────────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, { body: string; border: string; pin: string; text: string }> = {
  yellow: { body: "#fef08a", border: "#ca8a04", pin: "#a16207", text: "#713f12" },
  pink:   { body: "#fbcfe8", border: "#db2777", pin: "#9d174d", text: "#831843" },
  blue:   { body: "#bae6fd", border: "#0284c7", pin: "#075985", text: "#0c4a6e" },
  green:  { body: "#a7f3d0", border: "#059669", pin: "#065f46", text: "#064e3b" },
  purple: { body: "#ddd6fe", border: "#7c3aed", pin: "#5b21b6", text: "#4c1d95" },
  orange: { body: "#fed7aa", border: "#ea580c", pin: "#c2410c", text: "#7c2d12" },
};
const FALLBACK_COLOR = NOTE_COLORS.yellow;

// ── Single sticky-note mesh ──────────────────────────────────────────────────

export function StickyNote3D({
  note,
  position,
  rotationY = 0,
  scale = 1,
}: {
  note: FreedomWallNotePublic;
  position: [number, number, number];
  /** Which way the note faces — the wall it's pinned to's own rotationY
   *  (see resolveNoteWallSegment/notePercentToWorld), 0 = facing +Z (north
   *  wall's own orientation, the only one that ever existed before notes
   *  could be pinned to other walls). */
  rotationY?: number;
  /** Uniform size multiplier (FreedomWallNotePublic.scale) — applied as a
   *  wrapping group scale, same technique ArtworkFrame's own `scale` prop
   *  uses, so nothing below has to know its geometry might be resized. */
  scale?: number;
}) {
  const pal  = NOTE_COLORS[note.color] ?? FALLBACK_COLOR;
  const rotY = rotationY;
  const rotZ = (note.rotation * Math.PI) / 180; // tilt in radians

  // Truncate long content so it fits inside the card without overflow.
  const displayContent =
    note.content.length > 80 ? `${note.content.slice(0, 77)}…` : note.content;
  const displayNickname =
    note.nickname.length > 18 ? `${note.nickname.slice(0, 16)}…` : note.nickname;

  const bodyColor   = useMemo(() => new THREE.Color(pal.body),   [pal.body]);
  const borderColor = useMemo(() => new THREE.Color(pal.border), [pal.border]);
  const pinColor    = useMemo(() => new THREE.Color(pal.pin),    [pal.pin]);

  return (
    <group position={position} rotation={[0, rotY, rotZ]} scale={scale}>
      {/* Coloured border backing (slightly larger than body) */}
      <mesh position={[0, 0, -NOTE_DEPTH]}>
        <planeGeometry args={[NOTE_W + 0.03, NOTE_H + 0.03]} />
        <meshStandardMaterial color={borderColor} roughness={0.9} />
      </mesh>

      {/* Body */}
      <mesh>
        <planeGeometry args={[NOTE_W, NOTE_H]} />
        <meshStandardMaterial color={bodyColor} roughness={0.95} />
      </mesh>

      {/* Top fold shadow line */}
      <mesh position={[0, NOTE_H / 2 - 0.065, 0.001]}>
        <planeGeometry args={[NOTE_W, 0.025]} />
        <meshStandardMaterial color={borderColor} transparent opacity={0.35} roughness={1} />
      </mesh>

      {/* Pin */}
      <mesh position={[0, NOTE_H / 2 + PIN_R * 0.4, NOTE_DEPTH + 0.005]}>
        <sphereGeometry args={[PIN_R, 10, 8]} />
        <meshStandardMaterial color={pinColor} roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Content text */}
      <Text
        position={[0, 0.04, 0.015]}
        fontSize={0.088}
        maxWidth={NOTE_W - 0.1}
        lineHeight={1.35}
        textAlign="left"
        anchorX="center"
        anchorY="middle"
        color={pal.text}
        font={FONT_REGULAR}
        clipRect={[-NOTE_W / 2, -NOTE_H / 2 + 0.1, NOTE_W / 2, NOTE_H / 2 - 0.1]}
      >
        {displayContent}
      </Text>

      {/* Nickname */}
      <Text
        position={[0, -(NOTE_H / 2 - 0.1), 0.015]}
        fontSize={0.065}
        maxWidth={NOTE_W - 0.1}
        textAlign="center"
        anchorX="center"
        anchorY="bottom"
        color={pal.text}
        font={FONT_BOLD}
      >
        — {displayNickname}
      </Text>
    </group>
  );
}

// ── Event-title plaque ───────────────────────────────────────────────────────
// The wall's one always-there fixture — shows whichever FreedomWallEvent is
// currently active. Colors + the title's font are the only admin-editable
// things about it (see lib/museum/freedomWallBanner.ts's BannerColors);
// position/removal are the Museum Scene Editor's job, same as any other
// placed object.

const PLAQUE_MAX_CHARS = 42;
const PLAQUE_HEIGHT = 0.92;

export function FreedomWallPlaque({
  title,
  colors,
  position,
  rotationY = 0,
}: {
  /** The active event's title — "Freedom Wall" when none is active. */
  title: string;
  colors: Required<BannerColors>;
  position: [number, number, number];
  rotationY?: number;
}) {
  const label = title.length > PLAQUE_MAX_CHARS
    ? `${title.slice(0, PLAQUE_MAX_CHARS - 1)}…`
    : title;

  // drei's <Text> can't be measured before it lays out, so size the plaque
  // from an average-glyph estimate (~0.55 em) plus padding, clamped so a very
  // short title still reads as a plaque and a long one never overruns the
  // wall. Scales with the admin-chosen fontSize too, so a larger title still
  // gets a plaque wide enough to hold it.
  //
  // Kept here rather than delegated to sceneBanner.ts's bannerWidth(): this
  // plaque's minimum is 3.4m where a banner's is 1.6m, because it is a fixed
  // room fixture that should look deliberate even when the active event is
  // called "Hi", and a general-purpose sign should be allowed to be small.
  const width = Math.min(
    ROOM_WIDTH - 1.2,
    Math.max(3.4, label.length * colors.fontSize * 0.55 + 1.1)
  );

  // The geometry itself is SceneBanner's — this plaque and the admin-placed
  // Banner object are the same thing drawn twice otherwise, and they share
  // rooms. See that component's header.
  return (
    <SceneBanner
      text={label}
      eyebrow="FREEDOM WALL"
      width={width}
      height={PLAQUE_HEIGHT}
      // This plaque has only its two colours to give — no texture, no glass,
      // no shimmer, the same painted panel it has always been.
      finish={solidBannerFinish(colors.backgroundColor, colors.edgeColor)}
      textColor={colors.textColor}
      fontFamily={colors.fontFamily}
      fontSize={colors.fontSize}
      position={position}
      rotationY={rotationY}
    />
  );
}

// ── Room contents group ──────────────────────────────────────────────────────

export function FreedomWallRoomContents({
  notes,
  depth,
  centerZ,
  baseY = 0,
  hasNorthOpening = false,
  hasSouthOpening = false,
  shouldLoad = true,
  /** Note ids to skip rendering here — used by the Museum Scene Editor,
   *  which renders the selected/draggable notes itself (EditableStickyNote)
   *  and only wants this component drawing everything else. */
  hiddenNoteIds,
}: {
  notes: FreedomWallNotePublic[];
  depth: number;
  centerZ: number;
  /** This room's own floor Y (see roomLayout.ts's floorYSouth) — non-zero
   * only when the Freedom Wall has been moved to the Second Floor. */
  baseY?: number;
  hasNorthOpening?: boolean;
  hasSouthOpening?: boolean;
  shouldLoad?: boolean;
  hiddenNoteIds?: Set<string>;
}) {
  if (!shouldLoad) return null;

  const northWallZ = -depth / 2 + WALL_Z;
  const visibleNotes = hiddenNoteIds ? notes.filter((n) => !hiddenNoteIds.has(n.id)) : notes;

  return (
    <group position={[0, baseY, centerZ]}>
      {/* Notes */}
      {visibleNotes.map((note) => {
        const { position, rotationY } = notePercentToWorld(note, { depth, hasNorthOpening, hasSouthOpening });
        return (
          <StickyNote3D
            key={note.id}
            note={note}
            position={position}
            rotationY={rotationY}
            scale={note.scale}
          />
        );
      })}

      {/* Empty-state message */}
      {notes.length === 0 && (
        <Text
          position={[0, FRAME_CENTER_Y, northWallZ + 0.01]}
          fontSize={0.11}
          color="#c9c0ad"
          anchorX="center"
          anchorY="middle"
          font={FONT_REGULAR}
        >
          {`No notes yet.\nBe the first to pin one!`}
        </Text>
      )}
    </group>
  );
}
