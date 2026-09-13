"use client";

// FloodLights.tsx
//
// The second billboard-lights style (see BillboardLights.tsx for the first):
// a row of stage/monument uplights standing on the floor at a standee's feet,
// each throwing a visible cone of light up the front of the print. Where the
// marquee bulbs *outline* a standee, these light it — the difference between a
// cinema frontage and an exhibit under a spot.
//
// ── The V ────────────────────────────────────────────────────────────────
//
// What makes a floodlight read as one is the beam, not the lamp: a wedge of
// light, narrow at the fixture and spreading as it climbs. That is drawn here
// as a real cone — apex at the lamp's lens, open end up at the print — with a
// gradient that fades it out toward the far end, additively blended so it
// brightens whatever it crosses instead of painting over it. Without the
// gradient a cone is a solid plastic ice-cream cone; without additive blending
// it's a grey film hanging in front of the standee.
//
// The beams are *aimed*, never angled by hand. Each lamp knows where it stands
// and how far up the print it is throwing, so the tilt is one atan away — and
// an admin who sets "how far does this reach" can't produce a rig with its
// lights pointing at the ceiling, which is the whole reason the angle isn't a
// setting.
//
// ── These don't light anything, for the same reason the bulbs don't ───────
//
// No SpotLight. A real spot per lamp, six lamps a standee, a dozen lit
// standees is not a scene WebGL draws at any framerate — and three.js's
// default material path caps how many lights a shader considers long before
// that. The cone *is* the light as far as a viewer is concerned; a beam you
// can see crossing the air is what says "lit from below", not the extra
// lambert term on the print behind it.
//
// Costlier per standee than the marquee (which is one InstancedMesh however
// many bulbs): four small meshes per lamp, so up to 24 for a six-lamp rig.
// That is affordable because of what the per-standee switch is *for* — an
// admin lights the two or three cosplays a visit is about, not all twelve.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { LightsAnimation } from "@/lib/museum/cosplayStandee";

/** How far in front of the print the lamps stand, in metres. Clear of the
 *  standee's own base (BASE_D / 2 = 0.23) with room for the can, so a fixture
 *  never intersects the plinth it is lighting. */
const STANDOFF = 0.42;

/** The lamp body — a squat can aimed up the beam, on a floor plate. Small
 *  enough to read as a fixture at a standee's feet rather than a prop of its
 *  own; a visitor should notice the light, not the lamp. */
const CAN_LENGTH = 0.15;
const CAN_RADIUS = 0.062;
const PLATE_RADIUS = 0.085;
const PLATE_HEIGHT = 0.022;
const CAN_COLOR = "#2b2b2e";
const PLATE_COLOR = "#38383c";

/** Opacity of a beam at full brightness, before `intensity` scales it. Low on
 *  purpose: additive blending stacks, so beams that overlap (and at these
 *  spreads they do) would blow out to white at anything higher. */
const BEAM_BASE_OPACITY = 0.16;
/** Ceiling on that after intensity, so a room turned up to 2x still has beams
 *  you can see the print through. A floodlight that hides what it lights is
 *  the one outcome nobody wants. */
const BEAM_MAX_OPACITY = 0.42;

/** How dim an unlit lamp goes in "chase"/"blink" — its lens keeps a little
 *  colour, the way a switched-off lamp still catches the room. */
const UNLIT_MIX = 0.12;
/** Lamps per second the chase steps through at speed 1. Slower than the
 *  marquee's bulb chase: a lamp is a bigger, heavier thing than a bulb, and a
 *  rig flicking through six of them at bulb speed reads as a fault. */
const CHASE_LAMPS_PER_SECOND = 1.6;
/** Blink cycles per second at speed 1, and how far down the dip goes. */
const BLINK_HZ = 0.7;
const BLINK_DEPTH = 0.6;

const BEAM_SEGMENTS = 16;

