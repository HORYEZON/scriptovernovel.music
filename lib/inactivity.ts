// lib/inactivity.ts
//
// Shared vocabulary for the admin panel's inactivity auto sign-out
// (Settings ▸ Security). Client-safe — no prisma import — because the API
// route that validates the setting, the Security page that renders the
// choices, and the guard that actually counts the idle time all need the same
// list of intervals.

/** The intervals Settings ▸ Security offers. */
export const INACTIVITY_OPTIONS = [
  { minutes: 10, label: "10 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
] as const;

export type InactivityMinutes = (typeof INACTIVITY_OPTIONS)[number]["minutes"];

export const DEFAULT_INACTIVITY_MINUTES: InactivityMinutes = 30;

export function isValidInactivityMinutes(value: unknown): value is InactivityMinutes {
  return INACTIVITY_OPTIONS.some((o) => o.minutes === value);
}

/**
 * How long the "you're about to be signed out" countdown is shown for, in
 * seconds — subtracted from the interval, not added to it, so choosing
 * "10 minutes" means signed out at ten minutes, not at eleven.
 *
 * Long enough to notice and react to on a screen someone has walked back to,
 * short enough that it isn't a second timeout of its own.
 */
export const INACTIVITY_WARNING_SECONDS = 60;

/**
 * The browser events that count as "still here".
 *
 * `scroll` and `wheel` matter as much as the pointer ones — reading a long
 * Orders list without touching the mouse is not idleness, and an earlier
 * shape of this that watched only clicks and keys logged people out
 * mid-read. `visibilitychange` is handled separately (see the guard): a tab
 * coming back to the foreground is a person returning, but a tab going to the
 * background is not activity.
 */
export const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
  "pointerdown",
] as const;

/**
 * Where the last-activity timestamp is shared between tabs.
 *
 * It has to be shared. Without it, an admin working in one tab with a second
 * admin tab open in the background gets signed out of both by the idle one —
 * the timer would be measuring the tab, when the thing it means to measure is
 * the person. localStorage (rather than sessionStorage) is what makes the
 * `storage` event fire in the *other* tabs, which is the whole mechanism.
 */
export const INACTIVITY_STORAGE_KEY = "scriptovernovel:admin:last-activity";
