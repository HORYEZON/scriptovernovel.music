// lib/toast.ts
//
// A thin wrapper around react-hot-toast that also plays a sound effect on
// success/error — the one change needed to give "every toast a sound"
// without touching the ~140 individual toast.success()/toast.error() call
// sites across the app. Every file that used to `import toast from
// "react-hot-toast"` now imports it from here instead; nothing else about
// how those call sites are written had to change.
//
// Delete detection: a delete/remove/trash action almost always calls
// toast.success() with a message that says so ("Artwork deleted", "Section
// moved to Trash", "Entry removed", ...) — see lib/sound/registry.ts's
// "admin.delete" key. Rather than hand-wiring a separate sound call into
// every delete handler in the admin, this sniffs the toast's own message for
// that vocabulary and swaps in the delete sound instead of the generic
// success one. It's a heuristic, not a guarantee — a success message that
// happens to use one of these words plays the delete sound too, and a delete
// phrased without them falls back to the generic success sound. Both are
// fine outcomes for a UI cue; if a specific call site ever needs to be exact,
// call playSoundEffect("admin.delete") directly instead of relying on this.
"use client";

import toastLib from "react-hot-toast";
import { playSoundEffect } from "@/lib/sound/engine";

const DELETE_WORDS = /delet|remov|trash|discard/i;

const toast: typeof toastLib = Object.assign(
  ((...args: Parameters<typeof toastLib>) => toastLib(...args)) as typeof toastLib,
  toastLib,
  {
    success: ((message, options) => {
      const text = typeof message === "string" ? message : "";
      playSoundEffect(DELETE_WORDS.test(text) ? "admin.delete" : "toast.success");
      return toastLib.success(message, options);
    }) as typeof toastLib.success,
    error: ((message, options) => {
      playSoundEffect("toast.error");
      return toastLib.error(message, options);
    }) as typeof toastLib.error,
  }
);

export default toast;
