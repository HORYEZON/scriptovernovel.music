"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpFromLine } from "lucide-react";
import { JOYSTICK_RADIUS, LOOK_JOYSTICK_SCREENS_PER_SEC, GYRO_LOOK_SENSITIVITY } from "./roomConstants";
import toast from "@/lib/toast";

/**
 * Touch input surface for the museum's mobile 3D view — sits as an HTML
 * sibling of the <Canvas> (not inside it), since it just needs to mutate
 * two refs that PlayerControls.tsx reads from its useFrame loop each tick.
 * No React state round-trips through the R3F tree on every touch move.
 *
 * Two independent zones in the default (portrait) layout, both tracked by
 * touch identifier so a visitor can hold the joystick with one thumb and
 * drag to look with the other at the same time:
 *  - Bottom-left joystick: touches starting inside it drive `moveRef`
 *    (normalized -1..1 strafe/forward), reset to {0,0} on release.
 *  - Everywhere else: touches accumulate drag deltas into `lookRef`:
 *    PlayerControls consumes (and zeroes) that accumulator once per frame.
 *
 * `landscapeMode` (MuseumClient.tsx's forced-landscape toggle) adds a
 * right-side joystick as a *second*, independent way to look around —
 * both it and the free-drag-anywhere zone stay active together (per
 * explicit user request: dragging the background should still turn the
 * camera exactly as it does in portrait, the joystick is an addition, not
 * a replacement). The right stick pushes into the same `lookRef`
 * accumulator every animation frame it's held (scaled by
 * LOOK_JOYSTICK_SCREENS_PER_SEC), which is why PlayerControls.tsx needs no changes
 * at all to support it — from its side this looks identical to a very
 * fast, continuous drag, and the two compose by simple addition.
 *
 * `gyroEnabled` (device tilt controls the camera) pushes into that exact
 * same accumulator too, so it can be used together with either look
 * method rather than needing its own separate consumption path.
 */
