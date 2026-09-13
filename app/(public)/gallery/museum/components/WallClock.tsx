"use client";

// WallClock.tsx
//
// The About room's digital wall clock — a real one. It reads the actual
// current time and keeps reading it, second by second, for as long as a
// visitor is standing in the room.
//
// Drawn by code rather than loaded as a model, for the same reason the
// Contact Desk's envelope is: a .glb can look like a clock, but it can't
// *tell the time*. What it looks like is admin-controlled instead — case,
// screen and digit colours, the glow, 12/24-hour, seconds, the date line and
// a caption — all stored as JSON on its scene-object row (see
// lib/museum/aboutRoomBlocks.ts's WallClockConfig).
//
// Placed the free way (drag, turn, resize in the Museum Scene Editor) exactly
// like the Contact Desk, so this component draws itself flush at its own
// local origin and lets the caller's group carry position/rotation/scale.
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  CLOCK_GLOW_MAX,
  CLOCK_GLOW_MIN,
  MAX_CLOCK_LABEL,
  type WallClockConfig,
} from "@/lib/museum/aboutRoomBlocks";

const FONT_BOLD = "/fonts/DMSans-Bold.woff";
const FONT_REG = "/fonts/DMSans-Regular.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
// Roughly the footprint of a station clock: readable from across an 18m room
// without competing with the artwork-sized blocks on the same walls.
const CASE_W = 1.22;
const CASE_H = 0.58;
const CASE_D = 0.07;
const BEZEL = 0.05; // case border around the screen
const SCREEN_W = CASE_W - BEZEL * 2;
const SCREEN_H = CASE_H - BEZEL * 2;

const TIME_SIZE = 0.2;
const MERIDIEM_SIZE = 0.082;
const DATE_SIZE = 0.072;
const LABEL_SIZE = 0.066;
const LABEL_Y = 0.185;
const DATE_Y = -0.175;


/** The clock face's text, as it should read right now. */
interface ClockReadout {
  time: string;
  /** "AM"/"PM" in 12-hour mode; blank in 24-hour. */
  meridiem: string;
  date: string;
}

/**
 * Builds the two formatters this clock reads through.
 *
 * The locale is pinned rather than taken from the visitor's browser: the
 * artist chose a 12- or 24-hour clock in the editor, and a visitor in a
 * locale that formats the other way round would otherwise see something the
 * admin never previewed. en-GB for 24-hour specifically, because en-US
 * renders midnight as "24:00" there.
 *
 * An unknown time zone (a typo in the editor's field) makes Intl throw, so
 * both formatters fall back to the visitor's own device time — a clock
 * showing the wrong-but-plausible time is worse than one showing theirs.
 */
function buildFormatters(use24Hour: boolean, showSeconds: boolean, timeZone: string) {
  const locale = use24Hour ? "en-GB" : "en-US";
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: !use24Hour,
    ...(showSeconds ? { second: "2-digit" as const } : {}),
  };
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  const tz = timeZone.trim();
  if (tz) {
    try {
      return {
        time: new Intl.DateTimeFormat(locale, { ...timeOpts, timeZone: tz }),
        date: new Intl.DateTimeFormat("en-US", { ...dateOpts, timeZone: tz }),
      };
    } catch {
      // Fall through to the device-time formatters below.
    }
  }
  return {
    time: new Intl.DateTimeFormat(locale, timeOpts),
    date: new Intl.DateTimeFormat("en-US", dateOpts),
  };
}

function readClock(
  now: Date,
  formatters: { time: Intl.DateTimeFormat; date: Intl.DateTimeFormat }
): ClockReadout {
  // formatToParts, not format(), so the AM/PM can be drawn small beside the
  // digits instead of inflating them to fit it on the same line.
  let time = "";
  let meridiem = "";
  for (const part of formatters.time.formatToParts(now)) {
    if (part.type === "dayPeriod") meridiem = part.value.toUpperCase();
    else if (part.type === "literal" && part.value.trim() === "") continue;
    else time += part.value;
  }
  return {
    time: time.trim(),
    meridiem,
    date: formatters.date.format(now).toUpperCase(),
  };
}

/** A troika text mesh as drei hands it back — `text` can be assigned and
 *  `sync()` re-lays it out, which is how this clock re-draws itself without
 *  a React render per second. */
type TroikaText = THREE.Mesh & { text: string; sync: () => void };

/** Repaint one field, but only when it actually reads differently. */
function paint(node: TroikaText | null, text: string) {
  if (!node || node.text === text) return;
  node.text = text;
  node.sync();
}

