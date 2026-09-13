"use client";

// ContactDesk.tsx
//
// The About room's one interactive prop: a writing desk with a letter on it,
// standing against a wall. Walk up, press [E], and ContactPanel.tsx opens the
// museum's own copy of the contact form.
//
// Built procedurally so it works before anyone models anything, and
// replaceable with an uploaded .glb exactly the way the Stories Room's
// pedestal and the Arcade Room's cabinet are (see storyPodiumModel.ts /
// arcadeConfig.ts). The envelope on top is drawn by code either way — it is
// what tells a visitor this prop is a mailbox rather than furniture, and a
// swapped-in model shouldn't be able to lose that.
import { useMemo } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { CustomSceneObject } from "./CustomSceneObject";
import { tiledClone, useSurfaceTexture } from "./MuseumRoom";
import { TEXTURE_TILE_METERS, INTERACT_GLOW_COLOR } from "./roomConstants";

const FONT_BOLD = "/fonts/DMSans-Bold.woff";

// ── Geometry, in metres ────────────────────────────────────────────────────
// A desk, not a plinth: low enough to read as furniture a visitor walks up to
// rather than another pedestal competing with the Stories Room's.
const DESK_W = 1.15;
const DESK_D = 0.55;
const DESK_H = 0.78;
const TOP_T = 0.06;          // table-top thickness
const LEG_T = 0.08;
const ENVELOPE_W = 0.34;
const ENVELOPE_H = 0.23;

/** Radius a visitor is kept out of (see PlayerControls' `obstacles`), matching
 *  the desk's widest half-span so the collider tracks what's visible. */
export const CONTACT_DESK_COLLIDER_RADIUS = DESK_W / 2;

const WOOD_COLOR = "#6b563f";
const WOOD_DARK = "#4e3f2e";
const ENVELOPE_COLOR = "#f4efe2";
const ENVELOPE_LINE = "#b9ac91";

