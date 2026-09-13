"use client";

// BillboardLights.tsx
//
// A ring of marquee bulbs around a rectangle — the row of lights bolted around
// a cinema billboard or a convention photo booth. Drawn around a standee's
// backdrop panel in the Cosplay Room (see CosplayStandee.tsx), which is the
// only caller today; it takes a plain width/height rather than anything
// standee-shaped so a future banner or poster can reuse it unchanged.
//
// ── Why one InstancedMesh, and why an unlit material ──────────────────────
//
// A lit panel wants forty-odd bulbs, and a room can hold a dozen lit standees.
// Drawn as forty separate <mesh>es that is five hundred draw calls and five
// hundred React nodes for what is visually one object, on a scene that already
// carries every frame, standee and prop in the museum — so the whole ring is
// one instanced mesh with a per-instance colour, which is the one thing that
// has to differ between bulbs.
//
// The material is deliberately `meshBasicMaterial`, not `meshStandard`: a bulb
// is a thing that *emits*, so shading it by the room's lights is backwards —
// it would leave the bulbs on a dim wall darker than the wall itself, which is
// the opposite of switched on. Basic + `toneMapped={false}` is also what lets
// `intensity` above 1 actually read as brighter rather than being rolled off by
// the renderer's ACES curve, which flattens exactly the top end this needs.
//
// These are not real lights. A dozen standees × forty point lights is not a
// thing WebGL will draw at any framerate, and three.js's default material path
// caps how many lights a shader will even consider. The bulbs light themselves
// and nothing else, which is what a viewer reads as a lit sign anyway — the
// glow on the wall behind was never the part anyone was looking at.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { LightsAnimation } from "@/lib/museum/cosplayStandee";

/** How much of the lit colour an unlit bulb keeps. Not zero: a dark bulb on a
 *  real marquee is still visibly the same glass, and blacking it out makes the
 *  chase read as bulbs vanishing rather than as light moving along a fixed
 *  row. */
const UNLIT_MIX = 0.14;

/** Bulbs per lit run in "chase" — every third one, the pattern an actual
 *  three-circuit marquee is wired for. */
const CHASE_PERIOD = 3;
/** How many bulbs the chase advances per second at speed 1. */
const CHASE_BULBS_PER_SECOND = 6;
/** Full blink cycles per second at speed 1, and how far down a blink dips —
 *  a pulse rather than a hard on/off, which at this bulb size reads as a
 *  strobe. */
const BLINK_HZ = 0.9;
const BLINK_DEPTH = 0.75;

/** Sphere tessellation. These are 5cm beads seen from a metre or two away;
 *  past this they cost triangles for a roundness nobody can see. */
const BULB_SEGMENTS_W = 10;
const BULB_SEGMENTS_H = 8;

/**
 * Bulb centres around the rectangle, in the XY plane, going round the loop in
 * order — the order matters, because "chase" walks this array and a shuffled
 * one would make the run jump corners.
 *
 * Laid out per side rather than by walking the perimeter at a fixed step, so a
 * bulb lands exactly on each of the four corners. A perimeter walk spaces them
 * just as evenly but puts the corners wherever the arithmetic falls, and a
 * marquee with no bulb at its corner reads as an unfinished one.
 */
function bulbPositions(width: number, height: number, spacing: number): [number, number][] {
  // At least two per side, so even a panel narrower than the spacing still
  // gets its corners and reads as a frame rather than a line.
  const nx = Math.max(2, Math.round(width / spacing));
  const ny = Math.max(2, Math.round(height / spacing));
  const x0 = -width / 2;
  const x1 = width / 2;
  const y0 = -height / 2;
  const y1 = height / 2;
  const points: [number, number][] = [];
  // Each side takes its own starting corner and stops one short of the next,
  // so every corner is placed exactly once.
  for (let i = 0; i < nx; i++) points.push([x0 + (width * i) / nx, y1]);
  for (let i = 0; i < ny; i++) points.push([x1, y1 - (height * i) / ny]);
  for (let i = 0; i < nx; i++) points.push([x1 - (width * i) / nx, y0]);
  for (let i = 0; i < ny; i++) points.push([x0, y0 + (height * i) / ny]);
  return points;
}