export function WallClock({
  config,
  /** False while the visitor is nowhere near this room — the clock stops
   *  re-formatting itself and catches up the moment they walk back in. */
  ticking = true,
}: {
  config: Required<WallClockConfig>;
  ticking?: boolean;
}) {
  const timeRef = useRef<TroikaText | null>(null);
  const meridiemRef = useRef<TroikaText | null>(null);
  const dateRef = useRef<TroikaText | null>(null);

  const formatters = useMemo(
    () => buildFormatters(config.use24Hour, config.showSeconds, config.timeZone),
    [config.use24Hour, config.showSeconds, config.timeZone]
  );

  // First paint comes from here rather than the first frame, so the clock is
  // never briefly blank (and so the editor's preview reads correctly even
  // before its render loop has run).
  const initial = useMemo(() => readClock(new Date(), formatters), [formatters]);

  // Each frame reads the clock and repaints only the fields that actually
  // changed — 59 frames out of 60 do nothing but a string compare.
  //
  // The comparison is against the text on the mesh itself rather than a
  // "last painted" ref on purpose: drei re-applies its children to `.text`
  // on every React render, so a ref would go on believing the current second
  // was painted while the mesh had quietly been reset to the value this
  // component first rendered with, and the clock would sit frozen there —
  // for up to a whole minute with the seconds field switched off. Reading
  // the mesh can't drift from what a visitor is actually looking at.
  useFrame(() => {
    if (!ticking) return;
    const next = readClock(new Date(), formatters);
    paint(timeRef.current, next.time);
    paint(meridiemRef.current, config.use24Hour ? "" : next.meridiem);
    paint(dateRef.current, next.date);
  });

  const label = config.label.trim().slice(0, MAX_CLOCK_LABEL);
  const showLabel = label.length > 0;
  // Keep the digits optically centred whichever of the caption / date lines
  // are actually drawn: each present line pulls the time away from it by half
  // its own offset, so the face never looks top- or bottom-heavy.
  const timeY = -((showLabel ? LABEL_Y : 0) + (config.showDate ? DATE_Y : 0)) / 2;

  const glow = Math.min(CLOCK_GLOW_MAX, Math.max(CLOCK_GLOW_MIN, config.glow));
  // troika's own blurred outline — a real halo around the glyphs rather than
  // a glow-coloured quad behind them, so it follows the digits as they change
  // and never shows as a visible rectangle on the screen.
  //
  // Always passed, even at glow 0 (where it resolves to no blur and no
  // opacity) rather than spread in conditionally: dropping a prop between
  // renders leaves R3F to restore whatever the object had before, which is
  // not the same thing as asking for none.
  const glowProps = {
    outlineWidth: 0,
    outlineBlur: 0.03 * glow,
    outlineColor: config.digitColor,
    outlineOpacity: Math.min(1, 0.5 * glow),
  };

  // The AM/PM sits just right of the digits, which shift left by the same
  // amount to keep the pair centred on the face. drei can't measure text
  // before it lays out, so the digits' half-width is estimated the way the
  // Freedom Wall plaque estimates its own (~0.55 em per glyph) — close enough
  // that the suffix clears the last digit with a hair of space and no gap.
  const halfDigits = (initial.time.length * TIME_SIZE * 0.55) / 2;
  const timeX = config.use24Hour ? 0 : -MERIDIEM_SIZE * 0.9;
  const meridiemX = timeX + halfDigits + 0.03;

  return (
    <group>
      {/* Case */}
      <mesh position={[0, 0, -CASE_D / 2]}>
        <boxGeometry args={[CASE_W, CASE_H, CASE_D]} />
        <meshStandardMaterial color={config.frameColor} roughness={0.55} metalness={0.35} />
      </mesh>

      {/* Screen — inset a hair in front of the case so it never z-fights it */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshStandardMaterial
          color={config.screenColor}
          roughness={0.3}
          metalness={0.1}
          // A screen is its own light source, however faintly — without this
          // the face goes flat black in a dimly-lit room and the digits look
          // like they're floating on the wall.
          emissive={config.screenColor}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Caption */}
      {showLabel && (
        <Text
          position={[0, LABEL_Y, 0.01]}
          fontSize={LABEL_SIZE}
          letterSpacing={0.24}
          color={config.digitColor}
          fillOpacity={0.75}
          anchorX="center"
          anchorY="middle"
          font={FONT_REG}
          material-toneMapped={false}
        >
          {label.toUpperCase()}
        </Text>
      )}

      {/* The time itself */}
      <Text
        ref={timeRef}
        position={[timeX, timeY, 0.01]}
        fontSize={TIME_SIZE}
        // Fixed advance per glyph would be ideal for a clock; DM Sans' digits
        // are already tabular, so "11:59" and "12:00" occupy the same width
        // and the readout doesn't jitter as it ticks.
        color={config.digitColor}
        anchorX="center"
        anchorY="middle"
        font={FONT_BOLD}
        material-toneMapped={false}
        {...glowProps}
      >
        {initial.time}
      </Text>

      {/* AM/PM — its own smaller text so the digits stay the size they'd be
          on a 24-hour face. Mounted even in 24-hour mode (as an empty
          string) so switching the toggle doesn't remount the text object. */}
      <Text
        ref={meridiemRef}
        position={[meridiemX, timeY - TIME_SIZE * 0.22, 0.01]}
        fontSize={MERIDIEM_SIZE}
        letterSpacing={0.08}
        color={config.digitColor}
        fillOpacity={0.8}
        anchorX="left"
        anchorY="middle"
        font={FONT_BOLD}
        material-toneMapped={false}
      >
        {config.use24Hour ? "" : initial.meridiem}
      </Text>

      {/* Date */}
      {config.showDate && (
        <Text
          ref={dateRef}
          position={[0, DATE_Y, 0.01]}
          fontSize={DATE_SIZE}
          letterSpacing={0.12}
          color={config.digitColor}
          fillOpacity={0.62}
          anchorX="center"
          anchorY="middle"
          font={FONT_REG}
          material-toneMapped={false}
        >
          {initial.date}
        </Text>
      )}
    </group>
  );
}
