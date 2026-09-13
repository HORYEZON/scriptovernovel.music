"use client";

// components/public/StoryReader.tsx
//
// The one story reader, used by both surfaces that can open a story:
//
//   • /stories               — the public shelf (StoriesClient.tsx)
//   • the Digital Museum     — walking up to a podium and pressing [E]
//                              (StoryInfoPanel.tsx)
//
// Deliberately one component rather than two: the reading experience is the
// same act in both places, and the museum's own history (ArtworkInfoPanel vs
// ArtworkDetailModal) shows what happens when two nearly-identical panels
// drift apart. Promoted here from app/(public)/stories/StoryReaderModal.tsx.
//
// Two reading modes, the visitor's choice, remembered across visits:
//   • "page"   — one page at a time: ← / → keys, swipe, thumbnail strip.
//   • "scroll" — every page stacked in one column, read by scrolling.
//
// ── Landscape rules (do not "simplify" these) ──────────────────────────────
// The museum can force landscape on a phone with a CSS rotate(90deg) — the
// browser still believes it is in portrait. Two consequences this component
// is built around, both learned from real bugs:
//
//  1. `landscape` is a PROP, never Tailwind's `landscape:` variant. That
//     variant is a physical-orientation media query, so it is false through
//     the whole forced-landscape mode — exactly the case it would be needed
//     for — while firing on every desktop. See ArtworkInfoPanel.tsx:32-43.
//  2. Height caps are `min(…vh, 100%)`, never bare `vh`. Under the rotate,
//     a `fixed inset-0` overlay sits inside a transformed ancestor and fills
//     the pre-rotation box (as tall as the phone is *wide*), while `vh` goes
//     on measuring the phone's real height and sizes the panel to roughly
//     twice the room it has. The 100% term resolves against the real
//     containing block and wins exactly when the two disagree.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  BookOpen,
  ArrowRight,
  Rows3,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { imageVariantUrl } from "@/lib/images/variants";
import {
  storyTypeLabel,
  hasContinueLink,
  continueReadingLabel,
} from "@/lib/stories";

export interface ReadableStoryPage {
  id: string;
  imageUrl: string;
  pageNumber: number;
  caption: string | null;
}

/** The fields the reader needs — satisfied by both the public /stories
 *  payload and the museum's trimmed podium payload. */
export interface ReadableStory {
  id: string;
  title: string;
  description: string;
  type: string;
  author: string | null;
  continueEnabled: boolean;
  continueUrl: string | null;
  continueLabel: string | null;
  pages: ReadableStoryPage[];
}

type ReadingMode = "page" | "scroll";

const MODE_STORAGE_KEY = "scriptovernovel:story-reading-mode";

// Ignore the incidental few pixels a tap drags; anything past this reads as
// a deliberate page turn.
const SWIPE_THRESHOLD_PX = 50;

function readStoredMode(): ReadingMode {
  // Wrapped: a private window, cleared site data, or a browser set to block
  // site data can make even *reading* this throw.
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "scroll" ? "scroll" : "page";
  } catch {
    return "page";
  }
}

/** The hand-off at the end of a teaser — see the continue* fields on Story. */
function ContinueReadingButton({
  story,
  className,
}: {
  story: ReadableStory;
  className?: string;
}) {
  if (!hasContinueLink(story)) return null;
  return (
    <a
      href={story.continueUrl ?? undefined}
      target="_blank"
      // noopener is the one that matters (the opened page can otherwise
      // reach back through window.opener); noreferrer is good manners.
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
        "bg-azure text-white font-body text-sm font-medium",
        "hover:bg-azure-dark transition-colors shadow-lg",
        className
      )}
    >
      {continueReadingLabel(story.continueLabel)}
      <ArrowRight size={16} />
    </a>
  );
}

