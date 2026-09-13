"use client";

// app/(admin)/admin/artworks/museum-editor/[roomId]/MuseumEditorScene.tsx
//
// The actual Three.js content for the Museum Scene Editor — only ever
// loaded client-side via MuseumEditorClient.tsx's next/dynamic({ ssr:
// false }), so three/@react-three/* stay out of the server bundle exactly
// like the public museum. Reuses MuseumRoom.tsx for the shell (a single
// room, real doorway state passed in — this is a placement tool, not a
// walkthrough), CustomSceneObject.tsx for scene objects, and
// ArtworkFrame.tsx for artwork frames, so both editor and public rendering
// always look identical.
import { useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TransformControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";
import { MuseumRoom } from "@/app/(public)/gallery/museum/components/MuseumRoom";
import { WallDivider } from "@/app/(public)/gallery/museum/components/WallDivider";
import { DIVIDER_KIND, parseWallDividerConfig } from "@/lib/museum/wallDivider";
import { BANNER_KIND, bannerWidth, bannerFinish, parseSceneBannerConfig } from "@/lib/museum/sceneBanner";
import { SceneBanner } from "@/app/(public)/gallery/museum/components/SceneBanner";
import { CustomSceneObject, type ModelFit } from "@/app/(public)/gallery/museum/components/CustomSceneObject";
import { ContactDesk } from "@/app/(public)/gallery/museum/components/ContactDesk";
import { WallClock } from "@/app/(public)/gallery/museum/components/WallClock";
import { ArtworkFrame } from "@/app/(public)/gallery/museum/components/ArtworkFrame";
import { StoryPodium } from "@/app/(public)/gallery/museum/components/StoryPodium";
import { ArcadeCabinet } from "@/app/(public)/gallery/museum/components/ArcadeCabinet";
import { CosplayStandee } from "@/app/(public)/gallery/museum/components/CosplayStandee";
import type { LightsAnimation, LightsStyle } from "@/lib/museum/cosplayStandee";
import type { RoomBannerStyle } from "@/lib/museum/roomBanner";
import { ArcadePoster } from "@/app/(public)/gallery/museum/components/ArcadePoster";
import { AboutRoomContents } from "@/app/(public)/gallery/museum/components/AboutRoomContents";
import { StickyNote3D, FreedomWallPlaque } from "@/app/(public)/gallery/museum/components/FreedomWallRoomContents";
import {
  resolveNoteWallSegment,
  notePercentToWorld,
  noteFreeValueToPercentX,
  noteWorldYToPercentY,
} from "@/lib/museum/freedomWallNotePlacement";
import { getRoomSize, ROOM_HEIGHT, ROOM_WIDTH, RISE, SCENE_BACKGROUND_DARK, SCENE_BACKGROUND_LIGHT, colliderWorldRadius, colliderWorldOffset, colliderWorldHeight, colliderWorldBaseY } from "@/app/(public)/gallery/museum/components/roomConstants";
import { backdropDistance } from "@/app/(public)/gallery/museum/components/standeePlacement";
import {
  ABOUT_BLOCK_LABEL,
  ABOUT_PHOTO_KIND,
  ABOUT_PLAQUE_KIND,
  ABOUT_CERTS_KIND,
  ABOUT_CARD_KIND,
  ABOUT_GIGS_KIND,
  getAboutBlockAnchor,
  ABOUT_CONTACT_KIND,
  ABOUT_CLOCK_KIND,
  parseContactDeskConfig,
  parseWallClockConfig,
  rotYToWall,
  parsePlaqueConfig,
  parseAboutLabelConfig,
  parseCertPlacements,
  defaultAboutLabelConfig,
  type AboutBlockOffsets,
  type AboutBlockMeta,
  type AboutBlockKind,
} from "@/lib/museum/aboutRoomBlocks";
import type { FreedomWallNotePublic, MuseumRoomType, MuseumArtwork, MuseumAboutData } from "@/types";
import { parseTextConfig } from "@/lib/museum/aboutRoomBlocks";
import { FREEDOM_WALL_BANNER_KIND, parseBannerColors } from "@/lib/museum/freedomWallBanner";
import type { SceneMode, SceneObject, EditableArtworkItem, EditablePodiumItem, EditableCabinetItem, EditableStandeeItem } from "./MuseumEditorClient";

// How far an object has been turned around the vertical axis — the one
// rotation anything in this editor is allowed, and the number every drag
// handler below stores.
//
// Reading `object.rotation.y` gets this wrong past a quarter turn, which is
// why it isn't read here. TransformControls turns things by writing a
// *quaternion*, and three.js decomposes that into the default XYZ Euler
// order, where the middle angle comes out of an `asin` and so can only ever
// land in ±90°: a 135° turn about Y decomposes to (180°, 45°, 180°), and a
// half turn to (180°, 0°, 180°). Both look right on screen — they are the
// same orientation — but `.y` reads 45° and 0°.
//
// Storing that folded number is what made a prop that had been turned past
// 90° in the editor face a different way in the museum: the gizmo's own
// mutation was the last thing to touch the object, so the editor kept
// showing the true angle while the database got the folded one. A YXZ Euler
// puts the yaw first, where it comes out of an `atan2` and covers the whole
// ±180° turn.
const yawEuler = new THREE.Euler(0, 0, 0, "YXZ");
function readYaw(node: THREE.Object3D): number {
  return yawEuler.setFromQuaternion(node.quaternion).y;
}

// A small floating select-handle label for the About room's movable
// content blocks (Photo / Plaque / Certs / Calling Card / Timeline & Gigs)
// — the *actual* content renders underneath via AboutRoomContents (see
// MuseumEditorScene below), so this only needs to mark a clickable spot,
// not stand in for content that's now genuinely visible. Wireframe-only and
// offset above the real content (not a filled box in front of it) so it
// never blocks the real preview it's labeling — a filled placeholder here
// is exactly what read as clutter before real content existed to compare
// it against.
function AboutBlockPlaceholder({ kind }: { kind: AboutBlockKind }) {
  return (
    <group position={[0, 1.2, 0]}>
      <mesh>
        <boxGeometry args={[1.2, 0.5, 0.4]} />
        <meshBasicMaterial color="#ff3b30" wireframe />
      </mesh>
      <Text position={[0, 0, 0.21]} fontSize={0.13} maxWidth={1.1} textAlign="center" color="#ff3b30" anchorX="center" anchorY="middle">
        {ABOUT_BLOCK_LABEL[kind]}
      </Text>
    </group>
  );
}

interface RoomShell {
  roomType: MuseumRoomType;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
}

interface OpeningFlags {
  hasNorthOpening: boolean;
  hasSouthOpening: boolean;
}


// A near-complete-enough MuseumArtwork stand-in for ArtworkFrame.tsx's own
// prop type — the editor only ever needs the image to actually render, not
// price/medium/etc., but ArtworkFrame doesn't care about those either.
function toPreviewArtwork(item: { title: string; imageUrl: string }): MuseumArtwork {
  return {
    id: "preview",
    title: item.title,
    description: "",
    imageUrl: item.imageUrl,
    videoUrl: null,
    slug: null,
    medium: null,
    dimensions: null,
    year: null,
    status: "AVAILABLE",
    product: null,
  };
}

function EditableSceneObject({
  object,
  selected,
  mode,
  onSelect,
  onChange,
  onInteractionStart,
  setOrbitEnabled,
  onMeasure,
  anchor = [0, 0, 0],
  anchorIsAbsolute = false,
  proxyScale = 1,
  allowTransform = true,
  freedomWallEventTitle = null,
}: {
  object: SceneObject;
  selected: boolean;
  mode: SceneMode;
  onSelect: () => void;
  onChange: (patch: Partial<SceneObject>) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  /** When false, no TransformControls gizmo is attached even while selected
   *  — the object is still positioned (via `anchor`) and clickable. Used
   *  for About-room blocks, which are placed by the side panel only. */
  allowTransform?: boolean;
  /** When true, `anchor` IS the full room-local position — object.positionX/
   *  Y/Z are ignored (they mean along-wall / height, already folded in).
   *  Used for About-room blocks. */
  anchorIsAbsolute?: boolean;
  /** Extra scale applied to the placeholder proxy so it tracks an About
   *  block's Resize. */
  proxyScale?: number;
  /** Reports the loaded model's auto-measured footprint radius (model units)
   *  up to MuseumEditorClient — only fired for kind "custom". `fit` is the
   *  circle that actually wraps the geometry (centre + half-width), which is
   *  what the side panel's "Fit to model" writes. */
  onMeasure?: (id: string, nativeRadius: number, nativeSpan: number, fit: ModelFit) => void;
  /** World offset added on top of object.positionX/Y/Z for display, and
   * subtracted back off on drag — only non-zero for the About room's 3
   * movable blocks, whose stored position is a *delta* from this anchor
   * rather than an absolute placement (see lib/museum/aboutRoomBlocks.ts).
   * Custom objects use [0,0,0], making this a no-op for them. */
  anchor?: [number, number, number];
  /** Only meaningful for the Freedom Wall banner (FREEDOM_WALL_BANNER_KIND)
   *  — its blank-text fallback (see lib/museum/freedomWallBanner.ts). */
  freedomWallEventTitle?: string | null;
}) {
  // A callback ref (not useRef) so selecting this object re-renders once
  // the group actually exists — TransformControls needs a real mounted
  // Object3D to attach to, and a plain ref's `.current` becoming non-null
  // doesn't trigger a re-render on its own.
  const [node, setNode] = useState<THREE.Group | null>(null);
  // Auto-measured footprint of the loaded .glb (model units, before scale).
  // Feeds the Solid-collider ring below and, via onMeasure, the side panel's
  // "auto-fit" default.
  const [measured, setMeasured] = useState<number | null>(null);
  const handleMeasure = useCallback(
    (r: number, span: number, fit: ModelFit) => {
      setMeasured(r);
      onMeasure?.(object.id, r, span, fit);
    },
    [onMeasure, object.id]
  );

  // World-space radius of the Solid collision footprint — the stored
  // override if set, otherwise the auto-measured value, scaled by the
  // prop's own size. Mirrors MuseumScene.tsx's customObstacles math (both go
  // through the same helper, so the ring drawn here and the circle a visitor
  // is actually kept out of cannot drift apart).
  const ringRadius = colliderWorldRadius(object.colliderRadius ?? measured, object.scale);
  // ...and where it sits. Local to this object's own group, which already
  // carries its rotation, so the ring turns with the prop exactly the way
  // the public museum's rotated obstacle does.
  const ringOffsetX = colliderWorldOffset(object.colliderOffsetX, object.scale);
  const ringOffsetZ = colliderWorldOffset(object.colliderOffsetZ, object.scale);
  // ...and how tall it stands, or null for the floor-to-ceiling column that
  // is still the default. A ring alone can't tell those two apart, which is
  // the whole thing the Collision Height slider is adjusting — so a prop with
  // a height gets a translucent cylinder showing the volume, with the ring
  // kept underneath it as the footprint it has always been.
  const ringHeight = colliderWorldHeight(object.colliderHeight, object.scale);
  // How far the blocked volume is lifted off the prop's base. Only meaningful
  // alongside a height — with no height there is no column to lift, just the
  // floor-to-ceiling default — so the ring drops back to the floor whenever
  // Collision Height is off, matching what the museum will actually do.
  const ringBaseY = ringHeight == null ? 0 : colliderWorldBaseY(object.colliderBaseY, object.scale);

  return (
    <>
      <group
        ref={setNode}
        position={
          anchorIsAbsolute
            ? anchor
            : [object.positionX + anchor[0], object.positionY + anchor[1], object.positionZ + anchor[2]]
        }
        rotation={[0, object.rotationY, 0]}
        scale={proxyScale}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {object.kind === "custom" && object.modelUrl && (
          <CustomSceneObject url={object.modelUrl} scale={object.scale} onMeasure={handleMeasure} />
        )}
        {object.kind === "custom" && object.solid && (
          // The collision footprint a visitor is kept out of in the public
          // museum. Shown for every solid prop so the admin can see them
          // all at a glance; brighter for the selected one.
          // Drawn at the column's own base rather than always on the floor:
          // the ring is where the blocking *starts*, and for a lifted collider
          // (an archway's crossbeam, a hanging lamp) that is above the ground.
          // A ring left on the floor under a raised column would show the
          // admin a footprint the visitor can walk straight through.
          <mesh position={[ringOffsetX, ringBaseY + 0.03, ringOffsetZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[Math.max(0.02, ringRadius - 0.06), ringRadius, 64]} />
            <meshBasicMaterial
              color="#e0654f"
              transparent
              opacity={selected ? 0.85 : 0.35}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        {object.kind === "custom" && object.solid && ringHeight != null && (
          // The blocked volume, standing on that footprint. Open-ended and
          // barely there so it reads as a boundary over the model rather than
          // hiding it; `depthWrite={false}` keeps it from punching a hole in
          // whatever is drawn behind it.
          <mesh
            position={[ringOffsetX, ringBaseY + ringHeight / 2, ringOffsetZ]}
            raycast={() => null}
          >
            <cylinderGeometry args={[ringRadius, ringRadius, ringHeight, 48, 1, true]} />
            <meshBasicMaterial
              color="#e0654f"
              transparent
              opacity={selected ? 0.22 : 0.1}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}
        {object.kind === DIVIDER_KIND && (
          // The real wall, not a proxy box — the admin is dragging and sizing
          // the thing a visitor will actually be stopped by. Position and
          // rotation come from the wrapping <group>, so it renders flush at
          // its own local origin.
          <WallDivider config={parseWallDividerConfig(object.modelUrl)} shouldLoad />
        )}
        {object.kind === "text" && (() => {
          const cfg = parseTextConfig(object.modelUrl);
          return (
            <Text
              fontSize={cfg.fontSize}
              maxWidth={cfg.maxWidth}
              color={cfg.color}
              font={cfg.fontFamily}
              anchorX="center"
              anchorY="middle"
              textAlign="center"
            >
              {cfg.text}
            </Text>
          );
        })()}
        {object.kind === BANNER_KIND && (() => {
          // The real plaque, not a proxy — the admin is dragging and colouring
          // exactly what a visitor will see. Position/rotation come from the
          // wrapping <group>, so this renders flush at its own local origin.
          const cfg = parseSceneBannerConfig(object.modelUrl);
          return (
            <SceneBanner
              text={cfg.text}
              eyebrow={cfg.eyebrow}
              width={bannerWidth(cfg, ROOM_WIDTH)}
              height={cfg.height}
              finish={bannerFinish(cfg)}
              textColor={cfg.textColor}
              fontFamily={cfg.fontFamily}
              fontSize={cfg.fontSize}
              position={[0, 0, 0]}
            />
          );
        })()}
        {object.kind === FREEDOM_WALL_BANNER_KIND && (
          // Position/rotation are already applied by the wrapping <group>
          // above, so this renders flush at its own local origin.
          <FreedomWallPlaque
            title={freedomWallEventTitle ?? "Freedom Wall"}
            colors={parseBannerColors(object.modelUrl)}
            position={[0, 0, 0]}
          />
        )}
        {(object.kind === ABOUT_PHOTO_KIND || object.kind === ABOUT_PLAQUE_KIND || object.kind === ABOUT_CERTS_KIND || object.kind === ABOUT_CARD_KIND || object.kind === ABOUT_GIGS_KIND) && (
          <AboutBlockPlaceholder kind={object.kind} />
        )}
        {object.kind === ABOUT_CONTACT_KIND && (() => {
          // The real desk, not a proxy box: it is dragged and turned like any
          // decorative prop, so the admin should be moving the thing itself.
          // Position/rotation come from the wrapping <group>, so this renders
          // flush at its own local origin.
          //
          // `scale` is passed here rather than left to the group: the group
          // only ever carries `proxyScale`, which is 1 for the desk (it isn't
          // one of the About *blocks*). Without this the Size slider moved a
          // value that the editor never drew — the desk previewed at 100% no
          // matter where the slider sat, while the public museum applied it
          // for real (AboutRoomContents passes contact.scale straight
          // through), so an uploaded .glb that looked right here came out
          // enormous or tiny in the actual room.
          const cfg = parseContactDeskConfig(object.modelUrl);
          return (
            <ContactDesk
              position={[0, 0, 0]}
              rotationY={0}
              scale={object.scale ?? 1}
              shouldLoad
              label={cfg.title}
              modelUrl={cfg.url}
              textureUrl={cfg.textureUrl}
            />
          );
        })()}
        {object.kind === ABOUT_CLOCK_KIND && (
          // The real clock, ticking, so the admin is dragging and sizing the
          // thing itself — and can see at a glance that a colour or a format
          // choice reads from where it will actually hang. Position, rotation
          // and scale all come from the wrapping <group>.
          <group scale={object.scale ?? 1}>
            <WallClock config={parseWallClockConfig(object.modelUrl)} />
          </group>
        )}
      </group>
      {selected && node && allowTransform && (
        <TransformControls
          object={node}
          mode={mode}
          // Snap manual rotation to 15° steps. Free-dragging the ring made
          // it almost impossible to land a model square to a wall — the
          // handle would drift a fraction of a degree off and stay there.
          // 15° divides evenly into the N/S/E/W angles (0, ±90°, 180°) the
          // side panel's Facing buttons use, so the gizmo and the buttons
          // agree. Ignored in translate mode.
          rotationSnap={Math.PI / 12}
          // Y is draggable in both modes now — translate moves it up/down
          // (a decorative prop no longer has to sit exactly on the floor,
          // and an About-room block can be lifted off its default height),
          // rotate spins it in place around the vertical axis, the only
          // rotation that makes sense for a floor-anchored object. X/Z
          // stay hidden in rotate mode — tipping an object sideways isn't
          // a real use case here.
          showX={mode === "translate"}
          showY
          showZ={mode === "translate"}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => setOrbitEnabled(true)}
          onObjectChange={() => {
            onChange({
              positionX: node.position.x - anchor[0],
              positionY: node.position.y - anchor[1],
              positionZ: node.position.z - anchor[2],
              rotationY: readYaw(node),
            });
          }}
        />
      )}
    </>
  );
}

// How close (in world units) a dragged artwork's position needs to land to
// another artwork's before it's treated as "aligned" — snaps to the exact
// match and shows a guide line, Figma/Photoshop-style, rather than making
// the admin eyeball pixel-perfect placement by hand.
const SNAP_THRESHOLD = 0.12;
// How far a guide line extends past the two aligned artworks, so it reads
// as a ruler through both rather than a stub touching only one.
const GUIDE_REACH = 3;

function EditableArtwork({
  item,
  selected,
  onSelect,
  onChangePosition,
  onInteractionStart,
  setOrbitEnabled,
  allItems,
}: {
  item: EditableArtworkItem;
  selected: boolean;
  onSelect: () => void;
  onChangePosition: (patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  /** Every artwork in the room (including this one) — compared against
   * during drag to detect height/along-wall alignment matches. */
  allItems: EditableArtworkItem[];
}) {
  const [node, setNode] = useState<THREE.Group | null>(null);
  // Wall-snapped drag: only one of X/Z is ever draggable, whichever is
  // this frame's current *free* axis — north/south walls run along world
  // X (their own fixed coordinate is Z), east/west walls run along world Z
  // (fixed coordinate X). Rotation stays fixed to whichever wall it's on;
  // switching walls is the side panel's job (the wall picker), not this
  // gizmo's. Y (hung height) is always free, independent of which wall
  // it's on.
  const onFreeXAxis = Math.abs(Math.cos(item.rotationY)) > 0.5;
  // ...as long as the wall it hangs on IS one of the room's, which are all
  // squared to the world axes. A divider can stand at any angle, and locking
  // its frames to a single world axis would drag them off the panel's face
  // sideways — so an off-axis frame gets both handles and free placement,
  // the admin's eye doing the job the axis lock does elsewhere.
  const axisAligned = Math.abs(Math.sin(2 * item.rotationY)) < 0.01;
  // Active alignment matches for the guide lines below — cleared whenever
  // there's no match in range, and always reset on mouse-up so a stale
  // guide never lingers after the drag that produced it ends.
  const [guide, setGuide] = useState<{ y: number | null; free: number | null }>({ y: null, free: null });

  return (
    <>
      <group
        ref={setNode}
        position={[item.positionX, item.positionY, item.positionZ]}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <ArtworkFrame
          artwork={toPreviewArtwork(item)}
          placement={{ position: [0, 0, 0], rotationY: 0, wallNormal: [0, 0, 1], maxWidth: 3.3 }}
          active={selected}
          scale={item.scale}
          shouldLoad
        />
      </group>
      {selected && node && (
        <TransformControls
          object={node}
          mode="translate"
          showX={!axisAligned || onFreeXAxis}
          showY
          showZ={!axisAligned || !onFreeXAxis}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => {
            setOrbitEnabled(true);
            setGuide({ y: null, free: null });
          }}
          onObjectChange={() => {
            const others = allItems.filter((o) => o.id !== item.id);

            // Height (Y) alignment — matches against every other artwork in
            // the room, wall doesn't matter, a shelf line can run the whole
            // gallery.
            let yGuide: number | null = null;
            for (const other of others) {
              if (Math.abs(other.positionY - node.position.y) <= SNAP_THRESHOLD) {
                node.position.y = other.positionY;
                yGuide = other.positionY;
                break;
              }
            }

            // Along-wall alignment — only meaningful against artworks on
            // the SAME wall (matching rotation), since the free axis is a
            // different physical direction on every other wall.
            const freeValue = onFreeXAxis ? node.position.x : node.position.z;
            let freeGuide: number | null = null;
            for (const other of others) {
              if (Math.abs(other.rotationY - item.rotationY) > 0.01) continue;
              const otherFree = onFreeXAxis ? other.positionX : other.positionZ;
              if (Math.abs(otherFree - freeValue) <= SNAP_THRESHOLD) {
                if (onFreeXAxis) node.position.x = otherFree;
                else node.position.z = otherFree;
                freeGuide = otherFree;
                break;
              }
            }

            setGuide({ y: yGuide, free: freeGuide });
            onChangePosition({
              positionX: node.position.x,
              positionY: node.position.y,
              positionZ: node.position.z,
              rotationY: readYaw(node),
            });
          }}
        />
      )}
      {/* Horizontal guide — a matched hang height, drawn as a ruler running
          along the wall through both aligned frames. */}
      {selected && node && guide.y !== null && (
        <Line
          points={
            onFreeXAxis
              ? [
                  [node.position.x - GUIDE_REACH, guide.y, node.position.z],
                  [node.position.x + GUIDE_REACH, guide.y, node.position.z],
                ]
              : [
                  [node.position.x, guide.y, node.position.z - GUIDE_REACH],
                  [node.position.x, guide.y, node.position.z + GUIDE_REACH],
                ]
          }
          color="#f5c66b"
          lineWidth={1.5}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      )}
      {/* Vertical guide — a matched along-wall position, drawn floor-to-
          ceiling at the aligned spot. */}
      {selected && node && guide.free !== null && (
        <Line
          points={
            onFreeXAxis
              ? [
                  [guide.free, 0, node.position.z],
                  [guide.free, ROOM_HEIGHT, node.position.z],
                ]
              : [
                  [node.position.x, 0, guide.free],
                  [node.position.x, ROOM_HEIGHT, guide.free],
                ]
          }
          color="#f5c66b"
          lineWidth={1.5}
          dashed
          dashSize={0.12}
          gapSize={0.08}
        />
      )}
    </>
  );
}

// A single sticky note, made draggable/selectable exactly like
// EditableArtwork above — same "outer draggable group wraps the real,
// unmodified rendering component" pattern. Wall-snapped the same way too:
// only the wall's own free axis (world X for north/south, world Z for
// east/west — see resolveNoteWallSegment's `seg.fixedAxis`) is draggable, so
// a note can't be pulled off the wall it's pinned to mid-drag. Switching
// which wall it's on is the side panel's Wall picker, not this gizmo.
function EditableStickyNote({
  note,
  selected,
  onSelect,
  onChangePosition,
  onInteractionStart,
  setOrbitEnabled,
  depth,
  hasNorthOpening,
  hasSouthOpening,
}: {
  note: FreedomWallNotePublic;
  selected: boolean;
  onSelect: () => void;
  onChangePosition: (patch: { positionX: number; positionY: number }) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  depth: number;
  hasNorthOpening: boolean;
  hasSouthOpening: boolean;
}) {
  const [node, setNode] = useState<THREE.Group | null>(null);
  const geometry = { depth, hasNorthOpening, hasSouthOpening };
  const { position, rotationY } = notePercentToWorld(note, geometry);
  // Resolved once per render (not re-derived every drag frame) — which
  // segment a note is "on" only ever changes via the Wall picker, which
  // already snapshots/reselects, so this stays correct through a drag.
  const { segments, segmentIndex, seg } = resolveNoteWallSegment(note, geometry);
  const onFreeXAxis = seg.fixedAxis === "z";

  return (
    <>
      <group
        ref={setNode}
        position={position}
        rotation={[0, rotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <StickyNote3D note={note} position={[0, 0, 0]} scale={note.scale} />
      </group>
      {selected && node && (
        <TransformControls
          object={node}
          mode="translate"
          showX={onFreeXAxis}
          showY
          showZ={!onFreeXAxis}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => setOrbitEnabled(true)}
          onObjectChange={() => {
            const freeValue = onFreeXAxis ? node.position.x : node.position.z;
            const patch = {
              positionX: noteFreeValueToPercentX(freeValue, segments, segmentIndex),
              positionY: noteWorldYToPercentY(node.position.y),
            };
            // Snap the note back to where those percentages actually land
            // before reporting them, the same way the artwork gizmo above
            // writes its alignment snaps straight onto node.position.
            //
            // A note is stored as a percentage *along one wall segment*, so
            // both conversions clamp (see freedomWallNotePlacement.ts): drag
            // past a segment's end — the doorway band in the middle of a
            // split wall, a corner, or above/below the usable height — and
            // the percentage stops changing while the gizmo keeps moving the
            // real Group. React re-renders, but r3f's diffProps compares
            // `position` element-wise and skips re-applying an identical
            // array, so nothing pulled the note back: it stayed under the
            // cursor in this preview while Save wrote the clamped value, and
            // the museum then drew the note somewhere the admin never put it.
            // Writing the clamp here makes the drag stop at the wall's real
            // edge instead, so what you release is what gets saved.
            const { position: clamped } = notePercentToWorld({ ...note, ...patch }, geometry);
            node.position.set(clamped[0], clamped[1], clamped[2]);
            onChangePosition(patch);
          }}
        />
      )}
    </>
  );
}

// A podium in the Stories Room. Unlike EditableArtwork above there's no wall
// to snap to — a podium stands on the floor, so X and Z are both free and Y
// is an optional raise rather than a hang height. Rotation is a free spin
// (the shared translate/rotate mode toggle drives it), not a wall-derived
// value, since which way a book faces is a judgement call about the aisle.
//
// Snapping still helps: podiums read as a deliberate arrangement when their
// rows and columns line up, so a drag near another podium's X or Z locks on
// to it, the same threshold and feel as the frame guides.
function EditablePodium({
  item,
  selected,
  mode,
  onSelect,
  onChangePosition,
  onInteractionStart,
  setOrbitEnabled,
  allItems,
  podiumModelUrl,
  podiumBookHeight,
  podiumTextureUrl,
  roomBanner,
}: {
  item: EditablePodiumItem;
  selected: boolean;
  mode: SceneMode;
  onSelect: () => void;
  onChangePosition: (patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  allItems: EditablePodiumItem[];
  /** The room's pedestal settings, so the editor preview matches what
   *  visitors see rather than always showing the untextured default. */
  podiumModelUrl?: string | null;
  podiumBookHeight?: number;
  podiumTextureUrl?: string | null;
  /** The room-wide plaque style its label is painted with — the same
   *  RoomBannerStyle the public scene reads (lib/museum/roomBanner.ts), so the
   *  editor preview matches what visitors see. */
  roomBanner?: RoomBannerStyle;
}) {
  const [node, setNode] = useState<THREE.Group | null>(null);

  return (
    <>
      <group
        ref={setNode}
        position={[item.positionX, item.positionY, item.positionZ]}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* The real production podium, so the editor and the public museum
            can never drift apart — same reasoning as ArtworkFrame above. */}
        <StoryPodium
          story={{
            id: item.id,
            title: item.title,
            type: item.type,
            coverImageUrl: item.coverImageUrl,
          }}
          position={[0, 0, 0]}
          rotationY={0}
          scale={item.scale}
          active={selected}
          shouldLoad
          modelUrl={podiumModelUrl}
          bookHeight={podiumBookHeight}
          textureUrl={podiumTextureUrl}
          banner={roomBanner}
        />
      </group>
      {selected && node && (
        <TransformControls
          object={node}
          mode={mode}
          // Rotation is Y-only. A podium is a stand with a book balanced on
          // it: tipping it about X or Z would float the book off its surface
          // and put the collider (a plain upright cylinder — see
          // PODIUM_COLLIDER_RADIUS) somewhere the visitor can't see. Which
          // way it faces down the aisle is the only rotation that means
          // anything here. Translate keeps all three axes.
          showX={mode === "translate"}
          showY
          showZ={mode === "translate"}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => setOrbitEnabled(true)}
          onObjectChange={() => {
            if (mode === "translate") {
              const others = allItems.filter((o) => o.id !== item.id);
              for (const other of others) {
                if (Math.abs(other.positionX - node.position.x) <= SNAP_THRESHOLD) {
                  node.position.x = other.positionX;
                  break;
                }
              }
              for (const other of others) {
                if (Math.abs(other.positionZ - node.position.z) <= SNAP_THRESHOLD) {
                  node.position.z = other.positionZ;
                  break;
                }
              }
              // A podium sits on the floor; dragging it below is never wanted.
              if (node.position.y < 0) node.position.y = 0;
            }
            onChangePosition({
              positionX: node.position.x,
              positionY: node.position.y,
              positionZ: node.position.z,
              rotationY: readYaw(node),
            });
          }}
        />
      )}
    </>
  );
}

// A cabinet in the Arcade Room — the arcade counterpart to EditablePodium,
// with the same floor-drag + Y-only rotate + neighbour snapping. Renders the
// real production ArcadeCabinet/ArcadePoster so the editor and the public
// museum can't drift apart.
function EditableCabinet({
  item,
  selected,
  mode,
  onSelect,
  onChangePosition,
  onInteractionStart,
  setOrbitEnabled,
  allItems,
  cabinetModelUrl,
  cabinetTextureUrl,
  cabinetScreenHeight,
  cabinetScreenDepth,
  roomBanner,
}: {
  item: EditableCabinetItem;
  selected: boolean;
  mode: SceneMode;
  onSelect: () => void;
  onChangePosition: (patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  allItems: EditableCabinetItem[];
  /** The room-wide cabinet body — see lib/museum/arcadeConfig.ts. Posters
   *  ignore it, so it's only handed to the cabinet branch below. */
  cabinetModelUrl?: string | null;
  cabinetTextureUrl?: string | null;
  cabinetScreenHeight?: number;
  cabinetScreenDepth?: number;
  /** The room-wide plaque style a marquee/caption strip is painted with — the
   *  same RoomBannerStyle the public scene reads (lib/museum/roomBanner.ts), so
   *  the editor preview matches what visitors see. Shared by both branches:
   *  one room, one label design. */
  roomBanner?: RoomBannerStyle;
}) {
  const [node, setNode] = useState<THREE.Group | null>(null);
  const common = {
    game: { title: item.title, imageUrl: item.imageUrl, subtitle: item.subtitle },
    position: [0, 0, 0] as [number, number, number],
    rotationY: 0,
    scale: item.scale,
    active: selected,
    shouldLoad: true,
    banner: roomBanner,
  };

  return (
    <>
      <group
        ref={setNode}
        position={[item.positionX, item.positionY, item.positionZ]}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {item.mode === "POSTER" ? (
          <ArcadePoster {...common} />
        ) : (
          <ArcadeCabinet
            {...common}
            modelUrl={cabinetModelUrl}
            textureUrl={cabinetTextureUrl}
            screenHeight={cabinetScreenHeight}
            screenDepth={cabinetScreenDepth}
          />
        )}
      </group>
      {selected && node && (
        <TransformControls
          object={node}
          mode={mode}
          showX={mode === "translate"}
          showY
          showZ={mode === "translate"}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => setOrbitEnabled(true)}
          onObjectChange={() => {
            if (mode === "translate") {
              const others = allItems.filter((o) => o.id !== item.id);
              for (const other of others) {
                if (Math.abs(other.positionX - node.position.x) <= SNAP_THRESHOLD) {
                  node.position.x = other.positionX;
                  break;
                }
              }
              for (const other of others) {
                if (Math.abs(other.positionZ - node.position.z) <= SNAP_THRESHOLD) {
                  node.position.z = other.positionZ;
                  break;
                }
              }
              if (node.position.y < 0) node.position.y = 0;
            }
            onChangePosition({
              positionX: node.position.x,
              positionY: node.position.y,
              positionZ: node.position.z,
              rotationY: readYaw(node),
            });
          }}
        />
      )}
    </>
  );
}

// A standee in the Cosplay Room — the cosplay counterpart to EditablePodium,
// with the same floor-drag + Y-only rotate + neighbour snapping. Renders the
// real production CosplayStandee so the editor and the public museum can't
// drift apart, which matters more here than anywhere else in this file: the
// backdrop photo is drawn *by that component* at a fixed offset behind the
// standee, so dragging this one group is what keeps the pair together. There is
// no separate handle for the photo, by design.
function EditableStandee({
  item,
  selected,
  mode,
  onSelect,
  onChangePosition,
  onInteractionStart,
  setOrbitEnabled,
  allItems,
  standeeModelUrl,
  standeeTextureUrl,
  standeeCutoutHeight,
  standeeBackdropEnabled,
  standeeBackdropWidth,
  standeeBackdropHeight,
  standeeBackdropFrameColor,
  standeeBackdropEdgeColor,
  standeeBackdropEdgeThickness,
  roomBanner,
  standeeLights,
  roomDepth,
}: {
  item: EditableStandeeItem;
  selected: boolean;
  mode: SceneMode;
  onSelect: () => void;
  onChangePosition: (patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }) => void;
  onInteractionStart: () => void;
  setOrbitEnabled: (enabled: boolean) => void;
  allItems: EditableStandeeItem[];
  /** The room's standee + backdrop settings, so the editor preview matches what
   *  visitors see rather than always showing the untextured default. */
  standeeModelUrl?: string | null;
  standeeTextureUrl?: string | null;
  standeeCutoutHeight?: number;
  standeeBackdropEnabled?: boolean;
  standeeBackdropWidth?: number;
  standeeBackdropHeight?: number;
  standeeBackdropFrameColor?: string;
  standeeBackdropEdgeColor?: string;
  standeeBackdropEdgeThickness?: number;
  /** The foot plaque's colours and type — passed as one object rather than
   *  five props, since they always travel together and this component only
   *  forwards them. */
  /** The room-wide plaque style every label in this room is painted with — the
   *  same RoomBannerStyle the public scene reads (lib/museum/roomBanner.ts), so
   *  the editor preview matches what visitors see. */
  roomBanner?: RoomBannerStyle;
  /** How a lit standee's bulbs look — room-wide, same reasoning as
   *  roomBanner above. Whether *this* standee is lit comes off `item`
   *  instead (item.lightsEnabled), since that switch is per-standee. */
  standeeLights?: {
    style: LightsStyle;
    color: string;
    intensity: number;
    bulbSize: number;
    spacing: number;
    animation: LightsAnimation;
    speed: number;
    floodCount: number;
    floodBeamHeight: number;
    floodBeamSpread: number;
  };
  /** This room's depth — the backdrop clamp needs the room's real bounds. */
  roomDepth: number;
}) {
  const [node, setNode] = useState<THREE.Group | null>(null);

  return (
    <>
      <group
        ref={setNode}
        position={[item.positionX, item.positionY, item.positionZ]}
        rotation={[0, item.rotationY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <CosplayStandee
          cosplay={{
            id: item.id,
            title: item.title,
            character: item.character,
            series: item.series,
            standeeImageUrl: item.standeeImageUrl,
            backdropImageUrl: item.backdropImageUrl,
            year: item.year,
            event: item.event,
            cosplayer: item.cosplayer,
            photographer: item.photographer,
          }}
          position={[0, 0, 0]}
          rotationY={0}
          scale={item.scale}
          active={selected}
          shouldLoad
          modelUrl={standeeModelUrl}
          cutoutHeight={standeeCutoutHeight}
          textureUrl={standeeTextureUrl}
          backdropEnabled={standeeBackdropEnabled}
          backdropWidth={standeeBackdropWidth}
          backdropHeight={standeeBackdropHeight}
          backdropFrameColor={standeeBackdropFrameColor}
          backdropEdgeColor={standeeBackdropEdgeColor}
          backdropEdgeThickness={standeeBackdropEdgeThickness}
          banner={roomBanner}
          lightsEnabled={item.lightsEnabled}
          lightsStyle={standeeLights?.style}
          lightsColor={standeeLights?.color}
          lightsIntensity={standeeLights?.intensity}
          lightsBulbSize={standeeLights?.bulbSize}
          lightsSpacing={standeeLights?.spacing}
          lightsAnimation={standeeLights?.animation}
          lightsSpeed={standeeLights?.speed}
          floodCount={standeeLights?.floodCount}
          floodBeamHeight={standeeLights?.floodBeamHeight}
          floodBeamSpread={standeeLights?.floodBeamSpread}
          // Same clamp the public room applies, so what the admin drags a
          // standee into here is what a visitor gets — including the panel
          // sliding in rather than sinking into the wall. Read off the item
          // rather than the CosplayStandee props above, which are zeroed
          // because this wrapper group carries the placement.
          backdropDistance={backdropDistance(
            [item.positionX, item.positionY, item.positionZ],
            item.rotationY,
            ROOM_WIDTH,
            roomDepth
          )}
        />
      </group>
      {selected && node && (
        <TransformControls
          object={node}
          mode={mode}
          // Rotation is Y-only, same as a podium's and for a sharper reason: the
          // backdrop hangs at a fixed offset behind this group, so tipping the
          // standee about X or Z would swing that photo off the wall it is
          // supposed to be flat against. Translate keeps all three axes.
          showX={mode === "translate"}
          showY
          showZ={mode === "translate"}
          onMouseDown={() => {
            onInteractionStart();
            setOrbitEnabled(false);
          }}
          onMouseUp={() => setOrbitEnabled(true)}
          onObjectChange={() => {
            if (mode === "translate") {
              const others = allItems.filter((o) => o.id !== item.id);
              for (const other of others) {
                if (Math.abs(other.positionX - node.position.x) <= SNAP_THRESHOLD) {
                  node.position.x = other.positionX;
                  break;
                }
              }
              for (const other of others) {
                if (Math.abs(other.positionZ - node.position.z) <= SNAP_THRESHOLD) {
                  node.position.z = other.positionZ;
                  break;
                }
              }
              // A standee stands on the floor; dragging it below is never wanted.
              if (node.position.y < 0) node.position.y = 0;
            }
            onChangePosition({
              positionX: node.position.x,
              positionY: node.position.y,
              positionZ: node.position.z,
              rotationY: readYaw(node),
            });
          }}
        />
      )}
    </>
  );
}

export function MuseumEditorScene({
  room,
  hasNorthOpening,
  hasSouthOpening,
  sceneObjects,
  selectedSceneObjectId,
  mode,
  onSelectSceneObject,
  onChangeSceneObject,
  onMeasureSceneObject,
  onInteractionStart,
  artworkItems,
  selectedArtworkId,
  podiumItems = [],
  selectedPodiumId = null,
  onSelectPodium,
  onChangePodiumPosition,
  podiumModelUrl = null,
  podiumBookHeight,
  podiumTextureUrl = null,
  cabinetModelUrl = null,
  cabinetTextureUrl = null,
  cabinetScreenHeight,
  cabinetScreenDepth,
  cabinetItems = [],
  selectedCabinetId = null,
  onSelectCabinet,
  onChangeCabinetPosition,
  standeeItems = [],
  selectedStandeeId = null,
  onSelectStandee,
  onChangeStandeePosition,
  standeeModelUrl = null,
  standeeTextureUrl = null,
  standeeCutoutHeight,
  standeeBackdropEnabled,
  standeeBackdropWidth,
  standeeBackdropHeight,
  standeeBackdropFrameColor,
  standeeBackdropEdgeColor,
  standeeBackdropEdgeThickness,
  roomBanner,
  standeeLights,
  darkMode = false,
  brightness = 50,
  onSelectArtwork,
  onChangeArtworkPosition,
  aboutData,
  freedomWallNotes = [],
  selectedNoteId = null,
  onSelectNote,
  onChangeNotePosition,
  freedomWallEventTitle = null,
}: OpeningFlags & {
  room: RoomShell;
  sceneObjects: SceneObject[];
  selectedSceneObjectId: string | null;
  mode: SceneMode;
  onSelectSceneObject: (id: string) => void;
  onChangeSceneObject: (id: string, patch: Partial<SceneObject>) => void;
  /** Auto-measured .glb footprint radius (model units) for kind "custom",
   * bubbled up so the side panel can default the Solid collider to it. */
  onMeasureSceneObject?: (id: string, nativeRadius: number, nativeSpan: number, fit: ModelFit) => void;
  /** Called once at the *start* of any drag — MuseumEditorClient.tsx uses
   * this to snapshot state for Undo before the change lands, not on every
   * per-frame drag update (which would flood the history stack). */
  onInteractionStart: () => void;
  artworkItems: EditableArtworkItem[];
  selectedArtworkId: string | null;
  onSelectArtwork: (id: string) => void;
  onChangeArtworkPosition: (
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) => void;
  /** Only set for the Stories Room — its podiums, dragged on the floor
   *  rather than snapped to a wall (see EditablePodium). */
  podiumItems?: EditablePodiumItem[];
  selectedPodiumId?: string | null;
  onSelectPodium?: (id: string) => void;
  onChangePodiumPosition?: (
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) => void;
  /** Room-wide pedestal settings — mirrored into the preview. */
  podiumModelUrl?: string | null;
  podiumBookHeight?: number;
  podiumTextureUrl?: string | null;
  /** Only set for the Arcade Room — its cabinets/posters, dragged on the
   *  floor like Stories podiums (see EditableCabinet). */
  cabinetItems?: EditableCabinetItem[];
  selectedCabinetId?: string | null;
  onSelectCabinet?: (id: string) => void;
  onChangeCabinetPosition?: (
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) => void;
  /** Room-wide cabinet settings — an uploaded .glb, or the built-in cabinet
   *  optionally re-surfaced, mirrored into the preview the same way the
   *  pedestal settings above are. See lib/museum/arcadeConfig.ts. */
  cabinetModelUrl?: string | null;
  cabinetTextureUrl?: string | null;
  cabinetScreenHeight?: number;
  cabinetScreenDepth?: number;
  /** Only set for the Cosplay Room — its standees, dragged on the floor like
   *  Stories podiums (see EditableStandee). One item is the whole pair: the
   *  photo behind a standee travels with it. */
  standeeItems?: EditableStandeeItem[];
  selectedStandeeId?: string | null;
  onSelectStandee?: (id: string) => void;
  onChangeStandeePosition?: (
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) => void;
  /** Room-wide standee + backdrop settings, mirrored into the preview the same
   *  way the pedestal/cabinet settings above are. See lib/museum/cosplayStandee.ts. */
  standeeModelUrl?: string | null;
  standeeTextureUrl?: string | null;
  standeeCutoutHeight?: number;
  standeeBackdropEnabled?: boolean;
  standeeBackdropWidth?: number;
  standeeBackdropHeight?: number;
  standeeBackdropFrameColor?: string;
  standeeBackdropEdgeColor?: string;
  standeeBackdropEdgeThickness?: number;
  /** The foot plaque's colours and type — passed as one object rather than
   *  five props, since they always travel together and this component only
   *  forwards them. */
  /** The room-wide plaque style every label in this room is painted with — the
   *  same RoomBannerStyle the public scene reads (lib/museum/roomBanner.ts), so
   *  the editor preview matches what visitors see. */
  roomBanner?: RoomBannerStyle;
  /** How a lit standee's bulbs look — room-wide; see EditableStandee's own
   *  doc comment for why the on/off switch itself isn't here. */
  standeeLights?: {
    style: LightsStyle;
    color: string;
    intensity: number;
    bulbSize: number;
    spacing: number;
    animation: LightsAnimation;
    speed: number;
    floodCount: number;
    floodBeamHeight: number;
    floodBeamSpread: number;
  };
  /** Only set for the About room — see page.tsx. */
  aboutData?: MuseumAboutData | null;
  /** Only set for the Freedom Wall room — active event's non-archived notes,
   * each individually selectable/draggable/resizable exactly like an artwork
   * frame (see EditableStickyNote). */
  freedomWallNotes?: FreedomWallNotePublic[];
  selectedNoteId?: string | null;
  onSelectNote?: (id: string) => void;
  onChangeNotePosition?: (id: string, patch: { positionX: number; positionY: number }) => void;
  /** The active event's title — the Freedom Wall banner's blank-text
   *  fallback (see lib/museum/freedomWallBanner.ts). */
  freedomWallEventTitle?: string | null;
  /** Preview the scene in dark mode — mirrors the public museum's darkMode flag. */
  darkMode?: boolean;
  /** Global brightness for the current mode (0–100, 50 = baseline) — same value
   * used by the public museum so the editor shows the room exactly as visitors see it. */
  brightness?: number;
}) {
  const { depth } = getRoomSize(room.roomType);
  // Live placement + config straight from the current sceneObjects — feeding
  // these into the real AboutRoomContents below means the side panel's Wall /
  // Hang Width / Hang Height / Resize / label controls visibly move & restyle
  // the real content, not just an abstract proxy box.
  const aboutBlockOffsets: AboutBlockOffsets = {};
  for (const object of sceneObjects) {
    if (
      object.kind === ABOUT_PHOTO_KIND ||
      object.kind === ABOUT_PLAQUE_KIND ||
      object.kind === ABOUT_CERTS_KIND ||
      object.kind === ABOUT_CARD_KIND ||
      object.kind === ABOUT_GIGS_KIND
    ) {
      const meta: AboutBlockMeta = {
        // [alongWall, height, 0] — the wall owns the perpendicular axis.
        offset: [object.positionX, object.positionY, 0],
        wall: rotYToWall(object.rotationY),
        scale: object.scale ?? 1,
      };
      if (object.kind === ABOUT_PLAQUE_KIND) {
        meta.plaqueConfig = parsePlaqueConfig(object.modelUrl);
      } else if (
        object.kind === ABOUT_CERTS_KIND ||
        object.kind === ABOUT_CARD_KIND ||
        object.kind === ABOUT_GIGS_KIND
      ) {
        meta.labelConfig = parseAboutLabelConfig(
          object.modelUrl,
          defaultAboutLabelConfig(object.kind as AboutBlockKind)
        );
        // Per-certificate nudges ride in the same column as that label — so
        // the side panel's Certificate controls move the real thumbs here,
        // live, exactly as the strip-level ones already do.
        if (object.kind === ABOUT_CERTS_KIND) {
          meta.certPlacements = parseCertPlacements(object.modelUrl);
        }
      }
      aboutBlockOffsets[object.kind] = meta;
    }
  }
  // Explicitly paused during any TransformControls drag rather than relying
  // solely on drei's automatic `makeDefault` handoff — on touch devices a
  // single-finger gesture can otherwise fire both the gizmo drag and an
  // OrbitControls rotate at once, which makeDefault alone doesn't always
  // catch reliably across browsers.
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  return (
    <Canvas camera={{ fov: 55, near: 0.1, far: 100, position: [0, depth * 0.55, depth * 0.75] }}>
      <color attach="background" args={[darkMode ? SCENE_BACKGROUND_DARK : SCENE_BACKGROUND_LIGHT]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
      <pointLight position={[0, 4, 0]} intensity={0.8} />
      <MuseumRoom
        roomType={room.roomType}
        depth={depth}
        centerZ={0}
        // Only ever non-zero for the STAIRS room — this editor previews
        // one isolated room with no real corridor around it, so there's no
        // roomLayout.ts chain to derive these from like the public site
        // has; hardcoding the one room type that actually has a rise is
        // simpler than faking a whole layout just for this. Every other
        // room type keeps both at their default 0 (flat), unaffected.
        floorYSouth={0}
        floorYNorth={room.roomType === "STAIRS" ? RISE : 0}
        hasNorthOpening={hasNorthOpening}
        hasSouthOpening={hasSouthOpening}
        wallColor={room.wallColor}
        floorColor={room.floorColor}
        ceilingColor={room.ceilingColor}
        wallTexture={room.wallTexture}
        floorTexture={room.floorTexture}
        ceilingTexture={room.ceilingTexture}
        darkMode={darkMode}
        brightness={brightness}
        lightsEnabled
        quality="full"
        shouldLoad
      />
      {room.roomType === "ABOUT" && aboutData && (
        <AboutRoomContents data={aboutData} depth={depth} centerZ={0} shouldLoad blockOffsets={aboutBlockOffsets} />
      )}
      {room.roomType === "FREEDOM_WALL" && freedomWallNotes.map((note) => (
        <EditableStickyNote
          key={note.id}
          note={note}
          selected={selectedNoteId === note.id}
          onSelect={() => onSelectNote?.(note.id)}
          onChangePosition={(patch) => onChangeNotePosition?.(note.id, patch)}
          onInteractionStart={onInteractionStart}
          setOrbitEnabled={setOrbitEnabled}
          depth={depth}
          hasNorthOpening={hasNorthOpening}
          hasSouthOpening={hasSouthOpening}
        />
      ))}
      {sceneObjects.map((object) => {
        const isAbout =
          object.kind === ABOUT_PHOTO_KIND ||
          object.kind === ABOUT_PLAQUE_KIND ||
          object.kind === ABOUT_CERTS_KIND ||
          object.kind === ABOUT_CARD_KIND ||
          object.kind === ABOUT_GIGS_KIND;
        // An About block's full room-local position: its wall anchor, plus
        // the along-wall slide (positionX) resolved onto the wall via its
        // rotation, plus the hang-height delta (positionY).
        let aboutAnchor: [number, number, number] | undefined;
        if (isAbout) {
          const base = getAboutBlockAnchor(
            object.kind as AboutBlockKind, rotYToWall(object.rotationY), depth
          );
          aboutAnchor = [
            base[0] + object.positionX * Math.cos(object.rotationY),
            base[1] + object.positionY,
            base[2] - object.positionX * Math.sin(object.rotationY),
          ];
        }
        return (
          <EditableSceneObject
            key={object.id}
            object={object}
            selected={object.id === selectedSceneObjectId}
            mode={mode}
            onSelect={() => onSelectSceneObject(object.id)}
            onChange={(patch) => onChangeSceneObject(object.id, patch)}
            onMeasure={onMeasureSceneObject}
            onInteractionStart={onInteractionStart}
            freedomWallEventTitle={freedomWallEventTitle}
            setOrbitEnabled={setOrbitEnabled}
            // About blocks are placed by the side panel (Wall / Hang Width /
            // Hang Height / Resize) — no free 3D drag/rotate gizmo.
            allowTransform={!isAbout}
            anchorIsAbsolute={isAbout}
            proxyScale={isAbout ? (object.scale ?? 1) : 1}
            anchor={aboutAnchor}
          />
        );
      })}
      {artworkItems.map((item) => (
        <EditableArtwork
          key={item.id}
          item={item}
          selected={item.id === selectedArtworkId}
          onSelect={() => onSelectArtwork(item.id)}
          onChangePosition={(patch) => onChangeArtworkPosition(item.id, patch)}
          onInteractionStart={onInteractionStart}
          setOrbitEnabled={setOrbitEnabled}
          allItems={artworkItems}
        />
      ))}
      {podiumItems.map((item) => (
        <EditablePodium
          key={item.id}
          item={item}
          selected={item.id === selectedPodiumId}
          mode={mode}
          onSelect={() => onSelectPodium?.(item.id)}
          onChangePosition={(patch) => onChangePodiumPosition?.(item.id, patch)}
          onInteractionStart={onInteractionStart}
          setOrbitEnabled={setOrbitEnabled}
          allItems={podiumItems}
          podiumModelUrl={podiumModelUrl}
          podiumBookHeight={podiumBookHeight}
          podiumTextureUrl={podiumTextureUrl}
          roomBanner={roomBanner}
        />
      ))}
      {cabinetItems.map((item) => (
        <EditableCabinet
          key={item.id}
          item={item}
          selected={item.id === selectedCabinetId}
          mode={mode}
          onSelect={() => onSelectCabinet?.(item.id)}
          onChangePosition={(patch) => onChangeCabinetPosition?.(item.id, patch)}
          onInteractionStart={onInteractionStart}
          setOrbitEnabled={setOrbitEnabled}
          allItems={cabinetItems}
          cabinetModelUrl={cabinetModelUrl}
          cabinetTextureUrl={cabinetTextureUrl}
          cabinetScreenHeight={cabinetScreenHeight}
          cabinetScreenDepth={cabinetScreenDepth}
          roomBanner={roomBanner}
        />
      ))}
      {standeeItems.map((item) => (
        <EditableStandee
          key={item.id}
          item={item}
          selected={item.id === selectedStandeeId}
          mode={mode}
          onSelect={() => onSelectStandee?.(item.id)}
          onChangePosition={(patch) => onChangeStandeePosition?.(item.id, patch)}
          onInteractionStart={onInteractionStart}
          setOrbitEnabled={setOrbitEnabled}
          allItems={standeeItems}
          standeeModelUrl={standeeModelUrl}
          standeeTextureUrl={standeeTextureUrl}
          standeeCutoutHeight={standeeCutoutHeight}
          standeeBackdropEnabled={standeeBackdropEnabled}
          standeeBackdropWidth={standeeBackdropWidth}
          standeeBackdropHeight={standeeBackdropHeight}
          standeeBackdropFrameColor={standeeBackdropFrameColor}
          standeeBackdropEdgeColor={standeeBackdropEdgeColor}
          standeeBackdropEdgeThickness={standeeBackdropEdgeThickness}
          roomBanner={roomBanner}
          standeeLights={standeeLights}
          roomDepth={depth}
        />
      ))}
      <OrbitControls makeDefault enabled={orbitEnabled} target={[0, 1.5, 0]} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}
