// components/admin/RowsPerPageSelect.tsx
"use client";

import { Rows3, ChevronDown } from "lucide-react";

export const ROWS_PER_PAGE_OPTIONS = [5, 10, 20] as const;

// "Rows per page" dropdown shared by the admin list views (Artworks, Orders,
// Products, Sections, Announcements). Kept as its own component since the
// clients otherwise duplicate identical markup + reset-to-page-1 wiring.
// Fills its grid/flex cell on mobile (w-full) so it pairs up with a sibling
// chip in a 2-up row instead of forcing its own line; reverts to its
// natural width at sm+ where the toolbar has room to flow freely.
export function RowsPerPageSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (size: number) => void;
}) {
  return (
    // The native arrow used to sit flush against the box's right border; the
    // select now draws its own chevron with padding on both sides of it.
    <div className="relative flex items-center gap-1.5 rounded-xl admin-input border pl-2 pr-7 py-1.5 w-full sm:w-auto sm:shrink-0">
      <Rows3 size={12} className="text-ink-400 shrink-0" />
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 whitespace-nowrap">
        Rows:
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
        title="Rows per page"
      >
        {ROWS_PER_PAGE_OPTIONS.map((size) => (
          <option key={size} value={size} className="bg-white dark:bg-ink-900">
            {size}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
      />
    </div>
  );
}