export function TouchControls({
  moveRef,
  lookRef,
  jumpRef,
  landscapeMode = false,
  gyroEnabled = false,
  rotatedViewport = false,
}: {
  moveRef: React.RefObject<{ x: number; y: number }>;
  lookRef: React.RefObject<{ x: number; y: number }>;
  /** A discrete tap flag (not a held/analog value) — PlayerControls.tsx
   * reads and resets it back to false the same frame, same "read = reset"
   * contract as lookRef's accumulator. */
  jumpRef: React.RefObject<boolean>;
  /** MuseumClient.tsx's forced-landscape toggle — see this file's doc
   * comment for how it changes the look control from free-drag to a
   * second joystick. */
  landscapeMode?: boolean;
  /** MuseumClient.tsx's gyroscope toggle — device tilt feeds lookRef
   * alongside whichever manual look method is active. Permission is
   * requested by the toggle button itself (a user gesture, required on
   * iOS 13+), so this only ever turns on once that's already granted. */
  gyroEnabled?: boolean;
  /** True only while MuseumClient.tsx's forced-landscape CSS `rotate(90deg)`
   * is genuinely applied to this subtree — distinct from `landscapeMode`
   * above, which is merely the *preference* and stays on even when the
   * visitor has physically turned the phone (at which point there's no
   * transform and screen axes already match content axes). See
   * `toContentSpace` below for what it corrects. */
  rotatedViewport?: boolean;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Right-side look joystick — only mounted/tracked in landscape mode (see
  // the render below). Deflection, not a delta: a small rAF loop further
  // down pushes it into lookRef continuously for as long as it's held,
  // same idea as PlayerControls.tsx's own movement loop reading moveRef.
  const lookBaseRef = useRef<HTMLDivElement>(null);
  const [lookKnob, setLookKnob] = useState({ x: 0, y: 0 });
  const lookJoystickTouchId = useRef<number | null>(null);
  const lookJoystickVector = useRef({ x: 0, y: 0 });

  useEffect(() => {
    /** Rotates a screen-space touch vector into the *content's* axes.
     *
     * MuseumClient.tsx's forced-landscape trick wraps this whole subtree in
     * a CSS `rotate(90deg)`. The browser hit-tests taps through that
     * transform natively, so a touch's absolute clientX/clientY still lands
     * on the right element and getBoundingClientRect() still reports the
     * right on-screen center — but a *delta* between two touch points is
     * still expressed in unrotated screen axes, and every consumer here
     * wants the content's:
     *  - lookRef feeds PlayerControls' yaw/pitch, which are horizontal and
     *    vertical *in the rendered view* (i.e. post-rotation),
     *  - moveRef's strafe/forward are likewise relative to that view,
     *  - and the knob's own `translate()` is applied *inside* the rotated
     *    coordinate system, so a screen-space offset slides it 90° away
     *    from the thumb pushing it.
     * Un-corrected, dragging the background turned the camera 90° off from
     * the drag (drag right → pitch up, drag down → yaw left) and the right
     * look stick did the same — the reported "camera angle and movement not
     * working properly" that portrait, with no transform in play, never had.
     *
     * `rotate(90deg)` maps a content offset (u,v) to the screen offset
     * (-v, u); inverting that gives screen (a,b) → content (b, -a). */
    function toContentSpace(dx: number, dy: number) {
      return rotatedViewport ? { x: dy, y: -dx } : { x: dx, y: dy };
    }

    function isInBase(base: HTMLDivElement | null, clientX: number, clientY: number) {
      if (!base) return false;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Generous hit radius (2x the visual base) — thumbs are imprecise and
      // a visitor shouldn't have to land exactly inside a ~90px circle.
      return Math.hypot(clientX - cx, clientY - cy) <= rect.width;
    }

    /** Shared math for both sticks — returns the clamped {x,y} deflection
     * (both the raw pixel offset for the visual knob, and the -1..1
     * normalized vector) around whichever base element is given. */
    function readStick(base: HTMLDivElement | null, clientX: number, clientY: number) {
      if (!base) return null;
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // The center above is correct as-is (a rotation leaves an element's
      // on-screen center where it is), but the offset *from* it is a vector
      // and so needs the same screen→content correction as a drag delta —
      // both because moveRef/lookJoystickVector are read in view axes and
      // because knobPx is fed to a `translate()` inside the rotated box.
      const { x: dx, y: dy } = toContentSpace(clientX - cx, clientY - cy);
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      const knobPx = { x: Math.cos(angle) * clampedDist, y: Math.sin(angle) * clampedDist };
      return { knobPx, vector: { x: knobPx.x / JOYSTICK_RADIUS, y: knobPx.y / JOYSTICK_RADIUS } };
    }

    function updateJoystick(clientX: number, clientY: number) {
      const stick = readStick(baseRef.current, clientX, clientY);
      if (!stick) return;
      setKnob(stick.knobPx);
      // Joystick "up" (negative screen Y) means walk forward.
      moveRef.current = { x: stick.vector.x, y: -stick.vector.y };
    }

    function updateLookJoystick(clientX: number, clientY: number) {
      const stick = readStick(lookBaseRef.current, clientX, clientY);
      if (!stick) return;
      setLookKnob(stick.knobPx);
      lookJoystickVector.current = stick.vector;
    }

    function resetJoystick() {
      joystickTouchId.current = null;
      setKnob({ x: 0, y: 0 });
      moveRef.current = { x: 0, y: 0 };
    }

    function resetLookJoystick() {
      lookJoystickTouchId.current = null;
      setLookKnob({ x: 0, y: 0 });
      lookJoystickVector.current = { x: 0, y: 0 };
    }

    function onTouchStart(e: TouchEvent) {
      for (const touch of Array.from(e.changedTouches)) {
        if (
          joystickTouchId.current === null &&
          isInBase(baseRef.current, touch.clientX, touch.clientY)
        ) {
          joystickTouchId.current = touch.identifier;
          updateJoystick(touch.clientX, touch.clientY);
        } else if (
          landscapeMode &&
          lookJoystickTouchId.current === null &&
          isInBase(lookBaseRef.current, touch.clientX, touch.clientY)
        ) {
          lookJoystickTouchId.current = touch.identifier;
          updateLookJoystick(touch.clientX, touch.clientY);
        } else if (lookTouchId.current === null) {
          // Free-drag-anywhere look — active in landscape mode too now (a
          // second, independent touch can still drag-look here at the same
          // time a thumb holds the right joystick; they just add into the
          // same lookRef accumulator).
          lookTouchId.current = touch.identifier;
          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === joystickTouchId.current) {
          e.preventDefault();
          updateJoystick(touch.clientX, touch.clientY);
        } else if (touch.identifier === lookJoystickTouchId.current) {
          e.preventDefault();
          updateLookJoystick(touch.clientX, touch.clientY);
        } else if (touch.identifier === lookTouchId.current) {
          e.preventDefault();
          const drag = toContentSpace(
            touch.clientX - lastLookPos.current.x,
            touch.clientY - lastLookPos.current.y
          );
          lookRef.current = {
            x: lookRef.current.x + drag.x,
            y: lookRef.current.y + drag.y,
          };
          lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      for (const touch of Array.from(e.changedTouches)) {
        if (touch.identifier === joystickTouchId.current) resetJoystick();
        if (touch.identifier === lookJoystickTouchId.current) resetLookJoystick();
        if (touch.identifier === lookTouchId.current)
          lookTouchId.current = null;
      }
    }

    // Non-passive so preventDefault() on move actually stops the page from
    // scrolling/pull-to-refreshing under a drag — must be on the element
    // itself; React's synthetic touchmove handler is passive by default.
    const el = document.getElementById("museum-touch-surface");
    el?.addEventListener("touchstart", onTouchStart, { passive: true });
    el?.addEventListener("touchmove", onTouchMove, { passive: false });
    el?.addEventListener("touchend", onTouchEnd, { passive: true });
    el?.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el?.removeEventListener("touchstart", onTouchStart);
      el?.removeEventListener("touchmove", onTouchMove);
      el?.removeEventListener("touchend", onTouchEnd);
      el?.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [moveRef, lookRef, landscapeMode, rotatedViewport]);

  // Continuously pushes the right joystick's current deflection into
  // lookRef for as long as it's held — a joystick is a *rate* (how fast to
  // keep turning), not a one-shot delta the way a drag gesture is, so this
  // needs its own per-frame loop rather than only updating on touchmove.
  // Plain requestAnimationFrame (not R3F's useFrame) since this component
  // is a DOM sibling of <Canvas>, not inside it.
  useEffect(() => {
    if (!landscapeMode) return;
    let raf: number;
    let last = performance.now();
    function tick(now: number) {
      // Clamp dt — a dropped frame or a tab coming back from background
      // (both common on mobile) can hand this a multi-hundred-ms gap, which
      // would otherwise instantly snap-rotate the camera by however much
      // that stale window of "held deflection" adds up to (read as the
      // view suddenly jerking/"likot" the moment the stick is touched
      // again) instead of turning smoothly.
      const dt = Math.min(now - last, 50);
      last = now;
      // One "screen" along the view's own horizontal axis. Under the
      // forced-landscape rotate the view is turned 90°, so the span a drag
      // crosses is the window's *height* — the same axis swap toContentSpace
      // applies to drag deltas. Read per tick rather than cached: it's a
      // cheap property read (no forced layout) and it stays correct through
      // rotation and browser-chrome resizes without a resize listener.
      const screenSpan = rotatedViewport ? window.innerHeight : window.innerWidth;
      const v = lookJoystickVector.current;
      const magnitude = Math.hypot(v.x, v.y);
      // Small deadzone — a thumb resting on the stick without meaning to
      // push it (or a barely-off-center release) was registering as a
      // faint but constant rotation, which read as the camera drifting/
      // fighting the visitor ("magulo, mahirap galawin") rather than
      // sitting still until actually deflected.
      if (magnitude > 0.15) {
        // Emitted in the same "pixels of equivalent drag" unit a real finger
        // drag writes into lookRef, so PlayerControls needs no special case:
        // full deflection for one second == LOOK_JOYSTICK_SCREENS_PER_SEC
        // full-screen swipes.
        const perMs = (screenSpan * LOOK_JOYSTICK_SCREENS_PER_SEC) / 1000;
        lookRef.current = {
          x: lookRef.current.x + v.x * perMs * dt,
          y: lookRef.current.y + v.y * perMs * dt,
        };
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [landscapeMode, lookRef, rotatedViewport]);

  // Gyroscope — device tilt feeds the same lookRef accumulator as a manual
  // drag/joystick would, as a *delta* between consecutive readings, so it
  // composes with whichever manual method is also active instead of
  // fighting it. MuseumClient.tsx's toggle button is what actually requests
  // permission (a real user gesture, required on iOS 13+) before ever
  // setting gyroEnabled true, so this effect assumes that's already settled.
  //
  // What it does NOT do is difference alpha and beta directly, which is
  // what it used to do and why tilt-to-look misbehaved in both orientations:
  //
  //  - alpha/beta/gamma are intrinsic Z-X'-Y'' Euler angles, and Euler
  //    angles go degenerate at their singularities. Portrait's is beta=90 —
  //    which is *exactly* how you hold a phone to look at its screen. There
  //    alpha and gamma trade off freely: alpha can swing from -45° to +90°
  //    while the phone hasn't actually moved at all. Differencing alpha
  //    injected that phantom swing straight into the camera, which is the
  //    jitter/drift that read as "not working properly."
  //  - Landscape's singularity is the other one, gamma=±90, and there the
  //    tilt shows up almost entirely *in gamma* while beta stays near 0.
  //    The old code never read gamma, so pitch simply didn't work there.
  //
  // The fix is to stop reading individual angles and rebuild the one thing
  // that's actually well-defined at both singularities: the direction the
  // back of the phone points, in world space. Composing all three angles
  // (R = Rz(alpha)·Rx(beta)·Ry(gamma), applied to the device's -Z axis)
  // cancels the degeneracy — when alpha and gamma trade off against each
  // other, this vector doesn't move — and yaw/pitch read off that vector
  // are stable and continuous in every pose.
  //
  // That also makes this correct under the forced-landscape CSS rotate for
  // free, with no `rotatedViewport` correction of the kind the touch
  // handlers above need: those read *screen* axes, but this reads where the
  // phone is physically aimed, which no CSS transform changes. Point the
  // phone at something and the camera looks at it, however the page is
  // rotated. Roll is deliberately dropped — the camera never rolls.
  useEffect(() => {
    if (!gyroEnabled) return;
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      toast.error("This device doesn't support tilt-to-look.");
      return;
    }
    const DEG = Math.PI / 180;
    let lastYaw: number | null = null;
    let lastPitch: number | null = null;
    // Exponential smoothing on the per-event delta — cheap phone gyros are
    // noisy, and feeding every raw reading straight into the camera is
    // visibly jittery. Keeping a running smoothed value and blending each
    // new reading into it trades a little latency for a much steadier feel.
    let smoothYaw = 0;
    let smoothPitch = 0;
    let gotEvent = false;
    // Chrome/Android fires BOTH "deviceorientation" and the non-standard
    // "deviceorientationabsolute", and they use different reference frames
    // (relative vs magnetometer-absolute). Both were previously wired to one
    // handler sharing a single "last reading", so on those browsers the two
    // streams interleaved and every delta was measured against the *other*
    // frame's reading — pure garbage, on top of the Euler problems above.
    // Now the first stream to deliver a usable reading wins and the other is
    // ignored for the rest of the session.
    let source: string | null = null;

    function onOrientation(e: DeviceOrientationEvent) {
      if (e.alpha == null || e.beta == null || e.gamma == null) return;
      if (source === null) source = e.type;
      else if (e.type !== source) return;
      gotEvent = true;

      const a = e.alpha * DEG;
      const b = e.beta * DEG;
      const g = e.gamma * DEG;
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const sb = Math.sin(b);
      const cb = Math.cos(b);
      const sg = Math.sin(g);
      const cg = Math.cos(g);
      // Rz(a)·Rx(b)·Ry(g) applied to (0,0,-1) — the device's own "out the
      // back" axis, which is where its camera (and so the visitor's gaze)
      // points. World axes are X=east, Y=north, Z=up.
      const dx = -ca * sg - sa * sb * cg;
      const dy = -sa * sg + ca * sb * cg;
      const dz = -cb * cg;
      // Heading, measured clockwise from north, and elevation. The vector is
      // unit-length (it's a rotation of a unit axis), so asin is safe — the
      // clamp is only guarding float drift at exactly ±1.
      const yaw = Math.atan2(dx, dy) / DEG;
      const pitch = Math.asin(Math.max(-1, Math.min(1, dz))) / DEG;

      if (lastYaw !== null && lastPitch !== null) {
        // Heading wraps at ±180 — take the shorter signed way around that
        // circle rather than a raw subtraction, which would spike by ~360
        // every time a turn crosses the wrap point.
        let dYaw = yaw - lastYaw;
        if (dYaw > 180) dYaw -= 360;
        if (dYaw < -180) dYaw += 360;
        let dPitch = pitch - lastPitch;
        // Clamp a single reading's jump — a momentary bad sample (common
        // right after enabling, before the sensor settles) could otherwise
        // snap the camera by tens of degrees in one event.
        dYaw = Math.max(-15, Math.min(15, dYaw));
        dPitch = Math.max(-15, Math.min(15, dPitch));
        smoothYaw = smoothYaw * 0.7 + dYaw * 0.3;
        smoothPitch = smoothPitch * 0.7 + dPitch * 0.3;
        // Signs: PlayerControls does `yaw -= look.x` (so turning the phone
        // clockwise, i.e. rising heading, needs a positive x to turn the
        // camera right) and `pitch -= look.y` (so raising the phone, i.e.
        // rising elevation, needs a negative y to look up).
        lookRef.current = {
          x: lookRef.current.x + smoothYaw * GYRO_LOOK_SENSITIVITY,
          y: lookRef.current.y - smoothPitch * GYRO_LOOK_SENSITIVITY,
        };
      }
      lastYaw = yaw;
      lastPitch = pitch;
    }

    window.addEventListener("deviceorientation", onOrientation);
    // Only fall back to the non-standard event if the standard one turns out
    // to deliver nothing — some Android/Chrome builds never populate the
    // plain event's angles and fire only this one. Deferring rather than
    // registering both up front means the standard, relative-frame stream
    // wins wherever it works, which is the steadier of the two indoors.
    const fallbackTimer = window.setTimeout(() => {
      if (!gotEvent) {
        window.addEventListener("deviceorientationabsolute", onOrientation as EventListener);
      }
    }, 400);
    // If nothing arrived within a couple seconds, this device/browser is
    // silently never going to send motion data (permission quietly denied,
    // no sensor, or an in-app browser stripping sensor access) — surface
    // that instead of leaving the toggle looking "on" but doing nothing.
    const watchdog = window.setTimeout(() => {
      if (!gotEvent) toast.error("No motion data received — tilt-to-look isn't available here.");
    }, 2500);
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("deviceorientationabsolute", onOrientation as EventListener);
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(watchdog);
    };
  }, [gyroEnabled, lookRef]);

  return (
    <>
      <div
        id="museum-touch-surface"
        className="absolute inset-0 z-20"
        style={{ touchAction: "none" }}
      >
        {/* Offsets padded with env(safe-area-inset-*) on top of the base
            spacing — the forced-landscape CSS-rotate trick (MuseumClient.tsx)
            decouples "bottom"/"left" here from whichever real physical edge
            they end up nearest, and a control sitting within a device's
            reserved edge-gesture strip (iOS home-indicator swipe, Safari's
            edge-swipe-back) can have its taps silently eaten by the OS
            instead of reaching this element at all. The safe-area insets
            are the platform's own answer to "how much to clear," so adding
            them defends every corner at once rather than guessing which one
            this control happens to land on after the rotate. */}
        <div
          ref={baseRef}
          className="absolute w-24 h-24 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm"
          style={{
            bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
            left: "calc(1.5rem + env(safe-area-inset-left, 0px))",
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 w-11 h-11 rounded-full bg-white/70 shadow-lg"
            style={{
              transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)`,
              transition:
                knob.x === 0 && knob.y === 0
                  ? "transform 0.15s ease-out"
                  : undefined,
            }}
          />
        </div>

        {/* Right look joystick — landscape mode only (see this file's doc
            comment). Mirrors the move joystick's own offsets (same bottom
            clearance, same distance in from its edge) so the two sit level
            with each other instead of one looking randomly higher. Jump
            sits directly above this one (same `right` offset, see below). */}
        {landscapeMode && (
          <div
            ref={lookBaseRef}
            className="absolute w-24 h-24 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm"
            style={{
              bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
              right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
            }}
          >
            <div
              className="absolute top-1/2 left-1/2 w-11 h-11 rounded-full bg-white/70 shadow-lg"
              style={{
                transform: `translate(-50%, -50%) translate(${lookKnob.x}px, ${lookKnob.y}px)`,
                transition:
                  lookKnob.x === 0 && lookKnob.y === 0
                    ? "transform 0.15s ease-out"
                    : undefined,
              }}
            />
          </div>
        )}
      </div>

      {/* Jump — a plain tap button rather than another zone inside
          #museum-touch-surface: that element's own touchstart listener
          (above) treats "anywhere not a joystick" as a look-drag, so a tap
          here would double as an unwanted camera flick if it lived inside
          that div. As a sibling instead, the touch never reaches that
          listener in the first place. Directly above the look joystick in
          landscape mode (same `right` offset — stacked, not off to a
          corner) with enough clearance above it to never overlap. */}
      <button
        type="button"
        aria-label="Jump"
        onTouchStart={(e) => {
          e.preventDefault();
          jumpRef.current = true;
        }}
        className="absolute z-30 w-16 h-16 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm flex items-center justify-center text-white/80 active:bg-black/40 active:scale-95 transition-transform"
        style={
          landscapeMode
            ? {
                touchAction: "none",
                bottom: "calc(9rem + env(safe-area-inset-bottom, 0px))",
                right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
              }
            : {
                touchAction: "none",
                bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
                right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
              }
        }
      >
        <ArrowUpFromLine size={24} />
      </button>
    </>
  );
}
