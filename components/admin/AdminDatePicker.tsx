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

/**
 * What someone typed -> a Date, or null if it isn't one.
 *
 * The field used to be a button, so the only way in was the calendar — fine
 * for "next Tuesday", tedious for a date you already know. Typing is now the
 * fast path, which means accepting the forms a keyboard actually produces
 * rather than one canonical spelling.
 *
 * The ISO regex has to run first: `new Date("2026-09-23")` is parsed as UTC
 * midnight, so east of Greenwich it lands on the 22nd. Every other form
 * (`9/23/2026`, `Sep 23 2026`, `September 23, 2026 7:30 PM`) is parsed by the
 * browser as local time, which is what we want — so the fallback is safe
 * precisely because the ISO case never reaches it.
 */
function parseTyped(text: string): { date: Date; hasTime: boolean } | null {
  const s = text.trim();
  if (!s) return null;
  const iso = parseValue(s);
  if (iso) return { date: iso, hasTime: /[T ]\d{1,2}:\d{2}/.test(s) };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // A bare date parses to local midnight; treat a literal clock in the text as
  // the only evidence of an intended time, so "Sep 23" doesn't silently mean
  // 00:00 on a datetime field.
  return { date: d, hasTime: /\d{1,2}:\d{2}/.test(s) };
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
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // What is being typed, or null when the field is just showing its value.
  // Held separately so a half-finished "Sep 2" isn't parsed on every keystroke
  // and thrown away as unparseable.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

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

  /** Take what was typed, if anything, and either apply it or put the field
   *  back the way it was. Called on blur and on Enter. */
  function commitTyped() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (!text) {
      setInvalid(false);
      // Clearing by emptying the box is the obvious gesture, but not every
      // field may legally be empty — a required bound keeps its old value.
      if (clearable) onChange("");
      return;
    }
    const parsed = parseTyped(text);
    if (!parsed) {
      // Left as it was rather than cleared: a typo should cost a retype, not
      // the date that was already in the field.
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (!withTime) {
      onChange(toDatePart(parsed.date));
      return;
    }
    const base = parsed.hasTime ? parsed.date : (selected ?? new Date());
    onChange(`${toDatePart(parsed.date)}T${pad(base.getHours())}:${pad(base.getMinutes())}`);
  }

  function commitDate(date: Date) {
    setDraft(null);
    setInvalid(false);
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
        {/* A real text box, not the button this used to be. The calendar is
            still one click away on the icon, but a date you already know is
            now faster to type than to navigate to. The wrapper carries the
            field styling so the icon, the input and the clear button read as
            one control. */}
        <div
          ref={triggerRef}
          className={`w-full flex items-center gap-2 rounded-xl admin-input border transition-colors ${
            invalid ? "border-red-500/60" : open ? "border-sepia" : "focus-within:border-sepia"
          } ${clearable && selected ? "pr-9" : "pr-3"} ${className}`}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={open ? "Close calendar" : "Open calendar"}
            className="shrink-0 -my-1 -ml-1 p-1 rounded-md text-ink-400 hover:text-sepia hover:bg-sepia/10 transition-colors"
          >
            <CalendarDays size={14} />
          </button>
          <input
            id={fieldId}
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={ariaLabel}
            value={draft ?? (selected ? formatTrigger(selected, withTime) : "")}
            placeholder={placeholder ?? (withTime ? "Sep 23, 2026, 7:30 PM" : "Sep 23, 2026")}
            onChange={(e) => {
              setDraft(e.target.value);
              if (invalid) setInvalid(false);
            }}
            onBlur={commitTyped}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTyped();
                setOpen(false);
              } else if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={`min-w-0 flex-1 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 placeholder:text-ink-400 dark:placeholder:text-ink-300 ${
              selected || draft !== null ? "text-ink dark:text-cream" : "text-ink-400 dark:text-ink-300"
            }`}
          />
        </div>
        {clearable && selected && (
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setInvalid(false);
              onChange("");
              setOpen(false);
            }}
            aria-label="Clear date"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-sepia/10 transition-colors"
          >
            <X size={13} />
          </button>
        )}
        {invalid && (
          <p role="alert" className="mt-1 font-body text-[11px] text-red-500">
            Not a date we could read — try {withTime ? "Sep 23, 2026, 7:30 PM" : "Sep 23, 2026"} or 2026-09-23.
          </p>
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
