// lib/admin/toggleToast.ts
//
// One confirmation for every switch in the admin.
//
// A toggle is the one control with no other feedback of its own: a text field
// keeps what you typed, a slider shows where you left it, but a switch that
// saves silently looks exactly like a switch that didn't. Most handlers in
// the admin already toasted; enough didn't that flipping one had become a
// coin toss — the Entrance Splash's own master switch and its Shimmer toggle
// were two of them.
//
// Sound comes free: lib/toast.ts plays the configured effect on every
// toast.success/error, so a switch that toasts is a switch that clicks.
//
// Two shapes, because the admin has two kinds of switch and telling an admin
// something is saved when it isn't would be worse than saying nothing:
//   • toggleSaved()  — the change is already persisted (its own PATCH, or an
//                      optimistic update the handler is about to send)
//   • toggleStaged() — the change lives in a form that has its own Save
//                      button, so the toast says so rather than implying the
//                      switch wrote anything
import toast from "@/lib/toast";

/** What a switch's two states are called. "Enabled/Disabled" fits most, but
 *  plenty of switches are not on/off in any natural reading — Visible/Hidden,
 *  Solid/Walk-through — and forcing those into "enabled" wording makes a
 *  confirmation that has to be translated back by whoever reads it. */
export interface ToggleWords {
  on: string;
  off: string;
}

const DEFAULT_WORDS: ToggleWords = { on: "enabled", off: "disabled" };

function phrase(label: string, on: boolean, words?: Partial<ToggleWords>): string {
  const w = { ...DEFAULT_WORDS, ...words };
  return `${label} ${on ? w.on : w.off}`;
}

/** A switch whose change is already on its way to the database. */
export function toggleSaved(label: string, on: boolean, words?: Partial<ToggleWords>) {
  toast.success(phrase(label, on, words));
}

/** A switch inside a form with its own Save button — the same wording every
 *  other staged control in this admin uses ("… — remember to Save"), so the
 *  distinction between "done" and "pending" is one an admin can read at a
 *  glance rather than one they have to remember per screen. */
export function toggleStaged(label: string, on: boolean, words?: Partial<ToggleWords>) {
  toast.success(`${phrase(label, on, words)} — remember to Save`);
}