export function StoryReader({
  story,
  onClose,
  landscape = false,
}: {
  story: ReadableStory | null;
  onClose: () => void;
  /** True only on a touch device in landscape (the museum's `touchLandscape`).
   *  See the landscape rules in this file's header — never swap this for
   *  Tailwind's `landscape:` variant. */
  landscape?: boolean;
}) {
  const [mode, setMode] = useState<ReadingMode>("page");
  const [index, setIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(Boolean(story));

  // Restore the remembered mode on mount only — changing it mid-read is the
  // visitor's own doing, and re-reading storage would fight that.
  useEffect(() => setMode(readStoredMode()), []);

  function chooseMode(next: ReadingMode) {
    setMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice just won't survive this session.
    }
  }

  // Reset whenever the reader opens with a (possibly different) story.
  useEffect(() => {
    setIndex(0);
    setShowFullImage(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [story?.id]);

  const pageCount = story?.pages.length ?? 0;
  const onLastPage = pageCount > 0 && index === pageCount - 1;

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(pageCount - 1, i + 1)),
    [pageCount]
  );

  useEffect(() => {
    if (!story) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showFullImage) setShowFullImage(false);
        else onClose();
        return;
      }
      // Arrow keys only drive page mode — in scroll mode they belong to the
      // scroll container, which is what the visitor is actually using.
      if (mode !== "page") return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [story, showFullImage, onClose, goPrev, goNext, mode]);

  const page = story?.pages[index];
  const showsOnlyHandoff = pageCount === 0 && Boolean(story && hasContinueLink(story));

  return (
    <>
      <AnimatePresence>
        {story && (
          <motion.div
            className="fixed inset-0 z-[60] bg-ink/95 flex items-center justify-center p-3 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            role="dialog"
            aria-label={`${story.title} reader`}
          >
            <button
              className="absolute top-4 right-4 md:top-6 md:right-6 text-cream hover:text-azure transition-colors z-10"
              onClick={onClose}
              aria-label="Close reader"
            >
              <X size={24} strokeWidth={1} />
            </button>

            <motion.div
              // A DEFINITE height, not just a max-height. The page viewer
              // below is `flex-1 min-h-0` holding nothing but an absolutely
              // positioned <Image fill>, which contributes no height of its
              // own — so in an auto-height flex column it resolved to zero
              // and the page simply didn't render. (Same family of mistake
              // ArtworkInfoPanel.tsx documents for `h-full` vs `self-stretch`:
              // a flex child needs something definite to divide.) The height
              // is still min(…vh, 100%) rather than a bare vh, for the
              // forced-landscape reason in this file's header.
              className={cn(
                "bg-cream dark:bg-ink-800 w-full rounded-xl overflow-hidden flex flex-col",
                landscape
                  ? "max-w-5xl h-[min(94vh,100%)]"
                  : "max-w-5xl h-[min(92vh,100%)]"
              )}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4 border-b border-black/10 dark:border-white/10">
                <div className="min-w-0">
                  <p className="font-body text-[10px] md:text-xs tracking-[0.3em] uppercase text-azure-dark dark:text-azure-light">
                    {storyTypeLabel(story.type)}
                    {story.author ? ` · ${story.author}` : ""}
                  </p>
                  <h2 className="font-display text-xl md:text-2xl font-light italic truncate text-ink dark:text-cream">
                    {story.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Reading mode — the visitor's choice, remembered. Only
                      meaningful once there's more than one page. */}
                  {pageCount > 1 && (
                    <div
                      className="flex items-center gap-0.5 rounded-lg border border-black/10 dark:border-white/15 p-0.5"
                      role="group"
                      aria-label="Reading mode"
                    >
                      <button
                        type="button"
                        onClick={() => chooseMode("page")}
                        aria-pressed={mode === "page"}
                        title="Turn pages"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-body text-[11px] transition-colors",
                          mode === "page"
                            ? "bg-azure text-white"
                            : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                        )}
                      >
                        <Copy size={12} />
                        <span className="hidden sm:inline">Pages</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseMode("scroll")}
                        aria-pressed={mode === "scroll"}
                        title="Scroll through"
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md font-body text-[11px] transition-colors",
                          mode === "scroll"
                            ? "bg-azure text-white"
                            : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                        )}
                      >
                        <Rows3 size={12} />
                        <span className="hidden sm:inline">Scroll</span>
                      </button>
                    </div>
                  )}

                  {pageCount > 0 && mode === "page" && (
                    <span className="font-mono text-xs text-ink-400 dark:text-ink-300 tabular-nums shrink-0">
                      {index + 1} / {pageCount}
                    </span>
                  )}
                </div>
              </div>

              {/* ── No pages ─────────────────────────────────────────────── */}
              {pageCount === 0 ? (
                <div className="flex-1 min-h-[140px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <BookOpen size={40} strokeWidth={1} className="text-ink-400 dark:text-ink-300" />
                  <p className="font-body text-sm text-ink-500 dark:text-ink-300 max-w-md">
                    {story.description}
                  </p>
                  {showsOnlyHandoff ? (
                    <ContinueReadingButton story={story} />
                  ) : (
                    <p className="font-body text-sm text-ink-400 dark:text-ink-300">
                      This story has no pages yet — check back soon.
                    </p>
                  )}
                </div>
              ) : mode === "scroll" ? (
                /* ── Scroll mode ──────────────────────────────────────────
                   Every page in one column. Images are lazy by default
                   (no `priority`), so a 60-page book doesn't request 60
                   files to open — only what the visitor scrolls to. */
                <div ref={scrollRef} className="flex-1 overflow-y-auto bg-ink-900/40">
                  {/* Narrower than the panel, and each page additionally
                      capped by height: at the panel's full width a portrait
                      page runs well past the viewport, so scrolling moved
                      through a fraction of a page at a time instead of
                      roughly a page at a time. */}
                  <div className="mx-auto w-full max-w-xl py-4 px-3 md:px-6 space-y-6">
                    {story.pages.map((p) => (
                      <figure key={p.id}>
                        <Image
                          src={imageVariantUrl(p.imageUrl, "medium")}
                          alt={`${story.title} — page ${p.pageNumber}`}
                          width={1200}
                          height={1600}
                          className="w-full h-auto max-h-[min(78vh,100%)] object-contain rounded-lg"
                          sizes="(max-width: 640px) 100vw, 576px"
                        />
                        <figcaption className="mt-2 flex items-baseline justify-between gap-3">
                          <span className="font-body text-xs text-cream/50">
                            {p.caption}
                          </span>
                          <span className="font-mono text-[10px] text-cream/40 tabular-nums shrink-0">
                            {p.pageNumber}
                          </span>
                        </figcaption>
                      </figure>
                    ))}

                    {hasContinueLink(story) && (
                      <div className="flex flex-col items-center gap-3 pt-4 pb-8 text-center">
                        <p className="font-body text-xs text-cream/50">
                          That&apos;s all for now.
                        </p>
                        <ContinueReadingButton story={story} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Page mode ────────────────────────────────────────── */
                <>
                  <div
                    // min-h alongside flex-1: the flex basis is what normally
                    // sizes this, but a floor means a mis-sized parent degrades
                    // to a short page rather than an invisible one.
                    //
                    // In px, never vh. Under the forced-landscape rotate this
                    // panel is only as tall as the phone is *wide* (~390px)
                    // while vh still measures the phone's real height (~845px)
                    // — a 45vh floor was therefore taller than the entire
                    // panel, and it shoved the caption, the Continue Reading
                    // button and the thumbnail strip clean off the bottom.
                    // See rule 2 in this file's header.
                    className="relative flex-1 min-h-[140px] bg-ink-900/40 group/page"
                    onTouchStart={(e) => {
                      touchStartX.current = e.changedTouches[0].clientX;
                    }}
                    onTouchEnd={(e) => {
                      if (touchStartX.current === null) return;
                      const delta = e.changedTouches[0].clientX - touchStartX.current;
                      touchStartX.current = null;
                      if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
                      if (delta < 0) goNext();
                      else goPrev();
                    }}
                  >
                    {page && (
                      <div
                        className="absolute inset-0 cursor-pointer"
                        onClick={() => setShowFullImage(true)}
                      >
                        <Image
                          key={page.id}
                          src={page.imageUrl}
                          alt={`${story.title} — page ${page.pageNumber}`}
                          fill
                          className="object-contain"
                          sizes="(max-width: 768px) 100vw, 900px"
                          priority
                        />
                      </div>
                    )}

                    {/* Zoom hint — always visible on touch (no hover there),
                        fades in on hover for pointer devices. */}
                    <div className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 text-white sm:opacity-0 sm:group-hover/page:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <ZoomIn size={16} />
                    </div>

                    {/* Prev / Next — full-height hit areas so they're
                        reachable one-handed on a phone. */}
                    <button
                      type="button"
                      onClick={goPrev}
                      disabled={index === 0}
                      aria-label="Previous page"
                      className="absolute left-0 top-0 bottom-0 px-2 md:px-3 flex items-center text-white/70 hover:text-white disabled:opacity-0 disabled:cursor-default transition-colors"
                    >
                      <span className="p-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                        <ChevronLeft size={20} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={onLastPage}
                      aria-label="Next page"
                      className="absolute right-0 top-0 bottom-0 px-2 md:px-3 flex items-center text-white/70 hover:text-white disabled:opacity-0 disabled:cursor-default transition-colors"
                    >
                      <span className="p-1.5 rounded-full bg-black/50 backdrop-blur-sm">
                        <ChevronRight size={20} />
                      </span>
                    </button>
                  </div>

                  {/* Caption */}
                  {page?.caption && (
                    <p className="shrink-0 px-4 md:px-6 py-2.5 font-body text-xs md:text-sm text-ink-500 dark:text-ink-300 border-t border-black/10 dark:border-white/10">
                      {page.caption}
                    </p>
                  )}

                  {/* The hand-off, on the last page only — where the "next"
                      arrow has just gone dead, so the natural "what now"
                      gesture lands on it. */}
                  {onLastPage && hasContinueLink(story) && (
                    <div className="shrink-0 flex flex-wrap items-center justify-center gap-3 px-4 py-3 border-t border-black/10 dark:border-white/10 bg-azure/5">
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                        That&apos;s all for now.
                      </p>
                      <ContinueReadingButton story={story} className="px-5 py-2" />
                    </div>
                  )}

                  {/* Thumbnail strip */}
                  {pageCount > 1 && (
                    <div className="shrink-0 flex gap-2 p-3 overflow-x-auto no-scrollbar bg-black/10 dark:bg-black/20 border-t border-black/10 dark:border-white/10">
                      {story.pages.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setIndex(i)}
                          aria-label={`Go to page ${p.pageNumber}`}
                          className={cn(
                            "relative w-10 h-12 shrink-0 rounded-md overflow-hidden border-2 transition-colors",
                            i === index
                              ? "border-azure"
                              : "border-transparent opacity-60 hover:opacity-100"
                          )}
                        >
                          <Image
                            src={p.imageUrl}
                            alt={`Page ${p.pageNumber} thumbnail`}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen page — reached by tapping/clicking the page in page mode. */}
      <AnimatePresence>
        {showFullImage && story && page && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowFullImage(false)}
          >
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Close full page"
            >
              <X size={22} />
            </button>
            <div
              className="relative w-full max-w-4xl flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* min(…vh, 100%) for the same reason as the panel above, and a
                  px floor rather than a vh one: a 50vh floor overflowed the
                  rotated box in forced-landscape and pushed the close button
                  above out of reach. */}
              <div className="relative w-full h-[min(80vh,100%)] min-h-[160px]">
                <Image
                  src={page.imageUrl}
                  alt={`${story.title} — page ${page.pageNumber}`}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <p className="font-body text-xs text-cream/70 text-center tabular-nums">
                Page {page.pageNumber} of {pageCount}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
