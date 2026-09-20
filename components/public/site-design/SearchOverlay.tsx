"use client";

// components/public/site-design/SearchOverlay.tsx
//
// The header's search — a slim panel that drops from under the header with
// one input, matching releases, videos and merch by title, subtitle or
// keyword as you type. The whole (small) catalogue comes from one fetch of
// /api/site-search per first open and is filtered here.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImg } from "@/components/ui/SafeImage";
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <>
      {/* Click-away scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[80] bg-black/20 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-label="Search"
        aria-hidden={!open}
        className={cn(
          "fixed inset-x-0 top-0 z-[90] transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "pointer-events-none -translate-y-full"
        )}
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        <div className="section-padding flex items-center gap-4 py-5">
          <Search size={18} strokeWidth={1.75} className="shrink-0 opacity-70" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search releases, videos, merch…"
            aria-label="Search the site"
            className="min-w-0 flex-1 bg-transparent font-body text-base outline-none placeholder:opacity-50 md:text-lg"
            style={{ color: textColor }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded-full p-2 transition-opacity hover:opacity-60"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {query.trim() && (
          <div className="section-padding max-h-[60vh] overflow-y-auto border-t border-current/10 pb-5 pt-3">
            {loading && items === null ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">Loading…</p>
            ) : results.length === 0 ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">No matches</p>
            ) : (
              <ul className="divide-y divide-current/10">
                {results.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.href}
                      onClick={onClose}
                      className="flex items-center gap-4 py-3 transition-opacity hover:opacity-60"
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
