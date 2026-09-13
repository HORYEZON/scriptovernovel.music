"use client";

// components/admin/AdminLeaveGuard.tsx
//
// Lets any admin screen say "not right now" to an exit the browser can't see.
//
// Two of them, and neither fires `beforeunload`:
//
//   • **Sign Out** — AdminSidebar runs `signOut({ redirect: false })` and then
//     `router.push("/login")`. A session clear plus a client-side route
//     change; no page unload anywhere in it.
//   • **Switching modules** — a Next `<Link>`, so also a client-side route
//     change. App Router has no navigation-blocking API to hook.
//
// The two are asked about separately, because what they cost is not the same
// thing. A backup keeps running through a module switch by design (see
// BackupJobProvider) and only dies on sign-out, which invalidates the session
// its requests authenticate with. Unsaved Museum Scene Editor changes die on
// both. A single "is it safe to leave?" would have to answer for the stricter
// of the two and would nag about the backup case for no reason.
//
// So a screen declares a reason per intent, and gets asked only about the ones
// that actually apply to it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

export type LeaveIntent = "signout" | "navigate";

/** Returns why this exit would cost something, or null when it wouldn't. */
type Blocker = (intent: LeaveIntent) => string | null;

interface AdminLeaveGuardValue {
  /** Registers a blocker; call the returned function to remove it. */
  registerBlocker: (blocker: Blocker) => () => void;
  /** True to go ahead. Asks the admin only when a blocker objects. */
  confirmLeave: (intent: LeaveIntent) => boolean;
}

const AdminLeaveGuardContext = createContext<AdminLeaveGuardValue | null>(null);

export function useAdminLeaveGuard(): AdminLeaveGuardValue {
  const ctx = useContext(AdminLeaveGuardContext);
  if (!ctx) throw new Error("useAdminLeaveGuard must be used inside AdminLeaveGuard");
  return ctx;
}

interface LeaveBlockerReasons {
  /** Shown when the admin clicks Sign Out. Null to allow it. */
  onSignOut?: string | null;
  /** Shown when the admin clicks through to another module. Null to allow it —
   *  which is the right answer for anything that survives a route change. */
  onNavigate?: string | null;
}

/**
 * Blocks the listed exits for as long as their reason is a string.
 *
 * Reasons rather than booleans so each prompt can name what is actually at
 * stake: "a restore is mid-write" and "this room has unsaved changes" need
 * different sentences, and a bare "are you sure?" would say neither.
 */
export function useLeaveBlocker(reasons: LeaveBlockerReasons) {
  const { registerBlocker } = useAdminLeaveGuard();
  // Held in a ref so the effect registers once per screen and unregisters on
  // unmount, rather than churning the set every time a reason changes — which
  // for the editor is every drag of every object.
  const latest = useRef(reasons);
  latest.current = reasons;

  useEffect(
    () =>
      registerBlocker((intent) =>
        (intent === "signout" ? latest.current.onSignOut : latest.current.onNavigate) ?? null
      ),
    [registerBlocker]
  );
}

export function AdminLeaveGuard({ children }: { children: React.ReactNode }) {
  const blockers = useRef(new Set<Blocker>());

  const registerBlocker = useCallback((blocker: Blocker) => {
    blockers.current.add(blocker);
    return () => {
      blockers.current.delete(blocker);
    };
  }, []);

  const confirmLeave = useCallback((intent: LeaveIntent) => {
    for (const blocker of blockers.current) {
      const reason = blocker(intent);
      // First objection wins. Two prompts back to back would read as a bug,
      // and in practice an admin is never mid-restore *and* mid-edit.
      if (reason) return window.confirm(reason);
    }
    return true;
  }, []);

  const value = useMemo(
    () => ({ registerBlocker, confirmLeave }),
    [registerBlocker, confirmLeave]
  );

  return (
    <AdminLeaveGuardContext.Provider value={value}>{children}</AdminLeaveGuardContext.Provider>
  );
}
