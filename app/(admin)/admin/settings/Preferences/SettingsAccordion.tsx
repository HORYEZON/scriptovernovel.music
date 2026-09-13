"use client";

// app/(admin)/admin/settings/Preferences/SettingsAccordion.tsx
//
// One foldable card in Preferences → Branding / Theme Customization. Same idea
// and the same visual language as RoomsTab.tsx's RoomGroup: a header you can
// click to fold, a chevron that rotates, and nothing else about the thing
// changes — this decides only what is on screen.
//
// Both of those tabs had grown into one very long scroll of always-open cards
// (Branding is four, the theme customizer is a dozen colour groups), and an
// admin who came to change one font size scrolled past every other control to
// find it. Folding is display state only: the forms below stay mounted, so a
// half-edited field is still there when a section is folded and reopened, and
// the tab's single Save button still saves everything either way.
//
// Which sections are folded is remembered per tab in localStorage, for the
// reason RoomsTab remembers its own groups: a preference an admin re-expresses
// on every visit isn't a preference, it's a chore.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsAccordion({
  title,
  description,
  right,
  open,
  onToggle,
  children,
  /** Renders the header/body without the card chrome — for a section nested
   *  inside another accordion, where a second bordered box reads as a box in
   *  a box rather than as an outline. */
  nested = false,
}: {
  title: string;
  description?: ReactNode;
  /** Shown at the right end of the header row — a master toggle, a "Restore
   *  defaults" link. Its own clicks are kept from folding the section. */
  right?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  nested?: boolean;
}) {
  return (
    <div
      className={cn(
        nested
          ? "rounded-xl border border-black/10 dark:border-white/10"
          : "admin-card border rounded-2xl backdrop-blur-md shadow-sm"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          nested ? "px-3 sm:px-4" : "px-4 sm:px-6",
          open && "border-b border-black/10 dark:border-white/10"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className={cn(
            "min-w-0 flex-1 flex items-center gap-3 text-left",
            nested ? "py-3" : "py-4"
          )}
        >
          <ChevronDown
            size={16}
            className={cn(
              "shrink-0 text-ink-400 dark:text-ink-300 transition-transform",
              open ? "rotate-0" : "-rotate-90"
            )}
          />
          <span className="min-w-0">
            <span className="block font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
              {title}
            </span>
            {/* Only while folded: the description is what tells an admin
                whether this is the section they want, and once it's open the
                controls themselves say that far better than a sentence. */}
            {description && !open && (
              <span className="block font-body text-xs text-ink-400 dark:text-ink-300 mt-1 line-clamp-2">
                {description}
              </span>
            )}
          </span>
        </button>
        {/* Outside the button, not inside it — a toggle nested in a <button>
            is invalid markup and, worse, folds the section every time it's
            used. */}
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {open && (
        <div className={cn("space-y-6", nested ? "p-3 sm:p-4" : "p-4 sm:p-6")}>
          {description && (
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 -mb-2">
              {description}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Which sections of one tab are open, persisted under `storageKey`.
 *
 * `defaults` doubles as the set of known section ids, so a section renamed or
 * removed in a later build can't be resurrected by a stale stored value — only
 * keys present in `defaults` are read back.
 *
 * Restored in an effect rather than in the useState initializer for the reason
 * RoomsTab documents: localStorage doesn't exist on the server, and reading it
 * during the first render would hydrate a different tree than the server sent.
 */
export function useAccordionSections<K extends string>(
  storageKey: string,
  defaults: Record<K, boolean>
) {
  const [open, setOpen] = useState<Record<K, boolean>>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<Record<K, boolean>>;
      setOpen((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(defaults) as K[]) {
          if (typeof stored[key] === "boolean") next[key] = stored[key];
        }
        return next;
      });
    } catch {
      // Private mode / disabled storage — the sections just don't remember.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount; `defaults` is a literal that changes identity every render.
  }, [storageKey]);

  const toggle = useCallback(
    (key: K) => {
      setOpen((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Same as above — folding still works, it just isn't remembered.
        }
        return next;
      });
    },
    [storageKey]
  );

  /** Everything open / everything folded, for the tab's own header control. */
  const setAll = useCallback(
    (value: boolean) => {
      setOpen((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(prev) as K[]) next[key] = value;
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // As above.
        }
        return next;
      });
    },
    [storageKey]
  );

  return { open, toggle, setAll };
}
