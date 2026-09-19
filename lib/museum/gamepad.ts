// lib/museum/gamepad.ts
//
// One normalised read of whatever Bluetooth/USB gamepad the browser can see,
// for the museum's PlayerControls.tsx — the "any joystick" path.
//
// Why this exists: VR locomotion (useXRControllerLocomotion) only listens to
// *XR input sources* — a headset's own tracked controllers, with a handedness
// and an `xr-standard-thumbstick`. A phone in Cardboard-style goggles has
// none; the controller a visitor buys for it is an ordinary Bluetooth gamepad
// that reaches the page through the Gamepad API instead (`navigator
// .getGamepads()`), which keeps working inside an immersive session because
// it was never tied to XR. And once that path exists, it's just as useful on
// a desktop or a phone outside VR, so it's read in every mode.
//
// "Universal" is the brief, and gamepads are anything but uniform. What is
// nearly so: axes[0]/[1] are the left stick (or the only stick), and
// buttons[0] is the primary face button. Everything else is best-effort:
//   - Right stick: axes[2]/[3] under the W3C "standard" mapping; the same
//     pair on most non-standard ones, but some Android controllers put the
//     hat/d-pad on axes[6]/[7] and a trigger on [2]/[5]. A trigger's resting
//     value is -1 (or 0), so an axis parked at ±1 is ignored as a look input.
//   - Turning has a stick-independent fallback: the shoulder buttons
//     (buttons[4]/[5]) always turn left/right.
//   - D-pad: buttons[12..15] on standard, axes[6]/[7] hat on some others.
//   - "Activate" is buttons[0] (A / × / the primary) OR buttons[7] (right
//     trigger) — cheap "VR remotes" tend to put their one trigger on one of
//     those two.
// No per-brand tables: a table is only ever as complete as the controllers
// its author owned.
//
// Dead zones are radial with a smooth ramp out of them, so a stick that
// rests slightly off-centre doesn't creep and a light deflection still walks
// slowly (same feel as the on-screen joystick). Button presses are reported
// as edges — true on the frame they go down, not while held — so a press is
// one action, whatever the frame rate.

export interface MuseumGamepadInput {
  /** True when any gamepad was read this frame — lets callers know the
   *  values below are real zeros, not "no controller". */
  connected: boolean;
  /** Left stick, -1..1, dead-zoned and ramped; +y is forward. */
  moveX: number;
  moveY: number;
  /** Right stick, -1..1, dead-zoned and ramped; +x is right, +y is up. */
  lookX: number;
  lookY: number;
  /** Edges (down this frame). */
  activate: boolean;
  back: boolean;
  jump: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

const STICK_DEAD_ZONE = 0.18;

const NONE: MuseumGamepadInput = {
  connected: false,
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  activate: false,
  back: false,
  jump: false,
  turnLeft: false,
  turnRight: false,
};

// Previous frame's button state per gamepad index, for edge detection.
const previousButtons = new Map<number, boolean[]>();

/** Radial dead zone with a linear ramp from its edge to full deflection. */
function deadZone(x: number, y: number): [number, number] {
  const r = Math.hypot(x, y);
  if (r < STICK_DEAD_ZONE) return [0, 0];
  const scaled = Math.min(1, (r - STICK_DEAD_ZONE) / (1 - STICK_DEAD_ZONE));
  return [(x / r) * scaled, (y / r) * scaled];
}

/** An axis parked at ±1 is a trigger at rest, not a stick. */
function stickAxis(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  if (Math.abs(value) > 0.98) return 0;
  return value;
}

function pressed(buttons: readonly GamepadButton[], index: number): boolean {
  const b = buttons[index];
  return b != null && (b.pressed || b.value > 0.5);
}

/**
 * Reads the first connected gamepad that has at least one stick. Call once
 * per frame; the edge detection depends on it.
 */
export function readMuseumGamepad(): MuseumGamepadInput {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return NONE;
  let pads: (Gamepad | null)[];
  try {
    pads = navigator.getGamepads();
  } catch {
    // Some browsers throw here in a cross-origin frame or without a
    // permissions-policy allowance — no controller, not an error.
    return NONE;
  }
  const pad = pads.find((p) => p != null && p.connected && p.axes.length >= 2) ?? null;
  if (!pad) return NONE;

  const axes = pad.axes;
  const buttons = pad.buttons;
  const standard = pad.mapping === "standard";

  // Left stick — near-universal. Gamepad y is +down; the museum's forward
  // is +y, so flip.
  let [moveX, moveY] = deadZone(axes[0] ?? 0, -(axes[1] ?? 0));

  // D-pad as digital movement on top.
  let dpadX = 0;
  let dpadY = 0;
  if (standard) {
    if (pressed(buttons, 12)) dpadY += 1;
    if (pressed(buttons, 13)) dpadY -= 1;
    if (pressed(buttons, 14)) dpadX -= 1;
    if (pressed(buttons, 15)) dpadX += 1;
  } else if (axes.length >= 8) {
    // Android-style hat on axes 6/7 — exactly ±1 when pressed.
    const hx = axes[6] ?? 0;
    const hy = axes[7] ?? 0;
    if (Math.abs(hx) > 0.5) dpadX += Math.sign(hx);
    if (Math.abs(hy) > 0.5) dpadY -= Math.sign(hy);
  }
  if (dpadX !== 0 || dpadY !== 0) {
    moveX = Math.max(-1, Math.min(1, moveX + dpadX));
    moveY = Math.max(-1, Math.min(1, moveY + dpadY));
  }

  // Right stick — standard puts it on 2/3; most others too. An axis parked
  // at ±1 is a trigger and is ignored.
  const [lookX, lookY] = axes.length >= 4 ? deadZone(stickAxis(axes[2]), -stickAxis(axes[3])) : [0, 0];

  // Edges.
  const now = buttons.map((b) => b.pressed || b.value > 0.5);
  const prev = previousButtons.get(pad.index) ?? [];
  const edge = (i: number) => Boolean(now[i]) && !prev[i];
  previousButtons.set(pad.index, now);

  return {
    connected: true,
    moveX,
    moveY,
    lookX,
    lookY,
    // Primary face button or the right trigger — see the header.
    activate: edge(0) || edge(7),
    back: edge(1),
    // Y / △ (index 3) — the top face button, on every layout that has four.
    jump: edge(3),
    turnLeft: edge(4),
    turnRight: edge(5),
  };
}
