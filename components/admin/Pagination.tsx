// components/admin/Pagination.tsx
"use client";

// The numbered ← Prev / 1 2 3 / Next → pager the admin list views use.
//
// The markup here is lifted verbatim from the copy that already existed in
// OrdersClient/ArtworksClient/ProductsClient/StoriesClient/SectionsClient/
// AnnouncementClient — same classes, same disabled states, same sepia active
// pill — so a page using this component is visually indistinguishable from
// one still using its own inline copy. That matters: it lets the existing
// clients migrate onto it one at a time (or never) without the two versions
// looking different side by side in the meantime.
//
// One thing it adds over those copies: `windowSize`. The inline versions
// render `Array.from({ length: totalPages })` — every page, always — which is
// fine for a table of 40 artworks and unusable for the activity log, where
// several hundred pages is normal. Past the window it collapses to
// first … around-the-current … last.

import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { RowsPerPageSelect } from "./RowsPerPageSelect";

/** Page numbers to render, with `null` standing in for an ellipsis gap.
 *  Always includes page 1, the last page, and `windowSize` pages centred on
 *  the current one. */
function pageItems(current: number, total: number, windowSize: number): (number | null)[] {
  if (total <= windowSize + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(windowSize / 2);
  // Clamp the window so it stays `windowSize` wide even at either end —
  // without this, page 1 shows a half-empty window drifting off the left.
  let start = Math.max(2, current - half);
  const end = Math.min(total - 1, start + windowSize - 1);
  start = Math.max(2, end - windowSize + 1);

  const items: (number | null)[] = [1];
  if (start > 2) items.push(null);
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push(null);
  items.push(total);
  return items;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  /** Rendered to the left of the pager — the "1–20 of 431" summary. Optional
   *  because the in-memory list views don't need it: their reader can see the
   *  whole set. A server-paginated list can't, so it does. */
  summary,
  windowSize = 5,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  summary?: React.ReactNode;
  windowSize?: number;
}) {
  if (totalPages <= 1) {
    // Still render the summary when there's only one page — "3 of 3" is
    // useful; a lone pager pointing at page 1 of 1 is not.
    return summary ? (
      <div className="flex items-center justify-center mt-8">
        <span className="font-body text-xs text-ink-400 dark:text-ink-300">{summary}</span>
      </div>
    ) : null;
  }

  const buttonClass =
    "px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-8">
      {summary && (
        <span className="font-body text-xs text-ink-400 dark:text-ink-300 order-2 sm:order-1">
          {summary}
        </span>
      )}
      <div className="flex items-center justify-center gap-2 flex-wrap order-1 sm:order-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className={buttonClass}
        >
          ← Prev
        </button>
        {pageItems(page, totalPages, windowSize).map((item, i) =>
          item === null ? (
            <span
              key={`gap-${i}`}
              className="w-8 h-8 flex items-center justify-center text-xs text-ink-400 dark:text-ink-300 select-none"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${
                item === page
                  ? "bg-sepia text-white shadow-sm"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className={buttonClass}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/**
 * The Sort ▾ + asc/desc toggle pair from the admin list toolbars, as one
 * component. Same markup as the inline copy in OrdersClient's toolbar —
 * including the hand-drawn chevron (the browser's native one sits flush
 * against the border; see AdminSelect.tsx for the same workaround).
 *
 * Generic over the option value so a caller keeps its own union type
 * ("date" | "total" | …) rather than widening to string.
 */
export function SortControl<T extends string>({
  value,
  options,
  order,
  onChange,
  onOrderChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  order: "asc" | "desc";
  onChange: (value: T) => void;
  onOrderChange: (order: "asc" | "desc") => void;
}) {
  return (
    <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
      <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 flex-1 min-w-0 sm:flex-none">
        <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          title="Sort by"
          className="flex-1 min-w-0 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-white dark:bg-ink-900">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </div>

      <button
        type="button"
        onClick={() => onOrderChange(order === "asc" ? "desc" : "asc")}
        className="p-2 rounded-xl admin-input border text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
        title={order === "asc" ? "Ascending" : "Descending"}
      >
        {order === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      </button>
    </div>
  );
}

// Re-exported so a toolbar can pull its three controls from one import
// instead of two — Sort, order toggle and Rows-per-page always appear
// together in these views.
export { RowsPerPageSelect };
