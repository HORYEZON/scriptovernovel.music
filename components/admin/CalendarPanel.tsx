'use client';

// components/admin/CalendarPanel.tsx
//
// The month grid every calendar in the admin is drawn from.
//
// This markup started life inside DashboardCalendar.tsx — the panel behind the
// clock in the sidebar — and it was the only calendar in the app that looked
// like this. Everywhere a date actually had to be *entered* (Events, About,
// Announcements, Marquees, Release Notes) the admin got the browser's native
// `<input type="date">` picker instead: a different grid, a different weekday
// row, a different selected-day treatment, and a completely different one per
// browser. Lifting the grid out here is what lets a picker and the dashboard
// panel be the same object rather than two things that resemble each other.
//
// Deliberately presentational: it owns which month is on screen (that is a
// property of looking, not of the value) and nothing else. The selected date
// and the footer come from whoever renders it, because that is exactly where
// the dashboard panel and a form field differ — the dashboard's selection is a
// scratch pad, a field's is the form's value.

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// How far the year menu reaches either side of today. Back far enough for a
// band member's birth year or a back-catalogue release date, forward far
// enough to schedule against. The viewed year is folded in on top of this, so
// a stored date outside the window is still selectable rather than being
// silently missing from its own menu.
const YEARS_BACK = 100;
const YEARS_FORWARD = 20;

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function CalendarPanel({
  selected,
  onSelect,
  footer,
}: {
  /** The highlighted day, or null when nothing is chosen yet. */
  selected: Date | null;
  onSelect: (date: Date) => void;
  /** Rendered under the grid, above the panel's bottom edge. */
  footer?: ReactNode;
}) {
  const today = new Date();
  // Follows `selected` when it moves to another month — picking a date, then
  // reopening, should land on the month that date is in rather than on
  // whatever month was last paged to.
  const [viewDate, setViewDate] = useState(
    () => new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1)
  );
  const selectedKey = selected ? `${selected.getFullYear()}-${selected.getMonth()}` : null;
  useEffect(() => {
    if (!selected) return;
    setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
    // Keyed on the month, not the Date object: paging away from a selected
    // day and back would otherwise be undone on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Build a fixed 6x7 grid so the panel height never jumps between months.
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length < 42) {
    const next = cells.length - (firstWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, month + 1, next), inMonth: false });
  }

  function goToMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  // The month and year are pickable rather than only pageable. The arrows were
  // the only way across the calendar, so any date more than a few months off
  // — a 1998 release, a gig next spring — meant clicking ◀ or ▶ dozens of
  // times. `min`/`max` fold the viewed year in so a stored date outside the
  // window still appears in its own menu.
  const firstYear = Math.min(today.getFullYear() - YEARS_BACK, year);
  const lastYear = Math.max(today.getFullYear() + YEARS_FORWARD, year);
  const years: number[] = [];
  for (let y = lastYear; y >= firstYear; y--) years.push(y);

  const jumpClass =
    'appearance-none cursor-pointer rounded-lg bg-transparent px-1.5 py-1 font-jakarta text-sm font-semibold text-ink dark:text-cream tracking-tight hover:bg-sepia/10 focus:outline-none focus:ring-1 focus:ring-sepia transition-colors';

  return (
    <>
      {/* Month header + nav */}
      <div className="flex items-center justify-between gap-1 mb-3">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-ink-400 dark:text-ink-300 hover:bg-sepia/10 hover:text-sepia transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <div className="flex min-w-0 items-center justify-center gap-0.5">
          <select
            value={month}
            onChange={(e) => setViewDate(new Date(year, Number(e.target.value), 1))}
            aria-label="Month"
            className={jumpClass}
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setViewDate(new Date(Number(e.target.value), month, 1))}
            aria-label="Year"
            className={jumpClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-ink-400 dark:text-ink-300 hover:bg-sepia/10 hover:text-sepia transition-colors"
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className="h-7 flex items-center justify-center font-body text-[10px] font-medium uppercase tracking-wider text-ink-300 dark:text-ink-600"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map(({ date, inMonth }, i) => {
          const isToday = isSameDay(date, today);
          const isSelected = selected ? isSameDay(date, selected) : false;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(date)}
              className={[
                'h-8 w-8 mx-auto flex items-center justify-center rounded-full font-mono text-xs transition-colors',
                !inMonth && 'text-ink-200 dark:text-ink-700',
                inMonth && !isSelected && !isToday && 'text-ink dark:text-cream hover:bg-sepia/10',
                isToday && !isSelected && 'text-sepia font-semibold ring-1 ring-sepia/40',
                isSelected && 'bg-sepia text-white dark:text-ink-900 font-semibold shadow-sm',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {footer && (
        <div className="mt-3 pt-3 border-t border-ink-100 dark:border-ink-700">{footer}</div>
      )}
    </>
  );
}
