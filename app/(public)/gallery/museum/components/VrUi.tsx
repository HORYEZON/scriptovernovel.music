"use client";

// VrUi.tsx — the in-world UI primitives every Vr*Panel.tsx is built from.
//
// Docs/Museum_VRMode.md's Phase 4 originally gave VR one read-only artwork
// panel and a "remove headset to view" toast for everything else. That was
// reversed on 09/13/26: every DOM modal the desktop/mobile museum opens
// (ArtworkInfoPanel, CertificateInfoPanel, StoryReader, CosplayInfoPanel,
// GamePreviewModal, GigsPanel, ContactPanel) now has a mirrored in-world
// counterpart, built from these pieces, driven by the *same* panel state
// MuseumScene.tsx already keeps — the DOM panel and the VR panel are two
// renderers of one state, never two states.
//
// Why plain meshes + drei <Text> rather than a UI library: @react-three/xr's
// default controllers and hands already carry ray pointers that dispatch
// ordinary R3F pointer events (onClick, onPointerOver, ...) onto meshes —
// see @pmndrs/pointer-events' R3F compatibility in its event dispatch —
// and those events bubble up the parent chain, so a <group onClick> with a
// plane and a Text inside it is a working button. Nothing else was needed.
//
// Every material here is `transparent` with `depthTest`/`depthWrite` off and
// an explicit renderOrder. A modal has to draw *over* the room the way the
// DOM overlay does, even when the visitor opened it standing close enough to
// a wall that the panel's own position lands inside it — and with depth
// testing off, the only thing that keeps the backing behind the text is the
// order they're drawn in, which for three.js means they all have to be in the
// transparent pass (renderOrder is only honoured within a pass).
import { useEffect, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { loadDownscaledTexture, type LoadedMuseumTexture } from "@/lib/museum/loadDownscaledTexture";

// The DOM panels' own type faces (font-grotesk / font-body / font-display),
// from public/fonts — troika reads .ttf and .woff, not .woff2.
export const VR_FONT_TITLE = "/fonts/SpaceGrotesk-Bold.ttf";
export const VR_FONT_BODY = "/fonts/DMSans-Regular.woff";
export const VR_FONT_BODY_BOLD = "/fonts/DMSans-Bold.woff";
export const VR_FONT_ITALIC = "/fonts/DMSans-Italic.woff";

// The DOM panels' Tailwind palette, flattened over their #121212 backing so
// the two read as one design. Troika has no alpha compositing against the
// panel behind it, so "white/70" has to be the resulting grey, not an opacity.
export const VR_COLORS = {
  panel: "#121212",
  panelRaised: "#1c1c1c",
  border: "#2b2b2b", // border-white/10
  text: "#ffffff",
  textMuted: "#bcbcbc", // white/70
  textSoft: "#898989", // white/50
  textFaint: "#717171", // white/40
  emerald: "#059669", // emerald-600
  emeraldHover: "#10b981", // emerald-500
  emeraldSoft: "#1d5c47", // emerald-500/40 over the panel — the plaque bar
  sepia: "#8b6f47",
  sepiaHover: "#a3865a",
  black: "#000000",
} as const;

// Everything UI draws after everything room. The vignette and VrPrompt use
// the same depthTest-off trick but have no ordering needs of their own.
export const VR_UI_RENDER_ORDER = 1000;

/** Line height every VrLabel uses — fixed so a `maxLines` clip is exact. */
const LINE_HEIGHT = 1.3;

const scratchPos = new THREE.Vector3();
const scratchDir = new THREE.Vector3();
const scratchRaycaster = new THREE.Raycaster();
// Never closer than this, whatever is in the way (a hand held out in front
// of the face, say) — the panel is scaled down to match, so at this
// distance it still spans the same slice of the view.
const MIN_MODAL_DISTANCE = 0.6;
// Gap kept between the panel and the surface it would otherwise sit in.
const MODAL_SURFACE_CLEARANCE = 0.18;

// ── VrModal ────────────────────────────────────────────────────────────────

/**
 * The frame every mirrored panel sits in: a dark backing with a thin border
 * and a × button, placed once at open time a fixed distance in front of
 * wherever the visitor was looking, then left there. World-locked rather
 * than parented to the camera on purpose — a modal that follows the head
 * can't be read (the eyes never get to settle on it) and is a known comfort
 * problem; one that sits still in the room reads like the desktop overlay
 * it mirrors. Faces the visitor squarely, upright, at just under eye height.
 *
 * Children are positioned relative to the panel's centre: x in
 * [-width/2, width/2], y in [-height/2, height/2], z ≥ 0 to sit in front of
 * the backing.
 */
export function VrModal({
  width,
  height,
  onClose,
  children,
  distance = 1.25,
}: {
  width: number;
  height: number;
  onClose: () => void;
  children?: ReactNode;
  /** Metres in front of the visitor. 1.25 keeps a ~1m panel inside a
   *  comfortable ~45° of view and — with INTERACT_PROXIMITY_ENTER at 2.5m
   *  and frames FRAME_WALL_OFFSET off the wall — usually short of the wall
   *  the visitor is facing. When it isn't, depthTest-off keeps it visible. */
  distance?: number;
}) {
  const { camera, scene } = useThree();
  // Set once, on the first frame after mount, when the camera's world matrix
  // is guaranteed to reflect the headset's current pose (a React commit can
  // land between frames, before the XR manager has written this frame's
  // pose). Rendering nothing until then costs one invisible frame.
  const [pose, setPose] = useState<{ position: [number, number, number]; rotationY: number; scale: number } | null>(null);
  useFrame(() => {
    if (pose) return;
    camera.getWorldPosition(scratchPos);
    camera.getWorldDirection(scratchDir);
    // Horizontal only — a visitor looking down at a podium still gets an
    // upright panel at eye level, not one tilted into the floor.
    scratchDir.y = 0;
    if (scratchDir.lengthSq() < 1e-6) scratchDir.set(0, 0, -1);
    scratchDir.normalize();

    // Pull the panel in front of anything closer than `distance` — the
    // wall the visitor walked right up to, a podium, a standee. With depth
    // testing off the panel would still *show* through the wall, but the
    // eyes would be told it sits behind a surface it's drawn on top of,
    // which is exactly the depth conflict that makes VR text hard to fuse.
    // Scaled down to match, so the panel fills the same slice of the view
    // wherever it ends up. Skips the museum's own in-world UI (renderOrder
    // ≥ VR_UI_RENDER_ORDER: the prompt already in front of the camera, an
    // earlier panel) and anything hanging off the rig (the camera's parent
    // — hands, controllers, the vignette), none of which is a surface.
    scratchRaycaster.set(scratchPos, scratchDir);
    scratchRaycaster.near = 0.05;
    scratchRaycaster.far = distance + MODAL_SURFACE_CLEARANCE;
    const rig = camera.parent;
    let placed = distance;
    for (const hit of scratchRaycaster.intersectObjects(scene.children, true)) {
      const object = hit.object;
      if (object.renderOrder >= VR_UI_RENDER_ORDER) continue;
      // Raycaster tests layers, not visibility — a hidden mesh (a room's
      // not-yet-loaded placeholder, say) still intersects, and shouldn't
      // count as a surface.
      let ancestor: THREE.Object3D | null = object;
      let skip = false;
      while (ancestor) {
        if (ancestor === rig || ancestor === camera || !ancestor.visible) {
          skip = true;
          break;
        }
        ancestor = ancestor.parent;
      }
      if (skip) continue;
      placed = Math.max(MIN_MODAL_DISTANCE, Math.min(placed, hit.distance - MODAL_SURFACE_CLEARANCE));
      break;
    }

    setPose({
      position: [
        scratchPos.x + scratchDir.x * placed,
        scratchPos.y - 0.12 * (placed / distance),
        scratchPos.z + scratchDir.z * placed,
      ],
      // A plane's face is +Z; the visitor is back along -dir, so point +Z
      // at them.
      rotationY: Math.atan2(-scratchDir.x, -scratchDir.z),
      scale: placed / distance,
    });
  });

  if (!pose) return null;

  return (
    <group position={pose.position} rotation={[0, pose.rotationY, 0]} scale={pose.scale}>
      {/* Border: a slightly larger plane behind the backing — the same
          "thin lit edge" trick BannerPanel.tsx uses, in the DOM panel's
          border-white/10 grey. */}
      <mesh renderOrder={VR_UI_RENDER_ORDER}>
        <planeGeometry args={[width + 0.016, height + 0.016]} />
        <meshBasicMaterial color={VR_COLORS.border} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 1}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={VR_COLORS.panel} transparent opacity={0.97} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Close — the DOM panels' top-right × button. A little larger than
          its DOM counterpart: a ray from a tracked hand wanders more than a
          mouse does, and this is the one control every panel needs. */}
      <VrButton
        label="×"
        width={0.09}
        height={0.09}
        fontSize={0.056}
        position={[width / 2 - 0.065, height / 2 - 0.065, 0.003]}
        onClick={onClose}
        variant="ghost"
      />
      <group position={[0, 0, 0.003]}>{children}</group>
    </group>
  );
}

