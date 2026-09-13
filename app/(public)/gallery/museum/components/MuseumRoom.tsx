"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { MuseumRoomType } from "@/types";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import {
  ROOM_WIDTH,
  ROOM_HEIGHT,
  WALL_THICKNESS,
  DOORWAY_WIDTH,
  DOORWAY_HEIGHT,
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  DEFAULT_CEILING_COLOR,
  TEXTURE_TILE_METERS,
  STAIR_STEP_COUNT,
  getRoomLighting,
} from "./roomConstants";

/**
 * Clones `base` (the one shared texture loaded for this room's surface —
 * loadDownscaledTexture caches/returns the same instance for the same URL,
 * possibly reused across other rooms too) so each wall segment can carry
 * its own `repeat` without stomping every other segment/room sharing that
 * same underlying image. Cheap — a clone shares the already-decoded image,
 * no re-fetch/re-decode — so this runs as a plain function at render time
 * rather than needing its own memoization.
 */
export function tiledClone(base: THREE.Texture | null, repeatX: number, repeatY: number): THREE.Texture | null {
  if (!base) return null;
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

/** Releases the GPU upload behind one tiled clone when that clone is replaced,
 * or when the room unmounts. Deliberately one hook call per clone rather than
 * one effect over all of them — see the call sites in MuseumRoom for why
 * batching them silently disposed textures that were still in use. */
function useDisposeClone(clone: THREE.Texture | null) {
  useEffect(() => {
    return () => {
      clone?.dispose();
    };
  }, [clone]);
}

/** Loads one optional surface texture, gated behind `shouldLoad` the same
 * way ArtworkFrame.tsx's images are — a texture is a real network fetch,
 * unlike the plain hex colors this file used to render exclusively.
 *
 * Exported alongside tiledClone above because the Stories Room's podiums
 * take an admin-uploaded surface texture on exactly the same terms as a
 * wall or floor does (StoryPodium.tsx) — tiled in the same world units, so
 * a stone podium matches the stone floor it stands on. */
export function useSurfaceTexture(url: string | null, shouldLoad: boolean) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url || !shouldLoad) {
      setTexture(null);
      return;
    }
    let cancelled = false;
    loadDownscaledTexture(url)
      .then((loaded) => {
        if (!cancelled) setTexture(loaded.texture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, shouldLoad]);

  return texture;
}

