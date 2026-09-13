// components/admin/AdminGoToMenu.tsx
"use client";

// A small "Go to ▾" dropdown for an admin page header's `action` slot —
// links out to the public-facing views of whatever that page manages
// (each opens in a new tab so the admin doesn't lose their place). Same
// sepia primary-button treatment as the standalone "Go to Museum" button
// on /admin/museum, just with a menu when there's more than one destination.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ArrowUpRight, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminGoToLink {
  label: string;
  href: string;
  /** When true the destination is rendered greyed-out and non-clickable with
   *  a short note underneath — used for a museum room the admin has switched
   *  off (see lib/museum/roomStatus.ts). */
  inactive?: boolean;
  /** Note shown under an `inactive` destination. */
  inactiveReason?: string;
}

/** A named set of destinations, rendered as one tab inside the dropdown.
 *  Used by the Museum Scene Editor, whose menu lists every room twice — once
 *  as "open this room's editor" and once as "walk into this room in the
 *  museum". Flat, those forty entries read as one undifferentiated list where
 *  half the labels repeat; the tab is what makes the two halves legible. */
export interface AdminGoToGroup {
  id: string;
  label: string;
  links: AdminGoToLink[];
}

const DEFAULT_INACTIVE_REASON = "This room is currently inactive";

const BTN_CLASS =
  "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md";

export function AdminGoToMenu({
  links,
  groups,
  label = "Go to",
  icon,
}: {
  /** The flat, single-list form. Ignored when `groups` is given. */
  links?: AdminGoToLink[];
  /** The tabbed form — two or more named sets of destinations. Takes
   *  precedence over `links`. */
  groups?: AdminGoToGroup[];
  label?: string;
  /** Leading icon on the button (single-link plain button and the "Go to ▾"
   *  dropdown trigger alike). */
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // A tabbed menu is still one menu — everything below the tab row works off
  // whichever set is showing, so the single-destination shortcut and the
  // empty check don't need to know which form they were given.
  const tabbed = Boolean(groups && groups.length > 0);
  const visibleLinks = tabbed ? (groups![activeGroup]?.links ?? []) : (links ?? []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (visibleLinks.length === 0 && !tabbed) return null;

  // One destination → a plain button, same as /admin/museum's "Go to Museum".
  // Never collapsed this way when tabbed: a tab the admin can switch to is a
  // second destination even when the one showing has a single entry.
  if (!tabbed && visibleLinks.length === 1) {
    const only = visibleLinks[0];
    if (only.inactive) {
      return (
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(BTN_CLASS, "cursor-not-allowed opacity-50 shadow-none")}
            aria-disabled="true"
          >
            {icon}
            {only.label}
          </span>
          <span className="font-body text-xs text-ink-400 dark:text-cream/50">
            {only.inactiveReason ?? DEFAULT_INACTIVE_REASON}
          </span>
        </div>
      );
    }
    return (
      <Link href={only.href} target="_blank" rel="noopener noreferrer" className={BTN_CLASS}>
        {icon}
        {only.label}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={BTN_CLASS}
      >
        {icon}
        {label}
        <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          // Scrolls past a handful of destinations: the Museum Scene Editor's
          // menu lists every room in the museum, which on a full museum is
          // longer than the viewport and would otherwise run off the bottom
          // of the screen with no way to reach the last rooms.
          className="absolute right-0 mt-2 w-72 max-w-[80vw] max-h-[70vh] overflow-y-auto rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-lg z-40"
        >
          {tabbed && (
            // Sticky so the tabs stay reachable while the list under them
            // scrolls — on a full museum that list is longer than the menu.
            <div className="sticky top-0 z-10 flex gap-1 p-1 bg-white dark:bg-ink-900 border-b border-black/10 dark:border-white/10">
              {groups!.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeGroup}
                  onClick={() => setActiveGroup(i)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-lg font-jakarta text-[11px] font-medium transition-colors",
                    i === activeGroup
                      ? "bg-sepia/15 text-sepia"
                      : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
          {visibleLinks.map((l) =>
            l.inactive ? (
              <div
                key={l.href}
                role="menuitem"
                aria-disabled="true"
                className="flex flex-col gap-0.5 px-4 py-2.5 cursor-not-allowed"
              >
                <span className="flex items-center justify-between gap-3 font-body text-sm text-ink-400 dark:text-cream/40">
                  <span>{l.label}</span>
                  <Ban size={14} className="shrink-0" />
                </span>
                <span className="font-body text-xs text-ink-400 dark:text-cream/40">
                  {l.inactiveReason ?? DEFAULT_INACTIVE_REASON}
                </span>
              </div>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-3 px-4 py-2.5 font-body text-sm text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span>{l.label}</span>
                <ArrowUpRight size={14} className="text-ink-400 shrink-0" />
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