// ── UI-press bookkeeping ───────────────────────────────────────────────────

// A trigger press / pinch over a button raises two things: the R3F pointer
// events on the button (pointerdown at selectstart, click at selectend) and
// the session-level `select` PlayerControls.tsx binds to handleActivate. The
// pointerdown always lands first, so recording it lets the select handler
// tell "pressed the HUD's Map button while standing near a painting" apart
// from "pressed at the painting" — without it, the painting's panel would
// open under the map. Module-level: one session, one pointer at a time in
// practice, and the check is a timestamp, not state.
let lastUiPointerDownAt = -Infinity;
// Long enough for a held pinch; a select can't lag its own pointerdown by
// more than the press itself lasts.
const UI_PRESS_WINDOW_MS = 2500;

function markUiPointerDown() {
  lastUiPointerDownAt = performance.now();
}

/** True if a VrUi button was pressed down within the last couple of seconds. */
export function vrUiPressedRecently(): boolean {
  return performance.now() - lastUiPointerDownAt < UI_PRESS_WINDOW_MS;
}

// ── VrButton ───────────────────────────────────────────────────────────────

/**
 * A clickable pill. `onClick` lands from a controller trigger or a hand pinch
 * while the ray is over it — the handlers sit on the wrapping <group>, so a
 * hit on the label's own Text mesh bubbles up to the same place as a hit on
 * the plane behind it. stopPropagation keeps the click from also reaching
 * whatever the panel itself might listen for.
 */
