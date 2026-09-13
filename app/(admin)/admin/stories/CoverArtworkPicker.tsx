"use client";

// app/(admin)/admin/stories/CoverArtworkPicker.tsx
//
// "Choose from Artworks" — the second way to set a story's book cover, next
// to uploading a fresh JPG/PNG (see the cover field in StoriesClient.tsx).
//
// Deliberately its own component rather than a mode bolted onto
// ../artworks/ArtworkPicker.tsx: that picker manages an *ordered set* of
// join-rows (room ↔ artworks) and is shaped entirely around add/remove/move,
// while a cover is a single pick that closes the dialog. The two share what
// actually matters — the PickableArtwork shape, imported from there so
// there's one definition of "an artwork you can pick" — plus the same search
// box, thumbnail row and published/draft chip.
import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Search, X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { PickableArtwork } from "../artworks/ArtworkPicker";

const PAGE_SIZE = 8;

export function CoverArtworkPicker({
  artworks,
  selectedUrl,
  onSelect,
  onClose,
}: {
  artworks: PickableArtwork[];
  /** Currently chosen cover URL, so an already-picked artwork reads as active. */
  selectedUrl?: string;
  onSelect: (artwork: PickableArtwork) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useLockBodyScroll(true);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return artworks;
    return artworks.filter((a) => a.title.toLowerCase().includes(term));
  }, [artworks, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Clamp rather than letting `page` go stale — narrowing the search can
  // leave it pointing past the new last page.
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const paged = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Choose from Artworks
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              Reuse an uploaded artwork as this story&apos;s cover
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close artwork picker"
            className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search artworks…"
              className="admin-input w-full pl-9 pr-3 py-2 rounded-xl border text-sm text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-5">
          {paged.length === 0 ? (
            <div className="py-12 text-center">
              <ImageOff className="w-10 h-10 text-ink-400 dark:text-ink-300 mx-auto mb-3 opacity-50" />
              <p className="font-body text-sm text-ink dark:text-cream">
                {artworks.length === 0 ? "No artworks uploaded yet" : "No artworks match your search"}
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                {artworks.length === 0
                  ? "Upload an artwork first, or use the upload option instead."
                  : "Try a different title."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {paged.map((artwork) => {
                const active = selectedUrl === artwork.imageUrl;
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => onSelect(artwork)}
                    title={artwork.title}
                    className={cn(
                      "group text-left rounded-xl overflow-hidden border transition-all",
                      active
                        ? "border-sepia ring-2 ring-sepia/40"
                        : "border-black/10 dark:border-white/10 hover:border-sepia/60"
                    )}
                  >
                    <div className="relative aspect-[3/4] bg-black/5 dark:bg-black/50">
                      <Image
                        src={artwork.imageUrl}
                        alt={artwork.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 45vw, 160px"
                      />
                      {!artwork.published && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-amber-500/90 text-white">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="px-2 py-2 font-body text-xs text-ink dark:text-cream truncate">
                      {artwork.title}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
              className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-body text-xs text-ink-400 dark:text-ink-300 tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
              className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