/**
 * The beam's falloff, as a 1×64 gradient: bright at the lamp, gone by the far
 * end. Built once and shared by every beam in the museum — it depends on
 * nothing an admin can set, so a texture per lamp would be the same 64 pixels
 * uploaded to the GPU over and over.
 *
 * ── Which way round it goes, which is easy to get wrong twice ──
 *
 * The gradient has to run down the cone's *height*, so it is drawn vertically
 * (a 1-wide, 64-tall canvas): a cone's UV `u` wraps around its circumference
 * and `v` climbs its height, so a horizontal gradient would band the beam like
 * a barber's pole instead of fading it out.
 *
 * ConeGeometry carries `v = 1` at the tip and `v = 0` at the wide base, and
 * the mesh below is flipped end-for-end so that tip sits at the lamp — so
 * `v = 1` is the bright end. Textures are sampled with `flipY` on, meaning
 * `v = 1` reads the canvas's *first* row, so the opaque stop is at the top of
 * the canvas and the transparent one at the bottom.
 */
let beamGradient: THREE.CanvasTexture | null = null;
function getBeamGradient(): THREE.CanvasTexture | null {
  if (beamGradient) return beamGradient;
  // The museum's Canvas is loaded ssr:false, so this only ever runs client-
  // side — but a missing document should degrade to a flat beam, not throw.
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createLinearGradient(0, 0, 0, 64);
  // Full strength at the lamp (canvas top → v = 1), gone by the far end. The
  // middle stop keeps the throw from reading as a linear ramp — real
  // scattered light drops off fastest right after it leaves the lens.
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1, 64);
  beamGradient = new THREE.CanvasTexture(canvas);
  beamGradient.colorSpace = THREE.SRGBColorSpace;
  return beamGradient;
}