export function VrButton({
  label,
  width,
  height = 0.09,
  fontSize = 0.032,
  position,
  onClick,
  variant = "outline",
  disabled = false,
}: {
  label: string;
  width: number;
  height?: number;
  fontSize?: number;
  position: [number, number, number];
  onClick?: () => void;
  /** primary = the DOM's filled emerald action; sepia = the shop one;
   *  outline = its bordered secondary; ghost = the bare × close button. */
  variant?: "primary" | "sepia" | "outline" | "ghost";
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const active = hover && !disabled;
  const fill =
    variant === "primary"
      ? active ? VR_COLORS.emeraldHover : VR_COLORS.emerald
      : variant === "sepia"
        ? active ? VR_COLORS.sepiaHover : VR_COLORS.sepia
        : variant === "ghost"
          ? active ? "#333333" : "#202020"
          : active ? "#262626" : VR_COLORS.panelRaised;

  return (
    <group
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (!disabled) onClick?.();
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        markUiPointerDown();
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHover(true);
      }}
      onPointerOut={() => setHover(false)}
    >
      {variant === "outline" && (
        <mesh renderOrder={VR_UI_RENDER_ORDER + 2}>
          <planeGeometry args={[width + 0.006, height + 0.006]} />
          <meshBasicMaterial color={active ? "#4a4a4a" : VR_COLORS.border} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, 0, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 3}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={fill} transparent opacity={disabled ? 0.45 : 1} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0, 0.002]}
        fontSize={fontSize}
        anchorX="center"
        anchorY="middle"
        font={variant === "ghost" ? VR_FONT_BODY : VR_FONT_BODY_BOLD}
        renderOrder={VR_UI_RENDER_ORDER + 4}
      >
        {label}
        <meshBasicMaterial attach="material" color={VR_COLORS.text} transparent opacity={disabled ? 0.5 : 1} depthTest={false} depthWrite={false} toneMapped={false} />
      </Text>
    </group>
  );
}

// ── VrLabel ────────────────────────────────────────────────────────────────

/**
 * Text with the DOM panels' few type styles, laid out from its top-left
 * corner (like a block of HTML text) and, with `maxLines`, hard-clipped to
 * that many lines — the in-world stand-in for `line-clamp-4`. There's no
 * scroll affordance in any of these panels, so overflow is cut, not shown.
 */
