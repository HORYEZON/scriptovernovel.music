// components/admin/InactivityTimeout.tsx
"use client";

// Signs the admin out after a stretch of no interaction — the enforcement half
// of Settings ▸ Security ▸ Automatic Sign-Out. Mounted once in
// app/(admin)/layout.tsx, so it covers every admin screen and survives
// client-side navigation between them.
//
// Renders nothing at all while the setting is off, and nothing but a warning
// dialog when it is on. Three things about how it counts are worth knowing:
//
//  1. **Idleness is measured per person, not per tab.** The last-activity
//     timestamp lives in localStorage and every tab writes to it, so working
//     in one admin tab keeps the others alive. Measuring per tab would sign
//     someone out of the window they are typing in because a second tab sat
//     idle behind it.
//
//  2. **The clock is wall time, not a setTimeout.** A laptop that sleeps for
//     an hour does not fire timers while it is closed; a timeout scheduled for
//     30 minutes would come due late, and only once the machine woke. So the
//     poll below compares stored timestamps against Date.now(), which means a
//     machine that was asleep past the interval signs out the moment it wakes
//     — which is the correct answer for a screen that was unattended.
//
//  3. **Activity is throttled to a write a second.** ACTIVITY_EVENTS includes
//     mousemove; writing to localStorage on every one of those would be a
//     storage write per animation frame, and a `storage` event fired at every
//     other tab each time.

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  ACTIVITY_EVENTS,
  INACTIVITY_STORAGE_KEY,
  INACTIVITY_WARNING_SECONDS,
} from "@/lib/inactivity";
import { useAdminLeaveGuard } from "./AdminLeaveGuard";

/** How often the idle check runs. A second is precise enough for a countdown
 *  that only ever shows whole seconds, and cheap enough to be uninteresting. */
const POLL_MS = 1000;

/** Minimum gap between localStorage writes, so a mousemove burst is one
 *  write rather than sixty. */
const WRITE_THROTTLE_MS = 1000;

function readLastActivity(): number {
  try {
    const raw = window.localStorage.getItem(INACTIVITY_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    // A missing or corrupt value means "no evidence of idleness", which has
    // to read as *active* — treating it as idle would sign someone out on
    // their first page load in a fresh browser profile.
    return Number.isFinite(parsed) ? parsed : Date.now();
  } catch {
    // Private mode, or storage blocked. The feature degrades to per-tab
    // timing rather than failing; see markActive.
    return Date.now();
  }
}

export function InactivityTimeout({
  enabled,
  minutes,
}: {
  enabled: boolean;
  minutes: number;
}) {
  const router = useRouter();
  const { confirmLeave } = useAdminLeaveGuard();

  // Seconds left before sign-out, or null while the admin is not yet inside
  // the warning window. Null is also what closes the dialog.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Fallback when localStorage is unavailable, and the value the poll reads
  // when it is: kept in a ref because the poll must not re-subscribe on every
  // mouse movement.
  const lastActivityRef = useRef<number>(Date.now());
  // Guards against firing signOut twice — the poll could tick again while the
  // first sign-out is still in flight.
  const signingOutRef = useRef(false);

  const markActive = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < WRITE_THROTTLE_MS) return;
    lastActivityRef.current = now;
    try {
      window.localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
    } catch {
      // Storage blocked — lastActivityRef alone still drives this tab's own
      // timer correctly. Only the cross-tab sharing is lost.
    }
  }, []);

  // "I'm still here", from the warning dialog's button. Bypasses the throttle
  // and the dialog: an explicit click is unambiguous.
  const staySignedIn = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      window.localStorage.setItem(INACTIVITY_STORAGE_KEY, String(now));
    } catch {
      /* see markActive */
    }
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      // Leaving the dialog on screen after the setting is switched off would
      // be a countdown that can never complete.
      setSecondsLeft(null);
      return;
    }

    // Arriving on an admin page is itself activity — without this the timer
    // would start from whatever stale timestamp the last session left behind.
    staySignedIn();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }

    // Another tab reporting activity is this tab's activity too — that is the
    // cross-tab mechanism, and it is why the key lives in localStorage.
    function onStorage(e: StorageEvent) {
      if (e.key !== INACTIVITY_STORAGE_KEY || !e.newValue) return;
      const value = Number(e.newValue);
      if (Number.isFinite(value) && value > lastActivityRef.current) {
        lastActivityRef.current = value;
        setSecondsLeft(null);
      }
    }
    window.addEventListener("storage", onStorage);

    // Bringing a backgrounded tab to the front is a person returning to it.
    // The reverse is not activity, so only the visible direction counts.
    function onVisibility() {
      if (document.visibilityState === "visible") markActive();
    }
    document.addEventListener("visibilitychange", onVisibility);

    const timeoutMs = minutes * 60 * 1000;
    const warningMs = INACTIVITY_WARNING_SECONDS * 1000;

    const interval = window.setInterval(() => {
      if (signingOutRef.current) return;

      // Re-read from storage rather than trusting the ref: the `storage`
      // event does not fire in the tab that wrote the value, but it also does
      // not fire at all in some restored-from-bfcache cases.
      const stored = readLastActivity();
      const last = Math.max(lastActivityRef.current, stored);
      lastActivityRef.current = last;

      const idleMs = Date.now() - last;

      if (idleMs >= timeoutMs) {
        // A screen with something to lose gets the last word. `confirmLeave`
        // asks the admin (via AdminLeaveGuard) only when a blocker objects —
        // an in-flight backup or restore, unsaved Scene Editor work. Refusing
        // there resets the timer rather than ending the session.
        //
        // This is a real, deliberate softening of the guarantee: an idle
        // screen mid-restore stays signed in. The alternative is a timeout
        // that corrupts a half-written database to enforce a convenience
        // feature, and that trade is not close.
        if (!confirmLeave("signout")) {
          staySignedIn();
          return;
        }
        signingOutRef.current = true;
        void signOut({ redirect: false }).then(() => {
          // ?timeout=1 lets the login page say why it is being shown, instead
          // of looking like the session mysteriously vanished.
          router.push("/login?timeout=1");
        });
        return;
      }

      if (idleMs >= timeoutMs - warningMs) {
        setSecondsLeft(Math.max(0, Math.ceil((timeoutMs - idleMs) / 1000)));
      } else {
        // Only clear when there is something to clear — an unconditional
        // setState here would re-render this component every second forever.
        setSecondsLeft((prev) => (prev === null ? prev : null));
      }
    }, POLL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled, minutes, markActive, staySignedIn, confirmLeave, router]);

  if (!enabled || secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="admin-modal border w-full max-w-sm p-6 rounded-2xl shadow-2xl text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={22} strokeWidth={1.5} />
        </div>
        <h2
          id="inactivity-title"
          className="font-jakarta text-base font-semibold text-ink dark:text-cream"
        >
          Still there?
        </h2>
        <p className="font-body text-sm text-ink-400 dark:text-ink-300 mt-2">
          You&rsquo;ve been inactive for a while. For your security we&rsquo;ll sign you out in{" "}
          <span className="font-jakarta font-semibold tabular-nums text-ink dark:text-cream">
            {secondsLeft}
          </span>{" "}
          second{secondsLeft === 1 ? "" : "s"}.
        </p>
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={staySignedIn}
            autoFocus
            className="flex-1 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium bg-sepia hover:bg-sepia-dark transition-all duration-200 shadow-md"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => {
              signingOutRef.current = true;
              void signOut({ redirect: false }).then(() => router.push("/login"));
            }}
            className="px-4 py-2.5 rounded-xl admin-input border font-jakarta text-sm font-medium text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
