"use client";

// components/admin/AdminDatePicker.tsx
//
// The admin's date field — the dashboard's calendar (CalendarPanel) behind a
// trigger that looks like every other `admin-input`, replacing the eight
// `<input type="date">` / `<input type="datetime-local">` fields that were
// scattered across Events, About, Announcements, Marquees and Release Notes.
//
// Those natives were the inconsistency: each browser draws its own grid, its
// own weekday row, its own selected-day treatment and its own tiny caret, none
// of which match the sidebar calendar or anything else in the admin — and on
// Chrome/Windows the caret sits on top of the field's padding, the same
// crowding AdminSelect exists to fix.
//
// The value format is deliberately unchanged from the natives it replaces:
// `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when `withTime`. Every caller already
// stores, parses and submits those strings, so this is a swap of the control
// and nothing else — no form, serialiser or API route had to move.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import { CalendarPanel } from "./CalendarPanel";

const PANEL_W = 288; // w-72, matched to the dashboard panel
const PANEL_MARGIN = 8;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Date -> the `YYYY-MM-DD` half of the value, in local time.
 *  `toISOString()` would be UTC, which lands on the wrong day for anyone east
 *  or west of Greenwich — Manila is UTC+8, so every date before 08:00 would
 *  save as the day before. */
function toDatePart(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The stored string -> a Date, or null when it's blank or unparseable.
 *  Parsed by hand rather than `new Date(str)` for the same timezone reason:
 *  the browser reads a bare `YYYY-MM-DD` as UTC midnight. */
function parseValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(value.trim());
  if (!m) return null;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    m[4] ? Number(m[4]) : 0,
    m[5] ? Number(m[5]) : 0
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTrigger(d: Date, withTime: boolean) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function AdminDatePicker({
  id,
  value,
  onChange,
  withTime = false,
  required = false,
  clearable = true,
  placeholder,
  className = "",
  ariaLabel,
}: {
  id?: string;
  /** `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when `withTime`. Empty string = unset. */
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  required?: boolean;
  /** Whether the field can be emptied again. Off for the two required bounds
   *  on an announcement, where a blank is not a legal value. */
  clearable?: boolean;
  placeholder?: string;
  /** Extra classes for the trigger button. */
  className?: string;
  ariaLabel?: string;
}) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = parseValue(value);
  // Time is kept on the value, not in state — so a caller resetting the form
  // resets the clock too, rather than leaving a stale 14:30 behind.
  const timePart = withTime && selected ? `${pad(selected.getHours())}:${pad(selected.getMinutes())}` : "";

  // Portalled to <body> and positioned from the trigger's rect. Every one of
  // these fields sits inside a modal whose body is `overflow-y-auto`, and an
  // absolutely-positioned panel in that box is clipped by it — the calendar
  // would simply be cut off at the modal's edge, or force the modal to scroll.
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight ?? 340;
    // Flip above the field when there isn't room below it — these fields are
    // often near the bottom of a modal.
    const below = r.bottom + PANEL_MARGIN;
    const top =
      below + panelH > window.innerHeight - PANEL_MARGIN && r.top - panelH - PANEL_MARGIN > 0
        ? r.top - panelH - PANEL_MARGIN
        : below;
    const left = Math.min(
      Math.max(PANEL_MARGIN, r.left),
      window.innerWidth - PANEL_W - PANEL_MARGIN
    );
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // Reposition rather than close: the field can be scrolled inside a modal
    // while the panel is open, and a panel left behind at a stale offset is
    // worse than either.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    // Capture, so Escape closes the calendar without also closing the modal
    // the field is sitting in.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function commitDate(date: Date) {
    if (!withTime) {
      onChange(toDatePart(date));
      setOpen(false);
      return;
    }
    // Picking a day on a datetime field keeps the time already set, and
    // defaults to the current clock when there was none — a fresh field that
    // silently meant midnight was how announcements kept being scheduled to
    // start at 00:00 of the right day.
    const now = new Date();
    const hh = selected ? selected.getHours() : now.getHours();
    const mm = selected ? selected.getMinutes() : now.getMinutes();
    onChange(`${toDatePart(date)}T${pad(hh)}:${pad(mm)}`);
  }

  function commitTime(next: string) {
    const base = selected ?? new Date();
    const [hh, mm] = next.split(":");
    if (hh === undefined || mm === undefined) return;
    onChange(`${toDatePart(base)}T${hh}:${mm}`);
  }

  return (
    <>
      <div className="relative">
        <button
          id={fieldId}
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={`w-full flex items-center gap-2 rounded-xl admin-input border text-left transition-colors focus:outline-none ${
            open ? "border-sepia" : "focus:border-sepia"
          } ${clearable && selected ? "pr-9" : "pr-3"} ${className}`}
        >
          <CalendarDays size={14} className="shrink-0 text-ink-400" />
          <span
            className={`min-w-0 flex-1 truncate ${
              selected ? "text-ink dark:text-cream" : "text-ink-400 dark:text-ink-300"
            }`}
          >
            {selected
              ? formatTrigger(selected, withTime)
              : (placeholder ?? (withTime ? "Pick a date & time" : "Pick a date"))}
          </span>
        </button>
        {clearable && selected && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            aria-label="Clear date"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-sepia/10 transition-colors"
          >
            <X size={13} />
          </button>
        )}
        {/* The value the browser validates and a submit reads, mirrored out of
            the button above. `required` on a <button> means nothing, so a
            required field needs a real form control behind it — hidden, and
            never focusable, so it can't be tabbed into or typed in. */}
        {required && (
          <input
            type="text"
            tabIndex={-1}
            required
            value={value}
            onChange={() => {}}
            aria-hidden="true"
            className="sr-only pointer-events-none"
          />
        )}
      </div>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose a date"
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: PANEL_W,
              // Until `place()` has measured, the panel is laid out off-screen
              // rather than flashed at the top-left corner.
              visibility: pos ? undefined : "hidden",
            }}
            className="admin-modal z-[100] rounded-2xl border shadow-xl p-4 animate-fade-in"
          >
            <CalendarPanel
              selected={selected}
              onSelect={commitDate}
              footer={
                <div className="flex items-center justify-between gap-2">
                  {withTime ? (
                    <label className="flex items-center gap-2 font-body text-[11px] text-ink-400 dark:text-ink-300">
                      Time
                      <input
                        type="time"
                        value={timePart}
                        onChange={(e) => commitTime(e.target.value)}
                        className="admin-input rounded-lg border px-2 py-1 font-mono text-xs text-ink dark:text-cream focus:outline-none focus:border-sepia"
                      />
                    </label>
                  ) : (
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                      {selected
                        ? selected.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })
                        : "No date chosen"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => commitDate(new Date())}
                    className="shrink-0 font-body text-[11px] font-semibold text-sepia hover:text-sepia-dark transition-colors"
                  >
                    Today
                  </button>
                </div>
              }
            />
          </div>,
          document.body
        )}
    </>
  );
}
