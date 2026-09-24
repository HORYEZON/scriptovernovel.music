"use client";

// components/public/site-design/SearchOverlay.tsx
//
// The header's search — a panel that drops from under the header with one
// input, matching releases, videos and merch by title, subtitle or keyword as
// you type. The whole (small) catalogue comes from one fetch of
// /api/site-search per first open and is filtered here.
//
// It wears the same frosted glass as SiteHeader: the admin's Header colour at
// low alpha over a heavy backdrop-blur, handed to the classes through CSS vars
// rather than an inline background — an inline style beats any `dark:` class,
// which is exactly why this panel used to stay light-mode tan in dark mode
// while the bar above it turned. `--search-glass` is the light-mode tint and
// the `dark:` half of each class is the dark one, so the two follow the theme
// together.
//
// Two things a search panel must get right, both of which this got wrong
// before: only one X (the browser draws its own clear button inside a
// type="search" input, so the panel appeared to have two close buttons — the
// ::-webkit-search-cancel-button rule below removes it), and only one
// scrollbar (the results list scrolls, and useLockBodyScroll stops the page
// behind it scrolling too — see claude-instructions/modal-scroll-lock.md).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Search, X, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImg } from "@/components/ui/SafeImage";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { withAlpha } from "@/lib/museum/minimapHud";
import { SITE_SEARCH_KIND_LABELS, type SiteSearchItem } from "@/lib/site-search";

const MAX_RESULTS = 8;

export function SearchOverlay({
  open,
  onClose,
  bgColor,
  textColor,
}: {
  open: boolean;
  onClose: () => void;
  bgColor: string;
  textColor: string;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SiteSearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Which row the arrow keys are on. -1 = none, so a plain Enter with nothing
  // highlighted does nothing rather than opening whatever happens to be first.
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (items === null && !loading) {
      setLoading(true);
      fetch("/api/site-search")
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data: { items?: SiteSearchItem[] }) => setItems(Array.isArray(data?.items) ? data.items : []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per first open
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !items) return [];
    return items
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.subtitle ?? "").toLowerCase().includes(q) ||
          a.keywords.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, MAX_RESULTS);
  }, [query, items]);

  // A new query is a new list — keeping the old index would highlight a row
  // the visitor never chose.
  useEffect(() => {
    setCursor(-1);
  }, [query]);

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    if (cursor < 0) return;
    listRef.current?.children[cursor]?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c <= 0 ? results.length - 1 : c - 1));
    } else if (e.key === "Enter" && cursor >= 0) {
      e.preventDefault();
      const target = results[cursor];
      onClose();
      router.push(target.href);
    }
  }

  // The admin's Header colour reaches the light-mode classes as a var, the
  // same trick SiteHeader.tsx uses and for the same reason.
  const chrome = {
    "--search-glass": withAlpha(bgColor, 0.72),
    "--search-text": textColor,
  } as CSSProperties;

  return (
    <>
      {/* Click-away scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[80] bg-black/30 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-label="Search"
        aria-hidden={!open}
        className={cn(
          "fixed inset-x-0 top-0 z-[90] transition-transform duration-300 ease-out",
          "text-[color:var(--search-text)] dark:text-cream",
          // The header's frosted recipe, one step denser because this panel
          // has to stay readable over whatever page it drops onto.
          "bg-[color:var(--search-glass)] dark:bg-ink/70 backdrop-blur-xl backdrop-saturate-150",
          "border-b border-white/20 dark:border-ink-800/50 shadow-lg shadow-black/5",
          open ? "translate-y-0" : "pointer-events-none -translate-y-full"
        )}
        style={chrome}
      >
        <div className="section-padding flex items-center gap-4 py-5">
          <Search size={18} strokeWidth={1.75} className="shrink-0 opacity-70" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search releases, videos, merch…"
            aria-label="Search the site"
            autoComplete="off"
            // WebKit draws its own ✕ inside a search input; ours is the one
            // that closes the panel, and two of them side by side read as a
            // bug. Strip the native affordance rather than lose ours.
            className={cn(
              "min-w-0 flex-1 bg-transparent font-body text-base outline-none placeholder:opacity-50 md:text-lg",
              "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            )}
          />
          {/* A hint, not a control — the panel's one button is the X. */}
          <kbd className="hidden shrink-0 rounded border border-current/20 px-1.5 py-0.5 font-body text-[10px] uppercase tracking-widest opacity-50 sm:block">
            Esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-full p-2 transition-colors hover:bg-current/10"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {query.trim() && (
          <div
            className={cn(
              "section-padding border-t border-current/10 pb-5 pt-3",
              // Its own scroll, and overscroll-contain so reaching the end of
              // the list doesn't hand the wheel to the page behind.
              "max-h-[min(60vh,30rem)] overflow-y-auto overscroll-contain"
            )}
          >
            {loading && items === null ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">Loading…</p>
            ) : results.length === 0 ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">
                No matches for &ldquo;{query.trim()}&rdquo;
              </p>
            ) : (
              <ul ref={listRef} className="-mx-2">
                {results.map((a, i) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={onClose}
                      onMouseEnter={() => setCursor(i)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-2 py-3 transition-colors",
                        cursor === i ? "bg-current/10" : "hover:bg-current/5"
                      )}
                    >
                      {a.imageUrl ? (
                        <SafeImg src={a.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded bg-current/10" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm font-medium">{a.title}</span>
                        {a.subtitle && (
                          <span className="block truncate font-body text-xs opacity-60">{a.subtitle}</span>
                        )}
                      </span>
                      {cursor === i && (
                        <CornerDownLeft size={14} strokeWidth={1.75} className="hidden shrink-0 opacity-50 sm:block" />
                      )}
                      <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.2em] opacity-50">
                        {SITE_SEARCH_KIND_LABELS[a.kind]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
