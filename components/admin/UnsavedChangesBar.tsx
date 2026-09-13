"use client";

// components/admin/UnsavedChangesBar.tsx
//
// The sticky "Unsaved … changes — Reset / Save" footer the About module's
// Profile & Bio tab had inline, extracted so every admin screen that stages
// edits until a Save (Branding, Theme, Music, Maintenance, a mini game's
// config, …) shows literally the same bar rather than a lookalike — or, as
// was the case, nothing, leaving a long tab's Save button somewhere below
// the fold.
//
// Renders nothing while `dirty` is false, so a caller can mount it
// unconditionally next to its form. `what` is the noun in the message —
// "profile", "branding", "Sliding Puzzle" — and the Save label defaults
// from it too ("Save Profile"). On a phone the noun is dropped from the
// message (it's already obvious which screen you're on) so the two buttons
// keep their full 44px targets on one row.
//
// Fixed to the viewport, offset past the admin sidebar on desktop so it
// spans the content column rather than sitting over the rail. The offset
// tracks the sidebar's own expanded/collapsed widths (AdminSidebar.tsx:
// md:w-56 / md:w-[72px]) via the CSS var it sets on the shell.

import { Save } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnsavedChangesBar({
  dirty,
  what,
  saving = false,
  saveLabel,
  onSave,
  onReset,
}: {
  dirty: boolean;
  /** Noun for the message and default Save label: "profile" → "Unsaved
   *  profile changes" / "Save Profile". */
  what: string;
  saving?: boolean;
  /** Overrides the default "Save <What>". */
  saveLabel?: string;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty) return null;

  const label =
    saveLabel ?? `Save ${what.charAt(0).toUpperCase()}${what.slice(1)}`;

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3",
        "bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-t border-black/10 dark:border-white/10 shadow-2xl",
        // Past the sidebar on desktop (see the comment above); full width on
        // a phone, where the sidebar is a top bar instead.
        "md:left-[var(--admin-sidebar-width,14rem)]",
        // Keep clear of the home-indicator on notched phones.
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
        <span className="font-body text-sm text-ink-500 dark:text-ink-300 truncate">
          <span className="sm:hidden">Unsaved changes</span>
          <span className="hidden sm:inline">Unsaved {what} changes</span>
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onReset}
          disabled={saving}
          className="font-body text-sm text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors px-3 py-2 min-h-[44px] disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50 min-h-[44px] whitespace-nowrap"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              <span className="sm:hidden">Save</span>
              <span className="hidden sm:inline">{label}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
