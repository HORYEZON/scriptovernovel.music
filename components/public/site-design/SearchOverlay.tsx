"use client";

// components/public/site-design/SearchOverlay.tsx
//
// The header's search — a slim panel that drops from under the header with
// one input, matching artworks by title, medium or tag as you type. The
// published catalogue is fetched once per open (it's the same list the
// gallery renders) and filtered here; there's no search endpoint to hit.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SafeImg } from "@/components/ui/SafeImage";

type SearchArtwork = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  medium?: string | null;
  tags?: string[];
};

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
  const [artworks, setArtworks] = useState<SearchArtwork[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    if (artworks === null && !loading) {
      setLoading(true);
      fetch("/api/artworks?published=true")
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: SearchArtwork[]) => setArtworks(Array.isArray(rows) ? rows : []))
        .catch(() => setArtworks([]))
        .finally(() => setLoading(false));
    }
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per first open
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !artworks) return [];
    return artworks
      .filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.medium ?? "").toLowerCase().includes(q) ||
          (a.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, MAX_RESULTS);
  }, [query, artworks]);

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
            placeholder="Search artworks…"
            aria-label="Search artworks"
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
            {loading && artworks === null ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">Loading…</p>
            ) : results.length === 0 ? (
              <p className="font-body text-xs uppercase tracking-widest opacity-60">No matches</p>
            ) : (
              <ul className="divide-y divide-current/10">
                {results.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/artwork/${a.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-4 py-3 transition-opacity hover:opacity-60"
                    >
                      <SafeImg
                        src={a.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm font-medium">{a.title}</span>
                        {a.medium && (
                          <span className="block truncate font-body text-xs opacity-60">{a.medium}</span>
                        )}
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
