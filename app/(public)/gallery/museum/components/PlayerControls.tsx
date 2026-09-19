"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import { useXR, useXRControllerLocomotion, useXRInputSourceEvent } from "@react-three/xr";
import { vrUiPressedRecently } from "./VrUi";
import { readMuseumGamepad } from "@/lib/museum/gamepad";
import * as THREE from "three";
import {
  EYE_HEIGHT,
  MOVE_SPEED,
  PLAYER_RADIUS,
  WALL_THICKNESS,
  ROOM_WIDTH,
  DOORWAY_WIDTH,
  MAX_PITCH,
  TOUCH_LOOK_SENSITIVITY,
  POINTER_LOCK_COOLDOWN_MS,
  INTERACT_PROXIMITY_ENTER,
  INTERACT_PROXIMITY_EXIT,
  JUMP_VELOCITY,
  JUMP_GRAVITY,
} from "./roomConstants";
import type { FramePlacement } from "./framePlacement";
import { getChainZBounds, getFloorYAt, getLayoutAtZ, type RoomLayout, type RoomTravelRequest } from "./roomLayout";

// How close (in Z) to a doorway boundary before its width also clamps X —
// outside this band the corridor's full ROOM_WIDTH applies, same as walking
// down the middle of any single room.
const DOORWAY_CLEARANCE_ZONE = WALL_THICKNESS / 2 + 0.4;

// For the VR-exit handover below — never allocated in an effect.
const scratchExitDir = new THREE.Vector3();

// Gamepad (lib/museum/gamepad.ts) — any Bluetooth/USB controller, every
// mode. Right stick outside VR turns smoothly at this many radians per
// second at full deflection; inside VR it snap-turns instead (comfort —
// the same 45° useXRControllerLocomotion uses for a headset's own
// thumbstick), re-armed once the stick returns inside this dead zone.
const GAMEPAD_LOOK_SPEED = 2.2;
const GAMEPAD_SNAP_TURN_RAD = THREE.MathUtils.degToRad(45);
const GAMEPAD_SNAP_DEAD_ZONE = 0.5;
const scratchGamepadEuler = new THREE.Euler(0, 0, 0, "YXZ");

// Comfort vignette (Phase 4) — the translation speed (units/sec) at which
// its fade reaches full intensity, and how dark "full intensity" actually
// is. Tuned against MOVE_SPEED so a visitor moving at a normal walking
// pace sees the vignette near its strongest rather than barely on.
const COMFORT_VIGNETTE_MAX_SPEED = MOVE_SPEED;
const COMFORT_VIGNETTE_MAX_OPACITY = 0.85;
// How quickly the fade itself eases toward its target — see
// THREE.MathUtils.damp's own doc; larger = snappier.
const COMFORT_VIGNETTE_DAMPING = 6;

interface PlayerControlsProps {
  /**
   * The player rig (see PlayerRig.tsx / Docs/Museum_VRMode.md §2) — the
   * `<group>` this component now drives instead of the camera directly.
   * The camera is the rig's child and keeps local position (0, 0, 0); only
   * its rotation is ever touched here (PointerLockControls / touch look).
   */
  rigRef: RefObject<THREE.Group | null>;
  /** Every room's frames, already offset into shared world space by MuseumScene.tsx. */
  placements: FramePlacement[];
  layouts: RoomLayout[];
  spawnZ: number;
  /** Called only when the nearest-in-range frame index actually changes — not every frame. */
  onActiveChange: (index: number | null) => void;
  onLockChange?: (locked: boolean) => void;
  /** Called only when the room the camera is currently standing in changes. */
  onRoomChange?: (roomId: string) => void;
  /** True on touch devices — swaps WASD+PointerLockControls for the joystick/drag refs below. */
  isCoarsePointer?: boolean;
  /** Joystick vector, -1..1 on each axis — written by TouchControls.tsx. */
  moveRef?: React.RefObject<{ x: number; y: number }>;
  /** Accumulated look-drag pixel delta since last consumed — written by TouchControls.tsx, zeroed here once read. */
  lookRef?: React.RefObject<{ x: number; y: number }>;
  /** Set to true by TouchControls.tsx's jump button (a discrete tap, not a
   * held/analog value like moveRef) — consumed and reset back to false the
   * same frame it's read, same "read = reset" contract as lookRef. Desktop
   * has no equivalent ref: [Space] is handled entirely inside this
   * component's own keydown listener instead. */
  jumpRef?: React.RefObject<boolean>;
  /** MuseumMap.tsx room click, bubbled down through roomLayout.ts's RoomTravelRequest. */
  travelRequest?: RoomTravelRequest | null;
  /**
   * MuseumScene.tsx's handleActivate — the same function [E] and
   * InteractionPrompt's tap both already call. Wired here too because
   * *neither* of those exists inside a WebXR session: InteractionPrompt is
   * a DOM overlay the headset never renders (a standard immersive-vr
   * session shows nothing outside the WebXR frame buffer), and there's no
   * keyboard. A controller trigger press ("select") is the VR equivalent —
   * bound below via useXRInputSourceEvent, which itself no-ops with no
   * active XR session, so this prop is harmless to pass unconditionally.
   */
  onActivate?: () => void;
  /**
   * True while an info panel / reader is open over the scene.
   *
   * Opening one calls document.exitPointerLock() so the visitor gets a cursor
   * back (see MuseumScene's releasePointer) — but PointerLockControls re-locks
   * on the *next click anywhere*, and the first thing anyone does with a fresh
   * cursor is click something in the panel. That click silently re-grabbed the
   * pointer: the cursor vanished again and every later click went to the scene
   * behind the panel instead of its buttons. Keeping the control disabled for
   * as long as a panel is open is what makes the released cursor stay released.
   */
  panelOpen?: boolean;
  /** Solid floor-standing obstacles, in world space — the Stories Room's
   *  podiums (see StoriesRoomContents.tsx) plus any custom .glb prop an
   *  admin has flagged "Solid" in the Museum Scene Editor. Most decorative
   *  props stay walk-through; a podium or a statue you can stand *inside*
   *  reads as broken the moment you walk up to it. */
  obstacles?: {
    x: number;
    z: number;
    radius: number;
    /**
     * The vertical span this circle actually blocks, in world Y. Both absent
     * (podiums, arcade cabinets, and any prop whose height an admin hasn't
     * set) means the old behaviour: a floor-to-ceiling column, solid at every
     * height. Set them and the circle becomes a cylinder the visitor can walk
     * under or jump over — see the overlap test in the movement loop, and
     * MuseumSceneObject.colliderHeight for where the number comes from.
     */
    minY?: number;
    maxY?: number;
  }[];
  /** Solid *rectangular* obstacles, in world space — the divider walls an
   *  admin places from the Museum Scene Editor (see lib/museum/wallDivider
   *  .ts). Kept apart from the circular `obstacles` above rather than folded
   *  into them: a 4m panel 30cm thick has no honest circle. `halfWidth` is
   *  along the panel's own long axis, `halfDepth` across its thickness, and
   *  `rotationY` is the same yaw the panel is drawn with. */
  barriers?: { x: number; z: number; halfWidth: number; halfDepth: number; rotationY: number }[];
}