export function ContactDesk({
  position,
  rotationY,
  scale = 1,
  active = false,
  shouldLoad = true,
  label,
  modelUrl,
  textureUrl,
}: {
  /** Room-local, already offset by the room's own floor Y by the parent. */
  position: [number, number, number];
  rotationY: number;
  scale?: number;
  /** True when the visitor is close enough to press [E] — same meaning and
   *  same warm highlight as StoryPodium's / ArcadeCabinet's `active`. */
  active?: boolean;
  shouldLoad?: boolean;
  /** Sign above the desk. Blank hides it. */
  label: string;
  /** The admin's uploaded .glb, standing in for the built-in desk. */
  modelUrl?: string | null;
  /** Tiled surface image for the *built-in* desk. Ignored while `modelUrl` is
   *  set: that model brings its own materials. */
  textureUrl?: string | null;
}) {
  // Same load-and-tile path a room's wall/floor/ceiling uses (MuseumRoom's
  // useSurfaceTexture/tiledClone) — one cached image, cloned per surface so
  // each carries its own repeat. Only fetched when there's no .glb to override.
  const surfaceTex = useSurfaceTexture(modelUrl ? null : textureUrl ?? null, shouldLoad);
  const topTex = useMemo(
    () => tiledClone(surfaceTex, DESK_W / TEXTURE_TILE_METERS, DESK_D / TEXTURE_TILE_METERS),
    [surfaceTex]
  );
  const legTex = useMemo(
    () => tiledClone(surfaceTex, LEG_T / TEXTURE_TILE_METERS, DESK_H / TEXTURE_TILE_METERS),
    [surfaceTex]
  );

  // Where the letter and the sign sit. On the built-in desk that's its own
  // table-top; an uploaded model is drawn from its own origin on the floor,
  // and the letter stays at the built-in height so it never ends up buried
  // inside a model or floating over one — the sign above it does the pointing.
  const topY = DESK_H;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      {modelUrl ? (
        <CustomSceneObject url={modelUrl} />
      ) : (
        <>
          {/* Table top */}
          <mesh position={[0, DESK_H - TOP_T / 2, 0]}>
            <boxGeometry args={[DESK_W, TOP_T, DESK_D]} />
            {/* Keyed on the texture's identity so a fresh material — and
                shader — is built when `map` goes from null to a texture, the
                same reason every other textured surface here is keyed. */}
            <meshStandardMaterial
              key={topTex ? topTex.uuid : "plain"}
              map={topTex ?? undefined}
              color={topTex ? "#ffffff" : WOOD_COLOR}
              roughness={0.75}
            />
          </mesh>
          {/* Legs */}
          {[
            [-DESK_W / 2 + LEG_T, -DESK_D / 2 + LEG_T],
            [DESK_W / 2 - LEG_T, -DESK_D / 2 + LEG_T],
            [-DESK_W / 2 + LEG_T, DESK_D / 2 - LEG_T],
            [DESK_W / 2 - LEG_T, DESK_D / 2 - LEG_T],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, (DESK_H - TOP_T) / 2, lz]}>
              <boxGeometry args={[LEG_T, DESK_H - TOP_T, LEG_T]} />
              <meshStandardMaterial
                key={legTex ? legTex.uuid : "plain"}
                map={legTex ?? undefined}
                color={legTex ? "#ffffff" : WOOD_DARK}
                roughness={0.8}
              />
            </mesh>
          ))}
          {/* Modesty panel — stops the desk reading as a floating slab on
              sticks when seen from the front. */}
          <mesh position={[0, DESK_H * 0.55, -DESK_D / 2 + LEG_T * 0.6]}>
            <boxGeometry args={[DESK_W - LEG_T * 2, DESK_H * 0.34, LEG_T * 0.5]} />
            <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
          </mesh>
        </>
      )}

      {/* The letter, lying on the desk and tilted toward the visitor. Warms
          up in range the same way an artwork's frame border does. */}
      <group position={[0, topY + 0.012, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[ENVELOPE_W, ENVELOPE_H]} />
          <meshStandardMaterial
            color={ENVELOPE_COLOR}
            // The same gold, at the same strength, as the About room's
            // content blocks now light up in — the desk is the one thing in
            // that room a visitor is actually meant to walk up to, so it
            // shouldn't be the faintest thing that reacts to them.
            emissive={active ? INTERACT_GLOW_COLOR : "#000000"}
            emissiveIntensity={active ? 1.1 : 0}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* The flap, as two lines meeting in the middle. */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[ENVELOPE_W * 0.98, 0.006]} />
          <meshBasicMaterial color={ENVELOPE_LINE} />
        </mesh>
        <mesh position={[0, ENVELOPE_H * 0.16, 0.001]} rotation={[0, 0, Math.PI / 5.4]}>
          <planeGeometry args={[ENVELOPE_W * 0.62, 0.005]} />
          <meshBasicMaterial color={ENVELOPE_LINE} />
        </mesh>
        <mesh position={[0, ENVELOPE_H * 0.16, 0.001]} rotation={[0, 0, -Math.PI / 5.4]}>
          <planeGeometry args={[ENVELOPE_W * 0.62, 0.005]} />
          <meshBasicMaterial color={ENVELOPE_LINE} />
        </mesh>
      </group>

      {/* Sign on the wall behind the desk — the only thing that says what
          pressing [E] here will do, so it reads from across the room. */}
      {label.trim() && (
        <Text
          position={[0, topY + 0.62, -DESK_D / 2 + 0.02]}
          fontSize={0.13}
          letterSpacing={0.12}
          maxWidth={DESK_W * 1.6}
          textAlign="center"
          color={active ? "#e8d5a8" : "#c9c0ad"}
          anchorX="center"
          anchorY="middle"
          font={FONT_BOLD}
          material-toneMapped={false}
        >
          {label.toUpperCase()}
        </Text>
      )}
    </group>
  );
}