export function BillboardLights({
  width,
  height,
  color,
  bulbSize,
  spacing,
  intensity,
  animation,
  speed = 1,
}: {
  /** Outer size of the frame the bulbs ring, in metres — the bulbs sit *on*
   *  this rectangle's edge, centred on it. */
  width: number;
  height: number;
  color: string;
  bulbSize: number;
  spacing: number;
  intensity: number;
  animation: LightsAnimation;
  speed?: number;
}) {
  const points = useMemo(() => bulbPositions(width, height, spacing), [width, height, spacing]);
  const mesh = useRef<THREE.InstancedMesh>(null);

  // The two ends every mode interpolates between. Pre-multiplied by intensity
  // here rather than in the frame loop: it doesn't change per bulb or per
  // frame, and this runs for every bulb of every lit standee.
  const lit = useMemo(() => new THREE.Color(color).multiplyScalar(intensity), [color, intensity]);
  const unlit = useMemo(
    () => new THREE.Color(color).multiplyScalar(intensity * UNLIT_MIX),
    [color, intensity]
  );
  // Scratch instances, so the frame loop allocates nothing.
  const scratchColor = useMemo(() => new THREE.Color(), []);
  const scratchMatrix = useMemo(() => new THREE.Matrix4(), []);

  // Positions never change per frame — only colour does — so the matrices are
  // written once per layout change rather than in useFrame.
  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    for (let i = 0; i < points.length; i++) {
      scratchMatrix.makeTranslation(points[i][0], points[i][1], 0);
      instanced.setMatrixAt(i, scratchMatrix);
      // Start every bulb lit, so a "static" ring is correct before the first
      // frame and the two animated modes have a colour buffer to write into.
      instanced.setColorAt(i, lit);
    }
    instanced.instanceMatrix.needsUpdate = true;
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    // `animation` is a dependency even though nothing here reads it: the frame
    // loop below mutates this colour buffer imperatively, and switching back to
    // "static" only *stops* writing it — so without re-seeding here the ring
    // would freeze mid-chase, permanently, with two thirds of it dark. The
    // colour props R3F manages can't fix that on their own; `lit` is a stable
    // memo, so React sees nothing to re-apply.
  }, [points, lit, animation, scratchMatrix]);

  useFrame(({ clock }) => {
    const instanced = mesh.current;
    // "static" is every bulb lit, which the layout effect above has already
    // written — re-writing an unchanging buffer every frame for every lit
    // standee in the room is pure cost.
    if (!instanced || animation === "static") return;

    const time = clock.getElapsedTime() * speed;
    if (animation === "blink") {
      // One colour for the whole ring, so this is a single lerp rather than one
      // per bulb. A raised cosine keeps the dip smooth at both ends.
      const pulse = 1 - BLINK_DEPTH * (0.5 - 0.5 * Math.cos(time * BLINK_HZ * Math.PI * 2));
      scratchColor.copy(unlit).lerp(lit, pulse);
      for (let i = 0; i < points.length; i++) instanced.setColorAt(i, scratchColor);
    } else {
      // Chase: every CHASE_PERIOD-th bulb is lit, and which one that is walks
      // round the loop. Stepped rather than continuous on purpose — a real
      // chase switches circuits, it doesn't crossfade.
      const step = Math.floor(time * CHASE_BULBS_PER_SECOND);
      for (let i = 0; i < points.length; i++) {
        // The modulo runs against the bulb count as well as the period so the
        // pattern joins up cleanly where the loop closes, instead of showing a
        // seam at the top-left corner on any ring whose count isn't a multiple
        // of three.
        const phase = (((i + step) % points.length) + points.length) % points.length;
        instanced.setColorAt(i, phase % CHASE_PERIOD === 0 ? lit : unlit);
      }
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
  });

  return (
    // Keyed on the bulb count: an InstancedMesh's instance count is fixed at
    // construction, so a resized panel (more bulbs) needs a new one rather than
    // a re-render of this one.
    <instancedMesh
      key={points.length}
      ref={mesh}
      args={[undefined, undefined, points.length]}
      frustumCulled={false}
    >
      <sphereGeometry args={[bulbSize, BULB_SEGMENTS_W, BULB_SEGMENTS_H]} />
      {/* White, because the per-instance colour *multiplies* the material's —
          any other base would tint every bulb the admin's colour never asked
          for. toneMapped={false}: see the file header. */}
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  );
}
