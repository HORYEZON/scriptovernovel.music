// app/(admin)/admin/artworks/ArtworkPicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Search, Plus, X, ArrowUp, ArrowDown, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// Only the fields this panel actually needs — the full Artwork shape lives
// in ArtworksClient.tsx and is passed straight through, so this stays a
// structural subset rather than importing/duplicating the whole interface.
export interface PickableArtwork {
  id: string;
  title: string;
  imageUrl: string;
  published: boolean;
  slug: string | null;
}

export interface PickerEntry {
  id: string; // join-row id (used for reorder, not the artworkId)
  displayOrder: number;
  artwork: PickableArtwork;
}

/**
 * Search-and-toggle artwork picker + ordered "currently selected" list,
 * side by side. Originally DigitalMuseumPanel.tsx's one-off "Add Artworks" /
 * "Museum Order" pair for the V1 single room — extracted here so it's not
 * hand-rolled again wherever else a room-scoped artwork picker is needed.
 * Deliberately stateless about *what* it's managing — the parent (currently
 * only RoomsTab.tsx's "Manage Artworks") owns fetching/mutating, this just
 * renders.
 */
export function ArtworkPicker({
  allArtworks,
  entries,
  pendingId,
  onAdd,
  onRemove,
  onMove,
  orderedLabel = "Selected",
}: {
  allArtworks: PickableArtwork[];
  entries: PickerEntry[];
  pendingId: string | null;
  onAdd: (artworkId: string) => void;
  onRemove: (artworkId: string) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  orderedLabel?: string;
}) {
  const [search, setSearch] = useState("");
  // Floating hover preview — both lists below only show a 40x40 thumbnail,
  // too small to actually judge an artwork by before adding it. Tracks the
  // cursor so the enlarged preview follows it (offset to the side) rather
  // than sitting in one fixed spot, cleared on mouse-leave.
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; x: number; y: number } | null>(
    null
  );

  function showPreview(e: React.MouseEvent, artwork: PickableArtwork) {
    setPreviewImage({ url: artwork.imageUrl, title: artwork.title, x: e.clientX, y: e.clientY });
  }
  function movePreview(e: React.MouseEvent) {
    setPreviewImage((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p));
  }
  function hidePreview() {
    setPreviewImage(null);
  }

  const selectedIds = useMemo(() => new Set(entries.map((e) => e.artwork.id)), [entries]);

  const filteredArtworks = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allArtworks;
    return allArtworks.filter((a) => a.title.toLowerCase().includes(term));
  }, [allArtworks, search]);

  const orderedEntries = useMemo(
    () => [...entries].sort((a, b) => a.displayOrder - b.displayOrder),
    [entries]
  );

  // The ordered list used to render every entry at once with no cap — fine
  // at a handful of artworks, but a room/exhibition with dozens of them
  // (nothing stops that) grew this card far taller than the search list
  // next to it, and since both cards sit in the same grid row they stretch
  // to match, pushing "Add Artworks" out of a reasonable viewport along
  // with it. Paginated the same way Trash/other admin list pages are.
  const [pageSize, setPageSize] = useState<PageSize>(5);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(orderedEntries.length / pageSize));

  // Clamp instead of just letting the page go stale — removing entries (or
  // shrinking the page size) can leave `page` pointing past the new last page.
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pagedEntries = useMemo(
    () => orderedEntries.slice((page - 1) * pageSize, page * pageSize),
    [orderedEntries, page, pageSize]
  );

  const PREVIEW_SIZE = 224;
  const PREVIEW_OFFSET = 20;
  let previewLeft = 0;
  let previewTop = 0;
  if (previewImage) {
    previewLeft = previewImage.x + PREVIEW_OFFSET;
    previewTop = previewImage.y - PREVIEW_SIZE / 2;
    if (typeof window !== "undefined") {
      previewLeft = Math.min(previewLeft, window.innerWidth - PREVIEW_SIZE - 12);
      previewTop = Math.max(12, Math.min(previewTop, window.innerHeight - PREVIEW_SIZE - 44));
    }
  }

  return (
    // items-start: a grid row's cells stretch to match its tallest sibling
    // by default — with the ordered list on the right now paginating up to
    // 10 rows tall, that stretched the "Add Artworks" card on the left to
    // match even though its own list is capped at max-h-96, leaving a dead
    // gap of empty card below it. Sizing each card to its own content
    // instead keeps "Add Artworks" exactly as tall as its search box + list
    // regardless of how many pages the ordered list on the right has.
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* Artwork Picker */}
      <div className="admin-card border rounded-2xl p-4">
        <h4 className="font-jakarta text-sm font-medium text-ink dark:text-cream mb-3">
          Add Pieces
        </h4>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pieces…"
            className="admin-input w-full pl-9 pr-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {filteredArtworks.length === 0 && (
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 py-4 text-center">
              No pieces match your search.
            </p>
          )}
          {filteredArtworks.map((artwork) => {
            const selected = selectedIds.has(artwork.id);
            return (
              <div
                key={artwork.id}
                className="flex items-center gap-3 p-2 rounded-xl border border-black/5 dark:border-white/5"
              >
                <div
                  className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 cursor-zoom-in"
                  onMouseEnter={(e) => showPreview(e, artwork)}
                  onMouseMove={movePreview}
                  onMouseLeave={hidePreview}
                >
                  <Image src={artwork.imageUrl} alt={artwork.title} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-sm text-ink dark:text-cream truncate">{artwork.title}</p>
                  <span
                    className={cn(
                      "inline-block mt-0.5 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider border",
                      artwork.published
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    )}
                  >
                    {artwork.published ? "Published" : "Draft"}
                  </span>
                </div>
                <button
                  onClick={() => (selected ? onRemove(artwork.id) : onAdd(artwork.id))}
                  disabled={pendingId === artwork.id}
                  className={cn(
                    "shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-50",
                    selected
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                      : "bg-sepia/10 text-sepia hover:bg-sepia/20"
                  )}
                  title={selected ? "Remove" : "Add"}
                >
                  {selected ? <X size={16} /> : <Plus size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ordered selection */}
      <div className="admin-card border rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h4 className="font-jakarta text-sm font-medium text-ink dark:text-cream">
            {orderedLabel} ({orderedEntries.length})
          </h4>
          {orderedEntries.length > PAGE_SIZE_OPTIONS[0] && (
            <label className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 shrink-0">
              Show
              <span className="relative inline-flex">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value) as PageSize);
                    setPage(1);
                  }}
                  className="admin-input rounded-lg pl-2 pr-6 py-1 text-xs appearance-none cursor-pointer"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={11}
                  className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
              </span>
            </label>
          )}
        </div>

        {orderedEntries.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-body text-sm text-ink dark:text-cream mb-1">Nothing selected yet.</p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">
              Add pieces from the list on the left.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              {orderedEntries.some((e) => !e.artwork.published) && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="font-body text-[11px] text-amber-700 dark:text-amber-400">
                    Draft artworks are staged here but won&apos;t appear publicly until published.
                  </p>
                </div>
              )}
              {pagedEntries.map((entry, localIndex) => {
                // Absolute position within the *full* ordered list, not
                // just this page — reorder/disabled-state math (and the
                // "#N" badge) needs the real index, pagination is purely a
                // render-time slice on top of it.
                const index = (page - 1) * pageSize + localIndex;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-2 rounded-xl border border-black/5 dark:border-white/5"
                  >
                    <span className="w-5 text-center font-jakarta text-xs text-ink-400 dark:text-ink-300 shrink-0">
                      {index + 1}
                    </span>
                    <div
                      className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 cursor-zoom-in"
                      onMouseEnter={(e) => showPreview(e, entry.artwork)}
                      onMouseMove={movePreview}
                      onMouseLeave={hidePreview}
                    >
                      <Image src={entry.artwork.imageUrl} alt={entry.artwork.title} fill className="object-cover" />
                    </div>
                    <p className="min-w-0 flex-1 font-body text-sm text-ink dark:text-cream truncate">
                      {entry.artwork.title}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onMove(index, "up")}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => onMove(index, "down")}
                        disabled={index === orderedEntries.length - 1}
                        className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      {/* Previously the only way to remove an already-selected
                          piece was to scroll back to the left-hand picker list
                          and toggle its own (now-red) button — this lets it be
                          removed right from the ordered list itself instead. */}
                      <button
                        onClick={() => onRemove(entry.artwork.id)}
                        disabled={pendingId === entry.artwork.id}
                        className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating hover preview — see showPreview/movePreview above. Fixed
          positioning escapes both cards' own scroll containers, so it
          floats cleanly over whichever list (or the other card) the cursor
          happens to be near. */}
      {previewImage && (
        <div
          className="fixed z-[100] pointer-events-none rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
          style={{ left: previewLeft, top: previewTop, width: PREVIEW_SIZE }}
        >
          <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
            <Image
              src={previewImage.url}
              alt={previewImage.title}
              fill
              className="object-contain"
              sizes={`${PREVIEW_SIZE}px`}
            />
          </div>
          <p className="px-3 py-2 font-body text-xs text-ink dark:text-cream truncate border-t border-black/5 dark:border-white/5">
            {previewImage.title}
          </p>
        </div>
      )}
    </div>
  );
}