export function FloodLights({
  width,
  color,
  intensity,
  animation,
  speed = 1,
  count,
  beamHeight,
  beamSpread,
}: {
  /** How wide to spread the lamps — the print's own width, so the rig is
   *  sized to what it is lighting rather than to a fixed number of metres. */
  width: number;
  color: string;
  intensity: number;
  animation: LightsAnimation;
  speed?: number;
  count: number;
  /** How far up the front of the print the beams reach, in metres. */
  beamHeight: number;
  /** The cone's radius where it lands — how open the V is. */
  beamSpread: number;
}) {
  const gradient = useMemo(() => getBeamGradient(), []);

  /** Where each lamp stands along the standee's front, and how far it has to
   *  throw. Spread across `width` with a lamp at each end when there are two
   *  or more; a single lamp goes up the middle, which is what one lamp is
   *  for. The lamps sit slightly inside the print's own edge so a wide photo
   *  doesn't put its outermost fixture out in the walkway. */
  const lamps = useMemo(() => {
    const span = Math.max(0.001, width * 0.82);
    return Array.from({ length: count }, (_, i) => {
      const x = count === 1 ? 0 : -span / 2 + (span * i) / (count - 1);
      return { x };
    });
  }, [count, width]);

  // Every lamp throws the same distance and angle — they differ only in where
  // they stand — so the aim is worked out once. The target is a point
  // `beamHeight` up the face of the print, which sits at local z = 0; the
  // lamp is at z = STANDOFF, so the beam leans back by exactly this much.
  const beamLength = Math.hypot(beamHeight, STANDOFF);
  // Negative: a positive rotation about X tilts +Y toward +Z, and the print is
  // the other way.
  const beamTilt = -Math.atan2(STANDOFF, beamHeight);

  // One material per lamp — unlike the marquee's shared instanced buffer,
  // these each need their own opacity/colour, and at six-a-standee that's
  // cheap enough to be the simple answer.
  const beamMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const lensMaterials = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  const litColor = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);
  const unlitColor = useMemo(
    () => new THREE.Color(color).multiplyScalar(intensity * UNLIT_MIX),
    [color, intensity]
  );
  const litOpacity = useMemo(
    () => Math.min(BEAM_MAX_OPACITY, BEAM_BASE_OPACITY * intensity),
    [intensity]
  );
  const scratch = useMemo(() => new THREE.Color(), []);

  // Put every lamp back to full whenever the mode (or the look) changes.
  // The frame loop below mutates these materials imperatively, and switching
  // to "static" only *stops* writing them — without this, a rig left mid-chase
  // would stay that way for good, with one lamp lit and the rest dimmed and no
  // way to get them back. R3F can't re-apply the colour/opacity props on its
  // own either: `litColor` and `litOpacity` are stable memos, so from React's
  // side nothing changed.
  useEffect(() => {
    for (let i = 0; i < lamps.length; i++) {
      const beam = beamMaterials.current[i];
      const lens = lensMaterials.current[i];
      if (beam) beam.opacity = litOpacity;
      if (lens) lens.color.copy(litColor);
    }
  }, [animation, lamps.length, litColor, litOpacity]);

  useFrame(({ clock }) => {
    // "static" is every lamp on, which is exactly how they mount — nothing to
    // rewrite each frame.
    if (animation === "static") return;
    const time = clock.getElapsedTime() * speed;

    if (animation === "blink") {
      const pulse = 1 - BLINK_DEPTH * (0.5 - 0.5 * Math.cos(time * BLINK_HZ * Math.PI * 2));
      scratch.copy(unlitColor).lerp(litColor, pulse);
      for (let i = 0; i < lamps.length; i++) {
        const beam = beamMaterials.current[i];
        const lens = lensMaterials.current[i];
        if (beam) beam.opacity = litOpacity * pulse;
        if (lens) lens.color.copy(scratch);
      }
      return;
    }

    // Chase: one lamp at a time, walking along the rig. A marquee chases in
    // runs of three because it's wired in three circuits; a lighting rig
    // chases one fixture at a time, which is also the only reading that makes
    // sense at two or three lamps.
    const active = Math.floor(time * CHASE_LAMPS_PER_SECOND) % lamps.length;
    for (let i = 0; i < lamps.length; i++) {
      const on = i === active;
      const beam = beamMaterials.current[i];
      const lens = lensMaterials.current[i];
      if (beam) beam.opacity = on ? litOpacity : litOpacity * UNLIT_MIX;
      if (lens) lens.color.copy(on ? litColor : unlitColor);
    }
  });

  return (
    <group>
      {lamps.map((lamp, i) => (
        <group key={i} position={[lamp.x, 0, STANDOFF]}>
          {/* Floor plate — what stops the can from floating. Unrotated, so it
              lies flat on the floor whatever angle the light is aimed at. */}
          <mesh position={[0, PLATE_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[PLATE_RADIUS, PLATE_RADIUS, PLATE_HEIGHT, 12]} />
            <meshStandardMaterial color={PLATE_COLOR} roughness={0.7} metalness={0.4} />
          </mesh>

          {/* Everything that points at the print lives in here, so the can,
              its lens and the beam are aimed as one piece and can't drift out
              of line with each other. */}
          <group position={[0, PLATE_HEIGHT, 0]} rotation={[beamTilt, 0, 0]}>
            <mesh position={[0, CAN_LENGTH / 2, 0]}>
              <cylinderGeometry args={[CAN_RADIUS, CAN_RADIUS * 0.86, CAN_LENGTH, 14]} />
              <meshStandardMaterial color={CAN_COLOR} roughness={0.55} metalness={0.6} />
            </mesh>

            {/* The lens — the lamp reading as switched on. Basic + unmapped
                tone so it stays the colour it is told, exactly like a bulb
                (see BillboardLights' own note on why these aren't shaded). */}
            <mesh position={[0, CAN_LENGTH + 0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[CAN_RADIUS * 0.82, 14]} />
              <meshBasicMaterial
                ref={(material) => {
                  lensMaterials.current[i] = material;
                }}
                color={litColor}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* The beam. Flipped end-for-end (ConeGeometry builds its tip at
                +Y) and pushed up by half its length, which lands the tip on
                the lens and opens the cone toward the print — the V.
                openEnded, or the cap would draw a lit disc floating across
                the standee's chest. */}
            <mesh position={[0, CAN_LENGTH + beamLength / 2, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[beamSpread, beamLength, BEAM_SEGMENTS, 1, true]} />
              <meshBasicMaterial
                ref={(material) => {
                  beamMaterials.current[i] = material;
                }}
                color={litColor}
                map={gradient ?? undefined}
                transparent
                opacity={litOpacity}
                // Adds its light to what's behind rather than covering it —
                // the difference between a beam and a cone of grey plastic.
                blending={THREE.AdditiveBlending}
                // Visible from inside as well as out: a visitor can walk right
                // up beside a standee and end up standing in its light.
                side={THREE.DoubleSide}
                // Depth is still *tested* (so the beam is occluded by the
                // standee it crosses behind) but never written, which is what
                // keeps two overlapping beams from punching holes in each
                // other depending on draw order.
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