// One room in the museum's connected corridor (see roomLayout.ts) — built
// entirely from primitive geometry, no imported 3D models, per the V1
// scope. Positioned in world space by `centerZ`; north/south walls become a
// real doorway opening (two side posts + a lintel above) instead of a full
// wall whenever this room connects to a neighbor, so a visitor just walks
// through instead of teleporting. East/west walls are always solid — rooms
// only ever chain along Z.
export function MuseumRoom({
  roomType,
  depth,
  centerZ,
  floorYSouth = 0,
  floorYNorth = 0,
  hasNorthOpening,
  hasSouthOpening,
  wallColor = DEFAULT_WALL_COLOR,
  floorColor = DEFAULT_FLOOR_COLOR,
  ceilingColor = DEFAULT_CEILING_COLOR,
  wallTexture = null,
  floorTexture = null,
  ceilingTexture = null,
  darkMode = false,
  brightness = 50,
  lightsEnabled = true,
  quality = "full",
  shouldLoad = true,
}: {
  roomType: MuseumRoomType;
  depth: number;
  centerZ: number;
  /** Floor Y at this room's south/north edge — see roomLayout.ts's RoomLayout.
   * Equal (flat floor, the default) for every room except STAIRS, whose floor
   * ramps between the two. */
  floorYSouth?: number;
  floorYNorth?: number;
  hasNorthOpening: boolean;
  hasSouthOpening: boolean;
  wallColor?: string;
  floorColor?: string;
  /** Previously a hardcoded darkMode-based shade with no admin control at
   * all — now a plain per-room color, same as wall/floor (dark mode still
   * dims it via lighting only, never by touching this value). */
  ceilingColor?: string;
  /** Tiled texture image (concrete, wood, ...) overriding the matching
   * *Color prop above when set — see roomConstants.ts's TEXTURE_TILE_METERS
   * and tiledClone above for how the repeat is computed per surface. */
  wallTexture?: string | null;
  floorTexture?: string | null;
  ceilingTexture?: string | null;
  /** Visitor-toggled ambiance ([L] / the HUD toggle) — dims this room's own lights, see roomConstants.ts. */
  darkMode?: boolean;
  /** Admin-set brightness (0–100, 50 = baseline). Scales all light intensities
   * via getRoomLighting — see DigitalMuseumPanel and museumBrightnessLight/Dark. */
  brightness?: number;
  /** Perf: point lights (the expensive per-fragment ones) only render for
   * the room the visitor is in/near — see MuseumScene.tsx's nearbyRoomIds.
   * Ambient/hemisphere stay on regardless so a distant room never goes
   * pitch black when glimpsed through a doorway. */
  lightsEnabled?: boolean;
  /** Perf: halves the point-light count in the room actually being stood
   * in when PerformanceMonitor detects the device is struggling — see
   * MuseumScene.tsx's lowPower state. */
  quality?: "full" | "low";
  /** Perf: same idea as ArtworkFrame.tsx's shouldLoad — walls/floor/ceiling
   * always render in their plain color, but a wall/floor/ceiling *texture*
   * only fetches once this room is nearby. */
  shouldLoad?: boolean;
}) {
  const lighting = getRoomLighting(roomType, darkMode, brightness);
  const width = ROOM_WIDTH;
  // Only ever non-zero for the STAIRS room (see roomLayout.ts) — every
  // formula below reduces to the original flat-room math when rise is 0,
  // so this doesn't need to branch the whole component into two versions.
  const rise = floorYNorth - floorYSouth;
  const slopeAngle = Math.atan2(rise, depth);
  const slopeLength = Math.hypot(depth, rise);
  const wallHeight = ROOM_HEIGHT + rise;

  const wallTex = useSurfaceTexture(wallTexture, shouldLoad);
  const floorTex = useSurfaceTexture(floorTexture, shouldLoad);
  const ceilingTex = useSurfaceTexture(ceilingTexture, shouldLoad);

  const sidePostWidth = (width - DOORWAY_WIDTH) / 2;
  const sidePostOffsetX = (width + DOORWAY_WIDTH) / 4;
  const lintelHeight = ROOM_HEIGHT - DOORWAY_HEIGHT;
  const wallRepeatY = ROOM_HEIGHT / TEXTURE_TILE_METERS;

  // Pre-compute tiled texture clones once per texture/size change rather than
  // on every render frame. Previously `tiledClone` was called inline during
  // render, which created a brand-new THREE.Texture object (with
  // needsUpdate=true) every single frame — causing a GPU texture re-upload
  // each frame, leading to white flashes and inconsistent rendering. Memoized
  // clones are stable objects that the GPU only uploads when the base texture
  // or repeat dimensions actually change.
  const wallTexFull      = useMemo(() => tiledClone(wallTex, width / TEXTURE_TILE_METERS, wallRepeatY), [wallTex, width, wallRepeatY]);
  const wallTexSidePost  = useMemo(() => tiledClone(wallTex, sidePostWidth / TEXTURE_TILE_METERS, wallRepeatY), [wallTex, sidePostWidth, wallRepeatY]);
  const wallTexLintel    = useMemo(() => tiledClone(wallTex, DOORWAY_WIDTH / TEXTURE_TILE_METERS, lintelHeight / TEXTURE_TILE_METERS), [wallTex, lintelHeight]);
  // East/West walls run along depth (Z), not width (X).
  const wallTexSide      = useMemo(() => tiledClone(wallTex, depth / TEXTURE_TILE_METERS, wallRepeatY), [wallTex, depth, wallRepeatY]);
  const floorTexClone    = useMemo(() => tiledClone(floorTex, width / TEXTURE_TILE_METERS, depth / TEXTURE_TILE_METERS), [floorTex, width, depth]);
  const ceilingTexClone  = useMemo(() => tiledClone(ceilingTex, width / TEXTURE_TILE_METERS, depth / TEXTURE_TILE_METERS), [ceilingTex, width, depth]);

  // Each clone above is its own GPU upload of the shared image (three gives a
  // clone a fresh uuid, so WebGLTextures can't dedupe it against the base).
  // Nothing was releasing them: every texture swap, every room the editor
  // switches to and every corridor remount left the old uploads resident. A
  // long museum session or a few passes through the Scene Editor could walk
  // the GPU into memory pressure, at which point the driver starts dropping
  // textures and surfaces render flat — the same "sometimes textured,
  // sometimes not" symptom a failed fetch produces. Disposing only the clones
  // is safe: the base texture stays in loadDownscaledTexture's cache, shared
  // with every other room using that image.
  //
  // One effect per clone, deliberately — NOT a single effect over all six.
  // Batching them put every clone in one dependency array, so the arrival of
  // *any* one texture re-ran the effect and its cleanup disposed the whole
  // previous set, including the clones that hadn't changed and were still
  // bound as material maps. Wall, floor and ceiling images resolve as three
  // independent fetches, so in practice the last one to land disposed the
  // ones that had already arrived: the floor went flat the moment the wall
  // finished, and only a remount (walking to another room and back) restored
  // it. That is why an uploaded floor showed in the live corridor but never
  // in the Scene Editor, where all three load at once behind `shouldLoad`.
  useDisposeClone(wallTexFull);
  useDisposeClone(wallTexSidePost);
  useDisposeClone(wallTexLintel);
  useDisposeClone(wallTexSide);
  useDisposeClone(floorTexClone);
  useDisposeClone(ceilingTexClone);

  // Renders either one full wall, or (when this side has a doorway) two
  // side posts flanking the opening plus a lintel above it. Uses the
  // pre-computed memoized texture clones (above) so no new GPU object is
  // created mid-render.
  // `baseY` is the floor level at this wall's own end of the room — 0 at
  // the south end, `rise` at the north end (equal, both 0, for every
  // ordinary flat room). Lets one Wall() serve both ends of a sloped
  // STAIRS room without a separate sloped-wall variant.
  //
  // `z` is this room's own boundary Z (±depth/2) — but at every *internal*
  // boundary, the next/previous room's own wall sits at that exact same
  // world Z too (this room's northZ === the next room's southZ, see
  // roomLayout.ts). A box centered exactly on a shared boundary way
  // straddles into the neighboring room's footprint, so two rooms each
  // rendering their own wall there used to produce two fully-coincident,
  // differently colored/textured planes — real z-fighting, which read as
  // "the doorway-facing wall got taken by the other room, only 3 of my 4
  // sides show my texture." Insetting this wall by half its own thickness,
  // toward this room's own interior, keeps its whole footprint inside this
  // room instead — the two rooms' walls now sit back-to-back rather than
  // overlapping, each fully showing its own room's material.
  function Wall({ z, hasOpening, baseY }: { z: number; hasOpening: boolean; baseY: number }) {
    const insetZ = z - Math.sign(z) * (WALL_THICKNESS / 2);
    const lintelCenterY = baseY + DOORWAY_HEIGHT + lintelHeight / 2;
    if (!hasOpening) {
      return (
        <mesh position={[0, baseY + ROOM_HEIGHT / 2, insetZ]} receiveShadow>
          <boxGeometry args={[width, ROOM_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={wallTex ? "#ffffff" : wallColor}
            map={wallTexFull}
            roughness={0.9}
          />
        </mesh>
      );
    }

    return (
      <group>
        <mesh position={[-sidePostOffsetX, baseY + ROOM_HEIGHT / 2, insetZ]} receiveShadow>
          <boxGeometry args={[sidePostWidth, ROOM_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={wallTex ? "#ffffff" : wallColor}
            map={wallTexSidePost}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[sidePostOffsetX, baseY + ROOM_HEIGHT / 2, insetZ]} receiveShadow>
          <boxGeometry args={[sidePostWidth, ROOM_HEIGHT, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={wallTex ? "#ffffff" : wallColor}
            map={wallTexSidePost}
            roughness={0.9}
          />
        </mesh>
        <mesh position={[0, lintelCenterY, insetZ]} receiveShadow>
          <boxGeometry args={[DOORWAY_WIDTH, lintelHeight, WALL_THICKNESS]} />
          <meshStandardMaterial
            color={wallTex ? "#ffffff" : wallColor}
            map={wallTexLintel}
            roughness={0.9}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, floorYSouth, centerZ]}>
      {/* Floor — a flat plane for every ordinary room. For STAIRS (rise !== 0)
          this renders actual solid ascending steps instead of a smooth ramp
          — STAIR_STEP_COUNT blocks, each one step's rise taller than the
          last, climbing from y=0 at the south edge to y=rise at the north
          edge. Purely visual: PlayerControls.tsx's walking motion stays a
          smooth interpolated ramp regardless (getFloorYAt in roomLayout.ts)
          — only the floor mesh itself is stepped. */}
      {rise !== 0 ? (
        Array.from({ length: STAIR_STEP_COUNT }, (_, i) => {
          const stepDepth = depth / STAIR_STEP_COUNT;
          // i=0 is the southmost (lowest) step, riser height grows by one
          // increment per step until the last step tops out at `rise`.
          const stepTopY = ((i + 1) / STAIR_STEP_COUNT) * rise;
          const stepZ = depth / 2 - (i + 0.5) * stepDepth;
          return (
            <mesh key={i} position={[0, stepTopY / 2, stepZ]} receiveShadow>
              <boxGeometry args={[width, stepTopY, stepDepth]} />
              <meshStandardMaterial
                color={floorTex ? "#ffffff" : floorColor}
                map={floorTexClone}
                roughness={0.85}
                metalness={0}
              />
            </mesh>
          );
        })
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            color={floorTex ? "#ffffff" : floorColor}
            map={floorTexClone}
            roughness={0.85}
            metalness={0}
          />
        </mesh>
      )}

      {/* Ceiling — parallel to the floor, offset up by ROOM_HEIGHT throughout
          so headroom stays constant along the slope. Sign is `+ slopeAngle`
          here (not `-`, which was the original bug) — flip it and the
          ceiling's south/north edges land on the *wrong* heights (high
          over the low end, low over the high end), which both leaves a
          gap where the void shows through as a black patch partway up the
          room and pinches the headroom near the doorway into the Second
          Floor down to almost nothing. `+` keeps this parallel to the
          floor at every point along the slope, exactly ROOM_HEIGHT above
          it, same as a flat room's uniform ceiling height. */}
      <mesh rotation={[Math.PI / 2 + slopeAngle, 0, 0]} position={[0, rise / 2 + ROOM_HEIGHT, 0]}>
        <planeGeometry args={[width, slopeLength]} />
        <meshStandardMaterial
          color={ceilingTex ? "#ffffff" : ceilingColor}
          map={ceilingTexClone}
          roughness={1}
        />
      </mesh>

      {/* North/south walls — every *internal* boundary is two rooms sharing
          the exact same world Z (this room's northZ === the next room's
          southZ, see roomLayout.ts). Both always render now (nothing
          skipped — an earlier version of this fix skipped one side and
          relied on the neighbor's own wall to draw that boundary instead,
          which broke the Museum Scene Editor's isolated single-room
          preview, where no such neighbor is ever rendered to fill the
          gap). Wall()'s own insetZ keeps each side fully inside its own
          room instead, so the two rooms' walls sit back-to-back rather
          than overlapping — see that function's doc comment. */}
      <Wall z={-depth / 2} hasOpening={hasNorthOpening} baseY={rise} />
      <Wall z={depth / 2} hasOpening={hasSouthOpening} baseY={0} />

      {/* East wall (+X) — always solid, rooms never chain sideways, so
          there's no neighbor to inset away from the way north/south do —
          insetting it anyway (same half-WALL_THICKNESS, toward the room's
          own interior) keeps FRAME_WALL_OFFSET's clearance math (see
          roomConstants.ts) the same real distance from every one of a
          room's 4 walls instead of just 3 of them. Tall enough to enclose
          the full rise + ROOM_HEIGHT range so it never clips the sloped
          floor/ceiling above (reduces to plain ROOM_HEIGHT when rise is 0). */}
      <mesh position={[width / 2 - WALL_THICKNESS / 2, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, wallHeight, depth]} />
        <meshStandardMaterial
          color={wallTex ? "#ffffff" : wallColor}
          map={wallTexSide}
          roughness={0.9}
        />
      </mesh>

      {/* West wall (-X) */}
      <mesh position={[-width / 2 + WALL_THICKNESS / 2, wallHeight / 2, 0]} receiveShadow>
        <boxGeometry args={[WALL_THICKNESS, wallHeight, depth]} />
        <meshStandardMaterial
          color={wallTex ? "#ffffff" : wallColor}
          map={wallTexSide}
          roughness={0.9}
        />
      </mesh>

      {/* Lighting — soft ambient fill plus a few ceiling spots for a gallery
          feel, cheap enough to not need baked lightmaps. Spot count scales
          with this room's own depth so a long Main Hall isn't left dim in
          the middle. Ambient/hemisphere are uniform (cheap, one calc for
          the whole room) so they always render; the point lights are the
          real per-fragment cost — see lightsEnabled/quality above. */}
      <ambientLight intensity={lighting.ambientIntensity} />
      <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemiIntensity]} />
      {lightsEnabled &&
        // "low" quality centers one light per Z-row instead of the usual
        // 2x2 grid — halves the point-light count in whichever room a
        // struggling device is actually standing in.
        [-depth / 4, depth / 4].flatMap((z) =>
          (quality === "low" ? [0] : [-width / 4, width / 4]).map((x) => (
            <pointLight
              key={`${x}-${z}`}
              position={[x, ROOM_HEIGHT - 0.4, z]}
              intensity={lighting.pointIntensity}
              distance={14}
              decay={2}
              color={lighting.pointColor}
            />
          ))
        )}
    </group>
  );
}
