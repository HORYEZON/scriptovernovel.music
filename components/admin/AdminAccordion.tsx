"use client";

// components/admin/AdminAccordion.tsx
//
// One collapsible section with a header button — the fold the Digital Museum's
// Rooms tab has used since its groups were introduced, extracted so General
// Settings can use literally the same component rather than a lookalike.
//
// It is display grouping and nothing else. Folding a section changes what is
// on screen and never what is stored, which is what makes it safe to put a
// long settings tab behind one: an admin can collapse everything they are not
// working on without wondering whether the hidden half is still in effect.
//
// The open/closed state is the caller's, not this component's, so a page can
// remember it (see useAccordionState below, which is the persistence half).

import { ChevronDown } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminAccordion({
  title,
  subtitle,
  icon,
  /** Shown as a small pill after the title — a count of what's inside, or any
   *  short status. Omit for a section where a number would mean nothing. */
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
      >
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-ink-400 dark:text-ink-300 transition-transform",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
        {icon && <span className="shrink-0 text-ink-400 dark:text-ink-300">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              {title}
            </span>
            {badge !== undefined && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300">
                {badge}
              </span>
            )}
          </span>
          {subtitle && (
            <span className="block font-body text-xs text-ink-400 dark:text-ink-300">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {/* Unmounted rather than hidden while folded. These sections hold live
          3D previews and colour pickers; keeping them mounted would have a
          collapsed tab still paying for every one of them. The trade is that a
          section's own transient state resets on fold — acceptable here, since
          everything that matters is either saved or held by the parent. */}
      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}

/**
 * Open/closed state for a set of accordions, remembered across visits.
 *
 * Everything starts **open**, so a tab looks exactly as it did before the
 * accordions existed until an admin folds something themselves. The stored
 * value is restored after mount rather than read in the initializer: it
 * doesn't exist on the server, and reading it during the first render would
 * hydrate a different tree than the one the server sent.
 */
export function useAccordionState<K extends string>(
  storageKey: string,
  keys: readonly K[]
): { open: Record<K, boolean>; toggle: (key: K) => void; setAll: (open: boolean) => void } {
  const allOpen = () => Object.fromEntries(keys.map((k) => [k, true])) as Record<K, boolean>;
  const [open, setOpen] = useState<Record<K, boolean>>(allOpen);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      // Merged over the defaults rather than replacing them, so a stored value
      // written before a new section existed doesn't leave that section
      // undefined — which reads as folded, for a section nobody folded.
      if (raw) setOpen((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // Private mode / disabled storage — the sections just don't remember.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persist(next: Record<K, boolean>) {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Same as above — folding still works for this visit.
    }
  }

  return {
    open,
    toggle: (key: K) => persist({ ...open, [key]: !open[key] }),
    setAll: (value: boolean) =>
      persist(Object.fromEntries(keys.map((k) => [k, value])) as Record<K, boolean>),
  };
}
