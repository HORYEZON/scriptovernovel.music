"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Check, Search, X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { cn } from "@/lib/utils";
import type { ArtworkOption } from "./MiniGamesClient";

interface ArtworkPickerProps {
  artworks: ArtworkOption[];
  title: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * Picks from the artwork the admin already manages. There is deliberately no
 * upload here — a game references an Artwork row, so anything it shows is
 * already in the gallery and stays in step with edits made there.
 */
export function ArtworkPicker({
  artworks,
  title,
  selectedId,
  onSelect,
  onClose,
}: ArtworkPickerProps) {
  const [query, setQuery] = useState("");
  useLockBodyScroll(true);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return artworks;
    return artworks.filter((artwork) =>
      artwork.title.toLowerCase().includes(needle)
    );
  }, [artworks, query]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-ink-900 border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-black/10 dark:border-white/10">
          <h2 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1 text-ink-400 hover:text-ink dark:hover:text-cream transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 pb-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search…"
              aria-label="Search"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {filtered.length === 0 ? (
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 text-center py-12">
              {artworks.length === 0
                ? "No artworks yet — add one under Artworks first."
                : "Nothing matches that search."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map((artwork) => {
                const selected = artwork.id === selectedId;
                return (
                  <li key={artwork.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(artwork.id)}
                      className={cn(
                        "group w-full text-left rounded-xl overflow-hidden border transition-all",
                        selected
                          ? "border-sepia ring-2 ring-sepia/40"
                          : "border-black/10 dark:border-white/10 hover:border-sepia/50"
                      )}
                    >
                      <div className="relative aspect-square bg-black/5 dark:bg-white/5">
                        <Image
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 180px"
                        />
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-sepia text-white flex items-center justify-center">
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                        {/* An unpublished artwork can be chosen, but the game
                            won't run until it's published — better to say so
                            here than to leave the admin guessing later. */}
                        {!artwork.published && (
                          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 font-body text-[10px] uppercase tracking-wider text-amber-300">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="px-2 py-2 font-body text-xs text-ink dark:text-cream truncate">
                        {artwork.title}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