export function VrLabel({
  children,
  position,
  width,
  fontSize = 0.032,
  color = VR_COLORS.textMuted,
  font = VR_FONT_BODY,
  maxLines,
  align = "left",
  uppercase = false,
  letterSpacing = 0,
}: {
  children: string;
  position: [number, number, number];
  width: number;
  fontSize?: number;
  color?: string;
  font?: string;
  maxLines?: number;
  align?: "left" | "center";
  uppercase?: boolean;
  letterSpacing?: number;
}) {
  const text = uppercase ? children.toUpperCase() : children;
  const clipH = maxLines != null ? maxLines * fontSize * LINE_HEIGHT : null;
  return (
    <Text
      position={position}
      fontSize={fontSize}
      maxWidth={width}
      lineHeight={LINE_HEIGHT}
      letterSpacing={letterSpacing}
      textAlign={align}
      anchorX={align === "center" ? "center" : "left"}
      anchorY="top"
      font={font}
      overflowWrap="break-word"
      clipRect={clipH != null ? (align === "center" ? [-width / 2, -clipH, width / 2, 0] : [0, -clipH, width, 0]) : undefined}
      renderOrder={VR_UI_RENDER_ORDER + 4}
    >
      {text}
      <meshBasicMaterial attach="material" color={color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </Text>
  );
}

/** Height a `VrLabel` of `lines` lines at `fontSize` occupies — for stacking. */
export function labelHeight(fontSize: number, lines: number) {
  return lines * fontSize * LINE_HEIGHT;
}

// ── VrRule / VrChip / VrBar ────────────────────────────────────────────────

/** A 1px-ish horizontal divider (the DOM's border-b border-white/10). */
export function VrRule({ position, width }: { position: [number, number, number]; width: number }) {
  return (
    <mesh position={position} renderOrder={VR_UI_RENDER_ORDER + 2}>
      <planeGeometry args={[width, 0.003]} />
      <meshBasicMaterial color={VR_COLORS.border} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** The plaque's left accent bar (border-l-2 border-emerald-500/40). */
export function VrBar({ position, height }: { position: [number, number, number]; height: number }) {
  return (
    <mesh position={position} renderOrder={VR_UI_RENDER_ORDER + 2}>
      <planeGeometry args={[0.006, height]} />
      <meshBasicMaterial color={VR_COLORS.emeraldSoft} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * A small read-only tag — the price-variant chips, the "NEXT" badge. Sized
 * from its text so a row of them can be laid out by the caller.
 */
export function VrChip({
  label,
  position,
  width,
  height = 0.05,
  fontSize = 0.024,
  color = VR_COLORS.textMuted,
  strike = false,
  accent = false,
}: {
  label: string;
  position: [number, number, number];
  width: number;
  height?: number;
  fontSize?: number;
  color?: string;
  /** A sold-out size: greyed and struck through. */
  strike?: boolean;
  /** The one highlighted chip (NEXT event). */
  accent?: boolean;
}) {
  return (
    <group position={position}>
      <mesh renderOrder={VR_UI_RENDER_ORDER + 2}>
        <planeGeometry args={[width + 0.004, height + 0.004]} />
        <meshBasicMaterial color={accent ? VR_COLORS.emerald : strike ? "#222222" : "#3a3a3a"} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 3}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={accent ? "#0b3d2c" : VR_COLORS.panel} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0, 0.002]}
        fontSize={fontSize}
        anchorX="center"
        anchorY="middle"
        font={VR_FONT_BODY}
        letterSpacing={0.06}
        renderOrder={VR_UI_RENDER_ORDER + 4}
      >
        {label.toUpperCase()}
        <meshBasicMaterial attach="material" color={strike ? "#555555" : accent ? "#a7f3d0" : color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </Text>
      {strike && (
        <mesh position={[0, 0, 0.003]} renderOrder={VR_UI_RENDER_ORDER + 5}>
          <planeGeometry args={[width - 0.012, 0.0025]} />
          <meshBasicMaterial color="#555555" transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ── VrImage ────────────────────────────────────────────────────────────────

/**
 * An image fitted inside a box — `object-contain` on a black ground, the way
 * every DOM panel shows its photo. Loaded through loadDownscaledTexture so
 * it's the same capped, medium-rendition texture the wall frames use (and
 * shares their cache: a panel for an artwork already on the wall costs no
 * second download), never drei's useTexture (see that loader's own doc).
 */
export function VrImage({
  url,
  width,
  height,
  position,
}: {
  url: string;
  width: number;
  height: number;
  position: [number, number, number];
}) {
  const [loaded, setLoaded] = useState<LoadedMuseumTexture | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    loadDownscaledTexture(url)
      .then((result) => {
        if (!cancelled) setLoaded(result);
      })
      .catch(() => {
        // Leave the black ground up — a failed image shouldn't take the
        // panel's text with it, same as the DOM panel's broken-image case.
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  let w = width;
  let h = height;
  if (loaded) {
    if (loaded.aspect > width / height) h = width / loaded.aspect;
    else w = height * loaded.aspect;
  }

  return (
    <group position={position}>
      <mesh renderOrder={VR_UI_RENDER_ORDER + 2}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={VR_COLORS.black} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {loaded && (
        <mesh position={[0, 0, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 3}>
          <planeGeometry args={[w, h]} />
          {/* Unlit, like an <img>: the room's lights shouldn't tint a photo
              inside a modal. Keyed on the texture so a URL change swaps the
              material rather than mutating one three.js has already
              compiled without the map (see ArtworkFrame.tsx's same note). */}
          <meshBasicMaterial
            key={loaded.texture.uuid}
            map={loaded.texture}
            transparent
            depthTest={false}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