// First-person WASD + mouse-look, now walking one continuous corridor of
// rooms instead of a single box (see roomLayout.ts). Movement/proximity
// live entirely in a useFrame loop driven by refs (key state, active-frame
// ref) — the only React state updates are onActiveChange/onRoomChange, and
// only when they actually change, so this never re-renders React on a
// per-frame basis. No physics engine — just a simple clamp against the
// corridor's bounds, plus a narrower clamp right at each doorway so a
// visitor can't cut through a solid side-post by hugging a wall while
// crossing between rooms.
export function PlayerControls({
  rigRef,
  placements,
  layouts,
  spawnZ,
  onActiveChange,
  onLockChange,
  onRoomChange,
  isCoarsePointer,
  moveRef,
  lookRef,
  jumpRef,
  travelRequest,
  onActivate,
  obstacles,
  barriers,
  panelOpen = false,
}: PlayerControlsProps) {
  const { camera } = useThree();
  // Docs/Museum_VRMode.md's Phase 3. `session != null` rather than reading
  // `gl.xr.isPresenting` directly: this is the value the rest of the app
  // (MuseumScene's own copy, the VR button) agrees on, and it flips a
  // frame earlier — before three's own isPresenting flag catches up — so
  // this component stops driving the camera the same frame the session
  // starts, not one frame into it.
  const isPresenting = useXR((s) => s.session != null);
  const keys = useRef<Record<string, boolean>>({});
  const activeRef = useRef<number | null>(null);
  const roomRef = useRef<string | null>(null);
  const direction = useRef(new THREE.Vector3());
  // Scratch quaternion for the world-space read below — see
  // Docs/Museum_VRMode.md §3.1. Hook-level, not allocated per frame,
  // matching the existing scratch pattern in ChaseCompanion.tsx
  // (`scratchToPlayer`) and MiniMapTracker.tsx (`scratchDir`).
  const scratchWorldQuat = useRef(new THREE.Quaternion());
  // The vertical offset the rig adds on top of the floor height — EYE_HEIGHT
  // outside VR. 0 while presenting: a `local-floor` XR reference space
  // already reports the headset at the visitor's real eye height above
  // their real floor, and adding EYE_HEIGHT on top of that would
  // double-count it (see Docs/Museum_VRMode.md §3.2).
  const eyeOffset = isPresenting ? 0 : EYE_HEIGHT;
  // Refs of the two above for the spawn effect, which must *not* re-run on a
  // VR transition (it would re-spawn the visitor at the entry room on every
  // Exit VR) but does need their current values when it runs.
  const eyeOffsetRef = useRef(eyeOffset);
  eyeOffsetRef.current = eyeOffset;
  const isPresentingRef = useRef(isPresenting);
  isPresentingRef.current = isPresenting;

  // Comfort vignette (Docs/Museum_VRMode.md's Phase 4) — darkens the
  // visual periphery while the rig is actually translating in VR, a
  // standard mitigation for the vection (visually-driven "I'm moving")
  // that causes VR locomotion sickness when the body's own inner ear
  // disagrees. A radial-gradient texture (transparent centre, opaque
  // edge) on a plane parented directly onto the camera, so it always
  // fills the same part of the view regardless of head orientation —
  // built once, then only ever faded via its material's opacity.
  const vignetteTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, size * 0.32,
      size / 2, size / 2, size * 0.5
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
  const vignetteMesh = useMemo(() => {
    if (!vignetteTexture) return null;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshBasicMaterial({
        map: vignetteTexture,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    );
    mesh.visible = false;
    // Just inside the far side of the near clip plane (near=0.1, see
    // MuseumScene.tsx's <PerspectiveCamera>) so it always renders in
    // front of everything else without clipping.
    mesh.position.set(0, 0, -0.3);
    mesh.renderOrder = 1000;
    return mesh;
  }, [vignetteTexture]);
  // Parented straight onto the camera object itself — the same imperative
  // `object3D.add()` pattern @react-three/xr's own <XROrigin> uses to
  // attach three's internal XR camera onto the rig (see PlayerRig.tsx) —
  // rather than through JSX, since this component has no camera JSX of
  // its own to hang it from (MuseumScene.tsx declares the camera).
  useEffect(() => {
    if (!vignetteMesh) return;
    camera.add(vignetteMesh);
    return () => {
      camera.remove(vignetteMesh);
    };
  }, [camera, vignetteMesh]);
  // Previous frame's rig XZ, for the per-frame translation-speed estimate
  // that drives the fade — see the useFrame loop below.
  const prevRigXZ = useRef(new THREE.Vector2());
  const vignetteOpacity = useRef(0);

  // Height above EYE_HEIGHT and its rate of change — a simple parabolic
  // arc (see roomConstants.ts's JUMP_VELOCITY/JUMP_GRAVITY doc comment),
  // not a physics engine. jumpOffset <= 0 means "grounded" — the only
  // state either trigger (Space, or TouchControls' jump button) checks
  // before allowing a new jump, so there's no mid-air double-jump.
  const jumpOffset = useRef(0);
  const jumpVelocity = useRef(0);
  // Manual yaw/pitch for touch mode — PointerLockControls (mouse-move-based,
  // requires the Pointer Lock API) isn't rendered at all when coarse, so
  // there's nothing else driving camera rotation.
  const yaw = useRef(0);
  const pitch = useRef(0);
  // Gamepad snap-turn: one turn per push of the right stick, re-armed once
  // it comes back to centre — same latch useXRControllerLocomotion keeps.
  const gamepadSnapArmed = useRef(true);
  // Briefly disabling PointerLockControls after an unlock — which unbinds
  // its document-wide "click re-locks" listener — stops it from ever
  // attempting a request during Chrome's post-Escape cooldown, avoiding
  // the console error at the source rather than suppressing it.
  const [pointerLockEnabled, setPointerLockEnabled] = useState(true);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUnlock = () => {
    onLockChange?.(false);
    setPointerLockEnabled(false);
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setPointerLockEnabled(true), POINTER_LOCK_COOLDOWN_MS);
    // Escape (or any focus loss) exits pointer lock without necessarily
    // delivering the matching keyup for whatever movement key was still
    // held — the keydown handler's own auto-repeat guard then keeps that
    // key latched "pressed" in this ref forever, since nothing ever tells
    // it otherwise. Without this, walking forward and hitting Escape mid-
    // stride leaves the visitor stuck walking on their own after re-
    // locking, in every room (this component is shared by the whole
    // corridor, not per-room).
    keys.current = {};
  };

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    // Spawn at the entry room's center, facing north into the corridor (a
    // default-rotation perspective camera looks down -Z). Unlike V1, an
    // entry room isn't guaranteed to have a solid south wall to spawn
    // "just inside" of — it could be anywhere in the chain — so the center
    // is the one position that always works.
    rig.position.set(0, getFloorYAt(layouts, spawnZ) + eyeOffsetRef.current, spawnZ);
    // Rotation stays on the camera, not the rig — see §2's invariant. Skip
    // entirely in VR: the headset owns rotation there, and forcing it to
    // (0,0,0) would just fight next frame's pose update for no reason. The
    // rig itself also starts at rotation.y = 0 by construction (a fresh
    // `<XROrigin>`/`<group>` — see PlayerRig.tsx), so a VR spawn still
    // faces north; only the *camera*-level reset is skippable here.
    if (!isPresentingRef.current) camera.rotation.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
    activeRef.current = null;
    roomRef.current = null;
    // eyeOffset/isPresenting deliberately read through refs, not deps: a VR
    // enter/exit is not a spawn. The exit transition has its own effect below.
  }, [camera, rigRef, spawnZ, layouts]);

  // Leaving VR: hand the camera back to the 2D controls where the visitor
  // is standing, not floating and not at the entry room.
  //
  // While presenting, three's WebXRManager writes the headset's tracked
  // pose into the camera's *local* transform inside the rig — position
  // (0.1, 1.6, -0.05)-ish, the visitor's real eye height and lean, and the
  // full head orientation including roll. The 2D loop never touches
  // camera.position (position is the rig's job — see PlayerRig.tsx) so
  // after the session that offset just stayed, on top of the EYE_HEIGHT the
  // rig went back to adding: floor + 1.7 + 1.6. Hence the float.
  //
  // So on the presenting -> not-presenting edge: zero the camera's local
  // position, fold whatever yaw the rig accumulated from snap-turns (plus
  // the head's own) into a clean camera yaw, zero the rig's rotation (§2's
  // invariant: outside VR the rig never rotates), and seed the touch
  // yaw/pitch to match. Pitch and roll are dropped — a level horizon is what
  // every 2D spawn/travel gives too. X/Z are left alone: same spot, same
  // room, facing the same way.
  const wasPresenting = useRef(false);
  useEffect(() => {
    const rig = rigRef.current;
    if (wasPresenting.current && !isPresenting && rig) {
      camera.getWorldDirection(scratchExitDir);
      // A camera with rotation.y = θ (pitch 0) looks along (-sin θ, 0, -cos θ).
      const worldYaw = Math.atan2(-scratchExitDir.x, -scratchExitDir.z);
      rig.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 0);
      camera.rotation.order = "YXZ";
      camera.rotation.set(0, worldYaw, 0);
      yaw.current = worldYaw;
      pitch.current = 0;
      jumpOffset.current = 0;
      jumpVelocity.current = 0;
    }
    wasPresenting.current = isPresenting;
  }, [isPresenting, camera, rigRef]);

  // MuseumMap.tsx room click — same reset as the spawn effect above (drop
  // dead-center, facing north, clear any active artwork/room tracking) but
  // keyed on `travelRequest.token` instead of mount, so it can fire again on
  // demand. Only `token` is in the dependency array: clicking the same room
  // twice in a row still needs to re-run this even though `roomId` didn't
  // change (see RoomTravelRequest's docstring).
  useEffect(() => {
    if (!travelRequest) return;
    const rig = rigRef.current;
    if (!rig) return;
    const layout = layouts.find((l) => l.room.id === travelRequest.roomId);
    if (!layout) return;
    rig.position.set(0, getFloorYAt(layouts, layout.centerZ) + eyeOffset, layout.centerZ);
    // Same as the spawn effect above: rotation stays on the camera, and is
    // skipped entirely in VR.
    if (!isPresenting) camera.rotation.set(0, 0, 0);
    yaw.current = 0;
    pitch.current = 0;
    activeRef.current = null;
    onActiveChange(null);
    // Update immediately rather than waiting for next frame's useFrame
    // position check — a deliberate "go here" click deserves an instant HUD
    // label update, not a frame of stale state.
    roomRef.current = layout.room.id;
    onRoomChange?.(layout.room.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelRequest?.token]);

  useEffect(() => {
    // Touch has no lock/unlock gesture — the HUD's "click to look around"
    // hint and the [E] interaction prompt both gate on `locked`, so without
    // this a mobile visitor would be stuck seeing the desktop hint forever
    // and never get prompted to interact with a nearby frame.
    if (isCoarsePointer) onLockChange?.(true);
  }, [isCoarsePointer, onLockChange]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never hijack movement/jump keys from a text field — see
      // MuseumScene.tsx's onKeyDown for why (the Achievement claim form's
      // Name input needs an actual space character, not a jump attempt +
      // a swallowed keystroke).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.code === "Space") {
        // Always prevent the browser's own "Space scrolls the page" default
        // — there's nothing to scroll behind this fullscreen view anyway.
        // `!keys.current["Space"]` filters out the OS's held-key auto-repeat
        // keydown storm, so this only fires once per physical press; the
        // grounded check (jumpOffset <= 0) blocks a mid-air re-trigger.
        e.preventDefault();
        if (!keys.current["Space"] && jumpOffset.current <= 0) {
          jumpVelocity.current = JUMP_VELOCITY;
        }
      }
      keys.current[e.code] = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      keys.current[e.code] = false;
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const boundX = ROOM_WIDTH / 2 - WALL_THICKNESS - PLAYER_RADIUS;
  const { southZ: chainSouthZ, northZ: chainNorthZ } = getChainZBounds(layouts);
  const boundZSouth = chainSouthZ - WALL_THICKNESS - PLAYER_RADIUS;
  const boundZNorth = chainNorthZ + WALL_THICKNESS + PLAYER_RADIUS;
  const doorwayBoundX = DOORWAY_WIDTH / 2 - PLAYER_RADIUS;
  // Every internal room-to-room boundary's Z — only these get the narrower
  // doorway clamp; the corridor's two solid end walls don't (there's no
  // opening to walk sideways through there, the normal boundZ clamp is
  // already the right shape).
  const doorwayZs = useMemo(
    () => layouts.filter((l) => l.hasNorthOpening).map((l) => l.northZ),
    [layouts]
  );

  // VR thumbstick locomotion + snap-turn (Docs/Museum_VRMode.md's Phase 4 —
  // "snap-turn, not smooth turn", per that section). Writes rig.position.x/z
  // and rig.rotation.y directly (see @react-three/xr's own implementation);
  // a no-op every frame there's no session or no tracked controller, so
  // this is safe to call unconditionally rather than gating on isPresenting
  // itself. Registered before the main useFrame below so that loop's
  // boundary/obstacle/barrier clamps see this same frame's already-moved
  // position rather than lagging a frame behind it.
  useXRControllerLocomotion(rigRef, { speed: MOVE_SPEED }, { type: "snap" });

  // VR trigger press ("select") -> the same handleActivate() [E] and
  // InteractionPrompt's tap already call — see onActivate's own doc
  // comment above for why this exists at all. `'all'` rather than a
  // specific hand: either controller's trigger should work, same as
  // either hand can hold whichever controller drives translation/rotation
  // in useXRControllerLocomotion above. No-ops with no active session
  // (see useXRInputSourceEvent's own implementation), so unconditional.
  //
  // Only while nothing is open. Outside VR, [E] on an open panel closes
  // it; in VR the same trigger press is also how a ray *clicks* a button
  // on the in-world panel (Wishlist, Next page, ×) — the session-level
  // select fires alongside that click, and letting it toggle the panel
  // closed would dismiss the panel under the very button being pressed.
  // The panel's own × and walking out of range do the closing instead.
  // ...and likewise not when the press landed on the HUD itself (VrHud's
  // Map/Music/Exit VR buttons, a panel's ×): those raise a pointerdown on a
  // VrUi button before this select arrives, see vrUiPressedRecently.
  useXRInputSourceEvent(
    "all",
    "select",
    () => {
      if (!panelOpen && !vrUiPressedRecently()) onActivate?.();
    },
    [onActivate, panelOpen]
  );

  useFrame((_, delta) => {
    const rig = rigRef.current;
    if (!rig) return;
    // VR must never reach the touch look path — the headset owns
    // rotation, and isCoarsePointer/isPresenting are expected to be
    // mutually exclusive in practice, but this is the one place a stray
    // touch-classified XR browser could otherwise fight the headset pose.
    if (isCoarsePointer && !isPresenting) {
      // Drag-to-look: consume whatever pixel delta TouchControls.tsx has
      // accumulated since last frame, then zero it — this ref is the only
      // channel between the touch DOM listeners (outside the Canvas) and
      // this loop, so "consume" has to mean "reset", not just "read".
      const look = lookRef?.current ?? { x: 0, y: 0 };
      yaw.current -= look.x * TOUCH_LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - look.y * TOUCH_LOOK_SENSITIVITY,
        -MAX_PITCH,
        MAX_PITCH
      );
      if (lookRef) lookRef.current = { x: 0, y: 0 };
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch.current, yaw.current, 0);

      // Mobile jump button — same "read = reset" contract as lookRef above,
      // and the same grounded check Space uses on desktop.
      if (jumpRef?.current) {
        jumpRef.current = false;
        if (jumpOffset.current <= 0) jumpVelocity.current = JUMP_VELOCITY;
      }
    }

    // A plain gamepad (lib/museum/gamepad.ts) — read in every mode. In VR
    // it is the only way a phone-in-goggles visitor can walk at all
    // (useXRControllerLocomotion below only hears a headset's own tracked
    // controllers); on a desktop or phone it simply joins the keyboard /
    // on-screen joystick. Movement is added into the same forward/strafe
    // below, so every clamp and collision applies to it unchanged.
    const pad = readMuseumGamepad();
    if (pad.connected) {
      if (isPresenting) {
        // Snap-turn on the rig, like the headset-thumbstick path — never a
        // smooth turn in VR, and never the camera (the headset owns it).
        const x = pad.lookX;
        if (Math.abs(x) < GAMEPAD_SNAP_DEAD_ZONE) gamepadSnapArmed.current = true;
        else if (gamepadSnapArmed.current) {
          gamepadSnapArmed.current = false;
          rig.rotation.y += (x > 0 ? -1 : 1) * GAMEPAD_SNAP_TURN_RAD;
        }
        if (pad.turnLeft) rig.rotation.y += GAMEPAD_SNAP_TURN_RAD;
        if (pad.turnRight) rig.rotation.y -= GAMEPAD_SNAP_TURN_RAD;
      } else {
        // Smooth look on the camera, in the same YXZ yaw/pitch space the
        // mouse (PointerLockControls) and the touch drag both use — read
        // the camera's *current* orientation rather than this component's
        // yaw/pitch refs so it composes with the mouse on desktop, then
        // write those refs back so the touch path (which rebuilds the
        // rotation from them every frame) doesn't undo it.
        if (pad.lookX !== 0 || pad.lookY !== 0 || pad.turnLeft || pad.turnRight) {
          scratchGamepadEuler.setFromQuaternion(camera.quaternion, "YXZ");
          scratchGamepadEuler.y -= pad.lookX * GAMEPAD_LOOK_SPEED * delta;
          if (pad.turnLeft) scratchGamepadEuler.y += GAMEPAD_SNAP_TURN_RAD;
          if (pad.turnRight) scratchGamepadEuler.y -= GAMEPAD_SNAP_TURN_RAD;
          scratchGamepadEuler.x = THREE.MathUtils.clamp(
            scratchGamepadEuler.x + pad.lookY * GAMEPAD_LOOK_SPEED * delta,
            -MAX_PITCH,
            MAX_PITCH
          );
          scratchGamepadEuler.z = 0;
          camera.quaternion.setFromEuler(scratchGamepadEuler);
          yaw.current = scratchGamepadEuler.y;
          pitch.current = scratchGamepadEuler.x;
        }
        // Jump stays a 2D-only thing (see the VR plan's open questions).
        if (pad.jump && jumpOffset.current <= 0) jumpVelocity.current = JUMP_VELOCITY;
      }
      // A / right trigger opens what's in range; B closes what's open —
      // both through the same handleActivate [E] uses (it toggles). The
      // VR pointer-conflict that keeps the *session* select from closing
      // (see useXRInputSourceEvent above) doesn't apply to a gamepad
      // button: it never clicks a panel button.
      if (pad.activate && !panelOpen) onActivate?.();
      if (pad.back && panelOpen) onActivate?.();
    }

    // Keyboard and on-screen joystick are 2D-only (in VR the headset's own
    // controllers move the rig directly via useXRControllerLocomotion, and
    // there's no keyboard); the gamepad joins in every mode. Summing rather
    // than skipping keeps the boundary/doorway/obstacle/barrier clamps
    // further down unconditional — they run every frame regardless of
    // *how* the rig moved, VR included.
    const move = moveRef?.current ?? { x: 0, y: 0 };
    const keyForward = isPresenting
      ? 0
      : isCoarsePointer
        ? move.y
        : (keys.current["KeyW"] || keys.current["ArrowUp"] ? 1 : 0) -
          (keys.current["KeyS"] || keys.current["ArrowDown"] ? 1 : 0);
    const keyStrafe = isPresenting
      ? 0
      : isCoarsePointer
        ? move.x
        : (keys.current["KeyD"] || keys.current["ArrowRight"] ? 1 : 0) -
          (keys.current["KeyA"] || keys.current["ArrowLeft"] ? 1 : 0);
    const forward = THREE.MathUtils.clamp(keyForward + pad.moveY, -1, 1);
    const strafe = THREE.MathUtils.clamp(keyStrafe + pad.moveX, -1, 1);

    if (forward !== 0 || strafe !== 0) {
      // Keyboard input is always a full -1/0/1 combo, so this is 1 for
      // desktop keys (no diagonal speed boost, same as before) — the touch
      // joystick and a gamepad stick are analog, so a half-deflected stick
      // actually walks at half speed instead of snapping to full.
      const analog = isCoarsePointer || pad.moveX !== 0 || pad.moveY !== 0;
      const magnitude = analog ? Math.min(Math.hypot(strafe, forward), 1) : 1;
      direction.current.set(strafe, 0, -forward).normalize();
      // World quaternion, not local: world = rig yaw (0 outside VR) ×
      // camera rotation, which in VR is rig yaw × headset rotation — giving
      // head-relative movement, the correct VR locomotion behaviour. In 2D
      // the rig never rotates, so this is numerically identical to the old
      // `camera.quaternion` read (see Docs/Museum_VRMode.md §3.1).
      camera.getWorldQuaternion(scratchWorldQuat.current);
      direction.current.applyQuaternion(scratchWorldQuat.current);
      direction.current.y = 0;
      if (direction.current.lengthSq() > 0) direction.current.normalize();

      const step = MOVE_SPEED * magnitude * Math.min(delta, 0.1);
      rig.position.x += direction.current.x * step;
      rig.position.z += direction.current.z * step;
    }

    // Boundary/doorway/obstacle/barrier clamps — unconditional, not nested
    // under the `if` above: in VR the rig moves via
    // useXRControllerLocomotion below instead of the forward/strafe path
    // just above, so these have to run every frame regardless of *how*
    // the rig got wherever it currently is, VR included. Harmless overhead
    // on a frame nothing moved — every check below is a no-op against an
    // unchanged position.
    {
      rig.position.x = THREE.MathUtils.clamp(rig.position.x, -boundX, boundX);
      rig.position.z = THREE.MathUtils.clamp(rig.position.z, boundZNorth, boundZSouth);

      // Right at a doorway, the walkable width narrows to the opening
      // itself — its solid side posts would otherwise let the player clip
      // through by hugging a wall while crossing between rooms.
      for (const z of doorwayZs) {
        if (Math.abs(rig.position.z - z) < DOORWAY_CLEARANCE_ZONE) {
          rig.position.x = THREE.MathUtils.clamp(rig.position.x, -doorwayBoundX, doorwayBoundX);
          break;
        }
      }

      // Podiums (and any future floor obstacle): push the camera back out to
      // the edge of anything it just walked into, rather than blocking the
      // whole step. Sliding along the obstacle is what makes it feel solid
      // instead of sticky — a straight "reject the move" would stop a
      // visitor dead when they brush past one at an angle.
      if (obstacles && obstacles.length > 0) {
        // The visitor's own vertical extent, so a height-limited obstacle can
        // be tested against it. Derived from the rig plus `eyeOffset` (not
        // the camera) — see Docs/Museum_VRMode.md §3.2's knock-on note: in
        // VR eyeOffset is 0 and a tall or short visitor's real head height
        // lives on the camera, not the rig, so feet still have to come from
        // the rig itself rather than back-deriving from camera.position.y.
        // The rig's feet are `eyeOffset` below its own position, head at its
        // position (plus jumpOffset is already baked into rig.position.y —
        // see the floor-height line below). A little headroom is
        // deliberately *not* added: brushing the underside of a low ceiling
        // shouldn't stop a walk.
        const feetY = rig.position.y - eyeOffset;
        const headY = rig.position.y;
        for (const obstacle of obstacles) {
          // A column with a set height is only solid where the visitor
          // actually is. Absent bounds mean floor-to-ceiling, which is what
          // every obstacle was before colliderHeight existed.
          if (obstacle.maxY != null && obstacle.maxY <= feetY) continue;
          if (obstacle.minY != null && obstacle.minY >= headY) continue;
          const dx = rig.position.x - obstacle.x;
          const dz = rig.position.z - obstacle.z;
          const minDist = obstacle.radius + PLAYER_RADIUS;
          const distSq = dx * dx + dz * dz;
          if (distSq >= minDist * minDist) continue;
          const dist = Math.sqrt(distSq);
          if (dist === 0) {
            // Exactly on the centre (a teleport landing on one, say) — there's
            // no direction to push along, so pick one deterministically.
            rig.position.x = obstacle.x + minDist;
            continue;
          }
          rig.position.x = obstacle.x + (dx / dist) * minDist;
          rig.position.z = obstacle.z + (dz / dist) * minDist;
        }
      }

      // Divider walls — the same "push back out to the edge, keep sliding"
      // treatment as the circles above, done in each panel's own rotated
      // frame so a divider turned at an angle blocks along its face rather
      // than along the world axes. The player is treated as a circle against
      // a box: expand the box by PLAYER_RADIUS on both axes, and if the
      // camera is inside that expanded rectangle, push it out along whichever
      // axis it is *least* deep into — the shortest way out, which is what
      // makes brushing a panel slide along it instead of snagging.
      if (barriers && barriers.length > 0) {
        for (const barrier of barriers) {
          const cos = Math.cos(barrier.rotationY);
          const sin = Math.sin(barrier.rotationY);
          const dx = rig.position.x - barrier.x;
          const dz = rig.position.z - barrier.z;
          // World → panel-local (inverse of a Y rotation).
          const localX = dx * cos - dz * sin;
          const localZ = dx * sin + dz * cos;
          const limitX = barrier.halfWidth + PLAYER_RADIUS;
          const limitZ = barrier.halfDepth + PLAYER_RADIUS;
          const overlapX = limitX - Math.abs(localX);
          const overlapZ = limitZ - Math.abs(localZ);
          if (overlapX <= 0 || overlapZ <= 0) continue;
          let pushedX = localX;
          let pushedZ = localZ;
          if (overlapX < overlapZ) {
            // Out through one of the panel's narrow ends. Sign of 0 is
            // arbitrary but has to be *a* direction — same reasoning as the
            // dead-centre case in the circular pass above.
            pushedX = (localX < 0 ? -1 : 1) * limitX;
          } else {
            pushedZ = (localZ < 0 ? -1 : 1) * limitZ;
          }
          // Panel-local → world.
          rig.position.x = barrier.x + pushedX * cos + pushedZ * sin;
          rig.position.z = barrier.z - pushedX * sin + pushedZ * cos;
        }
      }
    }
    // Jump arc — integrated every frame regardless of whether a jump is
    // currently in progress (grounded is just jumpVelocity === 0 &&
    // jumpOffset === 0, the resting state this settles into on its own).
    //
    // Disabled outright while presenting: this is Docs/Museum_VRMode.md's
    // "Open questions for later phases" — jump is vertical motion the body
    // doesn't feel, a common VR nausea trigger, and the doc's own text
    // recommends disabling it, just flagging that as a decision someone
    // still had to make. Taking that recommendation as the default here;
    // any stray jumpVelocity a desktop keyboard's Space key set while a
    // session happens to be active (no real headset has a Space key) is
    // simply never integrated, so it can't leave the visitor stuck
    // mid-arc if a session starts/ends mid-jump.
    if (isPresenting) {
      jumpOffset.current = 0;
      jumpVelocity.current = 0;
    } else {
      const jumpDelta = Math.min(delta, 0.1);
      jumpVelocity.current -= JUMP_GRAVITY * jumpDelta;
      jumpOffset.current += jumpVelocity.current * jumpDelta;
      if (jumpOffset.current <= 0) {
        jumpOffset.current = 0;
        jumpVelocity.current = 0;
      }
    }
    // Floor height is a flat constant everywhere except the STAIRS room's
    // ramp (see roomLayout.ts's getFloorYAt) — recomputed every frame so
    // walking across the ramp smoothly raises the rig instead of
    // snapping at the room boundary.
    rig.position.y = getFloorYAt(layouts, rig.position.z) + eyeOffset + jumpOffset.current;

    // Comfort vignette fade — see its setup above. Estimated from how far
    // the rig actually moved in the floor plane this frame, so it responds
    // to *any* source of translation (the XR locomotion hook above, or a
    // MuseumMap teleport) rather than only the hook's own input reading.
    // Forced to 0 outside VR — a visitor who's never in a session should
    // never see it, whatever the (harmless, since rendered nowhere near
    // the camera outside a session) mesh's opacity happens to be sitting at.
    if (vignetteMesh) {
      const material = vignetteMesh.material as THREE.MeshBasicMaterial;
      if (isPresenting) {
        const speed = delta > 0
          ? Math.hypot(rig.position.x - prevRigXZ.current.x, rig.position.z - prevRigXZ.current.y) / delta
          : 0;
        const targetOpacity =
          THREE.MathUtils.clamp(speed / COMFORT_VIGNETTE_MAX_SPEED, 0, 1) * COMFORT_VIGNETTE_MAX_OPACITY;
        vignetteOpacity.current = THREE.MathUtils.damp(
          vignetteOpacity.current,
          targetOpacity,
          COMFORT_VIGNETTE_DAMPING,
          delta
        );
      } else {
        vignetteOpacity.current = 0;
      }
      material.opacity = vignetteOpacity.current;
      vignetteMesh.visible = vignetteOpacity.current > 0.003;
    }
    prevRigXZ.current.set(rig.position.x, rig.position.z);

    // Nearest frame, distance in the floor plane only. `rig.position` is
    // authoritative here — this component just wrote it — so no
    // `getWorldPosition()` round-trip is needed (that's reserved for the
    // external consumers in §4.2 of Docs/Museum_VRMode.md).
    let nearestIndex: number | null = null;
    let nearestDist = Infinity;
    for (let i = 0; i < placements.length; i++) {
      const [x, , z] = placements[i].position;
      const dist = Math.hypot(rig.position.x - x, rig.position.z - z);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    const current = activeRef.current;
    if (current === null) {
      if (nearestIndex !== null && nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeRef.current = nearestIndex;
        onActiveChange(nearestIndex);
      }
    } else {
      const [x, , z] = placements[current].position;
      const distToCurrent = Math.hypot(rig.position.x - x, rig.position.z - z);
      // Switch straight to a different, closer frame the moment it's well
      // within range — not only once the current one has fully exited.
      // Without this, a room with a lot of artworks packed close together
      // (small MAX_FRAME_WIDTH-driven spacing) can trap the visitor on
      // whichever frame activated first: its own EXIT radius comfortably
      // spans several neighboring frames, so distToCurrent never actually
      // crosses EXIT even while standing right in front of a different one.
      if (
        nearestIndex !== null &&
        nearestIndex !== current &&
        nearestDist <= INTERACT_PROXIMITY_ENTER &&
        nearestDist < distToCurrent
      ) {
        activeRef.current = nearestIndex;
        onActiveChange(nearestIndex);
      } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
        activeRef.current = null;
        onActiveChange(null);
      }
    }

    // Which room the visitor is standing in — drives the HUD's room label
    // (see MuseumScene.tsx). `rig.position.z`, not the camera's: authoritative.
    const currentLayout = getLayoutAtZ(layouts, rig.position.z);
    if (currentLayout && currentLayout.room.id !== roomRef.current) {
      roomRef.current = currentLayout.room.id;
      onRoomChange?.(currentLayout.room.id);
    }
  });

  // PointerLockControls is mouse-move + Pointer Lock API only — on touch it
  // has nothing to attach to (and threw the "Unable to use Pointer Lock
  // API" console error visitors were seeing). Rotation on touch is handled
  // entirely above, driven by TouchControls.tsx's lookRef.
  //
  // Unmounted (not merely disabled) while a panel is open, because drei's
  // `enabled` prop does not do what the name suggests here. In its source,
  // `enabled` only gates controls.connect()/disconnect() — the mouse-move
  // rotation. The click-to-lock listener is registered in a *separate*
  // effect that doesn't take `enabled` as a dependency and doesn't check it:
  //
  //     const handler = () => controls.lock();
  //     elements.forEach(el => el.addEventListener('click', handler));
  //
  // and `elements` is [document]. So with the control merely disabled, the
  // very first click a visitor makes inside an open panel re-grabbed the
  // pointer: the cursor they were just given vanished again, and every
  // click and wheel event after that went to the scene behind the panel.
  // Returning null removes that effect along with its listener. The hooks
  // above still run — this component's only JSX is the control itself.
  //
  // Also suppressed while presenting (Docs/Museum_VRMode.md's Phase 3):
  // PointerLockControls is a mouse-move listener with nothing to attach to
  // in VR, same reasoning as the isCoarsePointer case just above it.
  if (isCoarsePointer || panelOpen || isPresenting) return null;

  return (
    <PointerLockControls
      enabled={pointerLockEnabled}
      onLock={() => onLockChange?.(true)}
      onUnlock={handleUnlock}
    />
  );
}
