// components/admin/AdminPageHeader.tsx
//
// Shared page-level hero header for every admin module.
// Wraps the breadcrumb + title + description in a frosted-glass card so text
// stays readable whether the admin has a plain background or a custom
// Admin Background Image (Preferences → Branding). Without this, text-ink /
// text-cream can disappear against a dark or bright photo depending on the
// current Light/Dark mode toggle.
//
// Props
// ─────
// title        — the <h1> copy (required)
// description  — subtitle below the title (optional)
// breadcrumbs  — ordered array of { label, href? } crumbs rendered before the
//                title; last crumb is treated as the current page (no link).
// action       — arbitrary node rendered at the trailing (right) edge — used
//                for "Add …" buttons or other page-level CTAs.
//
// Usage
// ─────
//   <AdminPageHeader
//     breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Preferences" }]}
//     title="Preferences"
//     description="Site branding and the public theme customizer for app/(public)."
//   />

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface AdminPageBreadcrumb {
  label: string;
  /** Omit for the current (last) crumb — rendered as plain text. */
  href?: string;
}

interface AdminPageHeaderProps {
  title: string;
  description?: ReactNode;
  breadcrumbs?: AdminPageBreadcrumb[];
  /** Optional content pinned to the right (e.g. a primary action button). */
  action?: ReactNode;
  className?: string;
}

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  action,
  className = "",
}: AdminPageHeaderProps) {
  return (
    <div
      className={[
        // Frosted-glass card — same visual language as .admin-card cards used
        // throughout the module body, so the header reads as part of the same
        // system rather than an isolated "different" treatment.
        "admin-card border rounded-2xl backdrop-blur-md shadow-sm",
        // `backdrop-blur-md` makes this a stacking context, so any popover
        // anchored inside the header (e.g. the dashboard's LiveClock calendar)
        // is trapped in it. Without an explicit stack position the module body
        // below — whose cards are also blurred stacking contexts and come
        // later in the DOM — paints on top of that popover. `relative z-30`
        // lifts the whole header (and its popovers) above the page body while
        // staying under the fixed topbar/overlays (z-40+).
        "relative z-30",
        "px-5 py-4 mb-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Breadcrumb trail ------------------------------------------------- */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="breadcrumb"
          className="flex items-center flex-wrap gap-1 mb-2 font-body text-xs text-ink-400 dark:text-ink-300"
        >
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  size={11}
                  className="text-ink-300 dark:text-ink-500 shrink-0"
                  aria-hidden="true"
                />
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-ink dark:hover:text-cream transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink dark:text-cream font-medium">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row -------------------------------------------------------- */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-jakarta text-3xl font-semibold tracking-tight text-ink dark:text-cream leading-tight">
            {title}
          </h1>
          {description && (
            // <div>, not <p>: callers pass rich nodes here (the dashboard's
            // LiveClock renders block-level markup), which is invalid inside a
            // <p> and triggers a hydration mismatch.
            <div className="font-jakarta text-sm text-ink-400 dark:text-ink-300 mt-1 leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>
    </div>
  );
}
