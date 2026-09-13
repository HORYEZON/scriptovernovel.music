"use client";

// app/(public)/stories/StoriesClient.tsx
//
// The public Stories shelf. The card is the Gallery's section card
// (app/(public)/gallery/GalleryClient.tsx's SectionCard) reproduced beat for
// beat — same 4:5 crop, same rounded-xl, same 700ms cover zoom, same inset
// ring, same light sweep on `animate-shimmer` — recoloured from sepia to the
// `azure` scale added alongside it in tailwind.config.ts. Anything that
// wasn't the colour is deliberately unchanged so the two grids read as one
// site rather than two.
import { useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { motion } from "framer-motion";
import {
  sanitizeCarouselMode,
  clampCarouselSpeed,
  carouselLoopDuration,
} from "@/lib/gallery-carousel";
import { BookOpen, Search, X, Images } from "lucide-react";
import { STORY_TYPES, STORY_TYPE_LABELS, storyTypeLabel } from "@/lib/stories";
import { StoryReader } from "@/components/public/StoryReader";
import { HoverShimmer } from "@/components/public/HoverShimmer";
import { DEFAULT_HOVER_SHIMMER, type ShimmerSettings } from "@/lib/hover-shimmer";
import { imageVariantUrl } from "@/lib/images/variants";

export interface PublicStoryPage {
  id: string;
  imageUrl: string;
  pageNumber: number;
  caption: string | null;
}

export interface PublicStory {
  id: string;
  title: string;
  description: string;
  type: string;
  coverImageUrl: string;
  author: string | null;
  genre: string[];
  year: number | null;
  featured: boolean;
  slug: string | null;
  // "Continue Reading" hand-off — see the continue* fields on Story. Shaped
  // to satisfy StoryReader's ReadableStory without a conversion step.
  continueEnabled: boolean;
  continueUrl: string | null;
  continueLabel: string | null;
  pages: PublicStoryPage[];
}

function StoryCard({
  story,
  index,
  onOpen,
  shimmer,
}: {
  story: PublicStory;
  index: number;
  onOpen: (story: PublicStory) => void;
  shimmer: ShimmerSettings;
}) {
  return (
    <motion.div
      className="artwork-card group cursor-pointer relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: (index % 12) * 0.05 }}
      onClick={() => onOpen(story)}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl transition-shadow duration-500 group-hover:shadow-[0_12px_40px_-10px_rgba(110,154,200,0.6)]">
        {story.coverImageUrl ? (
          <Image
            src={imageVariantUrl(story.coverImageUrl, "thumb")}
            alt={story.title || "Story cover"}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-ink-800/50 flex items-center justify-center">
            <BookOpen size={48} className="text-white/20" strokeWidth={1} />
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Type badge */}
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-azure-dark/80 backdrop-blur-sm font-body text-[10px] uppercase tracking-widest text-white">
            {storyTypeLabel(story.type)}
          </span>
        </div>

        {/* Story info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 pointer-events-none">
          <h3 className="font-grotesk text-sm sm:text-base lg:text-lg font-semibold tracking-wider uppercase text-white leading-tight line-clamp-2 break-words">
            {story.title}
          </h3>
          <p className="font-body text-xs text-white/50 tracking-widest uppercase mt-1.5 flex items-center gap-2 flex-wrap">
            {story.author && <span className="truncate max-w-[60%]">{story.author}</span>}
            <span className="inline-flex items-center gap-1">
              <Images size={11} />
              {story.pages.length} page{story.pages.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>

        {/* Premium hover frame — blue ring + light sweep, the Gallery card's
            gilded treatment in the Stories palette. The sweep's colour/speed/
            brightness are the admin's (Hover Shimmer → Tales); its default is
            the same azure-light/25 it always had. */}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-azure-light/0 group-hover:ring-azure-light/80 transition-all duration-500 pointer-events-none" />
        <HoverShimmer settings={shimmer} />
      </div>
    </motion.div>
  );
}

export function StoriesClient({
  stories = [],
  carouselMode,
  carouselSpeed,
  shimmer = DEFAULT_HOVER_SHIMMER.stories,
}: {
  stories?: PublicStory[];
  /** Admin-configured mobile behaviour (Settings → Preferences → Mobile
   *  Stories Carousel). Re-validated here for the same defence-in-depth
   *  reason GalleryClient does it: a row edited directly in the DB shouldn't
   *  be able to break the shelf. */
  carouselMode?: string;
  carouselSpeed?: number;
  /** Admin-configured hover light-sweep for the covers (Settings →
   *  Preferences → Branding → Hover Shimmer, "Tales" tab). Already sanitized
   *  by the page. */
  shimmer?: ShimmerSettings;
}) {
  // Memoized so the filter/type memos below don't see a new array identity on
  // every render (the prop arrives already-parsed from the server component).
  const safeStories = useMemo(
    () => (Array.isArray(stories) ? stories : []),
    [stories]
  );
  const mode = sanitizeCarouselMode(carouselMode);
  const speed = clampCarouselSpeed(carouselSpeed);
  const [openStory, setOpenStory] = useState<PublicStory | null>(null);
  // Pauses the auto-scroll conveyor while a finger (or cursor) is on it.
  const [isPaused, setIsPaused] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Only offer a type chip for kinds actually on the shelf — an empty
  // "Manga" filter is just a dead end for a visitor.
  const availableTypes = useMemo(() => {
    const present = new Set(safeStories.map((s) => s.type));
    return STORY_TYPES.filter((type) => present.has(type));
  }, [safeStories]);

  const filtered = useMemo(() => {
    return safeStories.filter((story) => {
      if (typeFilter !== "ALL" && story.type !== typeFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        story.title.toLowerCase().includes(term) ||
        story.description?.toLowerCase().includes(term) ||
        story.author?.toLowerCase().includes(term) ||
        story.genre?.some((g) => g.toLowerCase().includes(term)) ||
        storyTypeLabel(story.type).toLowerCase().includes(term)
      );
    });
  }, [safeStories, searchTerm, typeFilter]);

  const totalPages = safeStories.reduce((sum, s) => sum + s.pages.length, 0);

  return (
    <>
      {/* Count + filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <p className="font-body text-xs text-white/50 tracking-widest uppercase">
          {safeStories.length} {safeStories.length === 1 ? "story" : "stories"} ·{" "}
          {totalPages} page{totalPages !== 1 ? "s" : ""}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stories…"
              aria-label="Search stories"
              className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-lg border border-white/15 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-azure transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Type filter chips */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-8">
          {(["ALL", ...availableTypes] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${typeFilter === type
                ? "bg-azure text-white border-azure font-medium"
                : "border-white/15 text-white/60 hover:border-white/40 hover:text-white"
                }`}
            >
              {type === "ALL" ? "All" : STORY_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {safeStories.length === 0 ? (
        <div className="text-center py-24">
          <BookOpen size={48} strokeWidth={1} className="mx-auto mb-4 text-white/20" />
          <p className="font-display text-3xl font-light italic text-white/40">
            No stories yet
          </p>
          <p className="font-body text-sm text-white/30 mt-2">
            Check back soon for new books, comics and manga.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <Search size={40} strokeWidth={1} className="mx-auto mb-4 text-white/20" />
          <p className="font-display text-2xl font-light italic text-white/40">
            No matching stories
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setTypeFilter("ALL");
            }}
            className="mt-4 font-body text-xs tracking-widest uppercase text-azure-light hover:text-white transition-colors"
          >
            Reset filters
          </button>
        </div>
      ) : (
        /* Flex + justify-center (not CSS grid) on purpose, same as the
           Gallery: when the last row is short a card or two, grid tracks stay
           left-anchored while a flex-wrap row with explicit per-item widths
           centers its leftover items instead. */
        <>
          {/* Desktop (and "grid" mode everywhere): the same centered
              flex-wrap the Gallery uses. */}
          <div
            className={
              mode === "grid"
                ? "flex flex-wrap justify-center gap-5"
                : "hidden md:flex flex-wrap justify-center gap-5"
            }
          >
            {filtered.map((story, i) => (
              <div
                key={story.id}
                className="w-full sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)] xl:w-[calc(25%-0.9375rem)] shrink-0"
              >
                <StoryCard story={story} index={i} onOpen={setOpenStory} shimmer={shimmer} />
              </div>
            ))}
          </div>

          {mode === "swipe" && (
            /* Real touch-scrolling with scroll-snap, no auto-motion. */
            <div className="md:hidden -mx-4 px-4 py-2 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar">
              {filtered.map((story, i) => (
                <div key={story.id} className="w-[70vw] max-w-[260px] flex-none snap-start">
                  <StoryCard story={story} index={i} onOpen={setOpenStory} shimmer={shimmer} />
                </div>
              ))}
            </div>
          )}

          {mode === "auto" && (
            /* Infinite conveyor — the list is duplicated so the -50% loop
               lands exactly on the seam. Same technique as the Gallery's. */
            <div className="md:hidden overflow-hidden py-2 w-full relative">
              <motion.div
                className="flex gap-4 w-max"
                animate={{ x: isPaused ? undefined : ["0%", "-50%"] }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: carouselLoopDuration(filtered.length, speed),
                    ease: "linear",
                  },
                }}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {[...filtered, ...filtered].map((story, i) => (
                  <div key={`${story.id}-${i}`} className="w-[70vw] max-w-[260px] flex-none">
                    <StoryCard story={story} index={i} onOpen={setOpenStory} shimmer={shimmer} />
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Same reader the museum's podiums open — see
          components/public/StoryReader.tsx. */}
      <StoryReader story={openStory} onClose={() => setOpenStory(null)} />
    </>
  );
}
