// components/admin/AdminSelect.tsx
"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * Admin dropdown with a drawn chevron instead of the browser's own arrow.
 *
 * A bare `<select>` paints its arrow hard against the right border — no gap to
 * the box, and on Windows/Chrome it sits on top of whatever padding you set —
 * which is why the admin already hand-rolls `appearance-none` + an absolute
 * ChevronDown in a dozen places. This is that pattern, once, with the spacing
 * fixed: `pr-9` on the field and the chevron at `right-3`, so there's room on
 * both sides of the icon (0.6rem to the text, 0.75rem to the border).
 *
 * `icon` renders a leading glyph and shifts the text over to make room for it.
 */
export function AdminSelect({
  icon,
  wrapperClassName = "",
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  icon?: ReactNode;
  /** Classes for the positioning wrapper — width/flex behaviour lives here. */
  wrapperClassName?: string;
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-ink-400">
          {icon}
        </span>
      )}
      <select
        {...props}
        className={`w-full appearance-none cursor-pointer rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors ${
          icon ? "pl-8" : "pl-3"
        } pr-9 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
      />
    </div>
  );
}
