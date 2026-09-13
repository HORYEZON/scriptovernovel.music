"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ui/SafeImage";
import Masonry from "react-masonry-css";
import {
  X,
  FolderOpen,
  ZoomIn,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  StickyNote,
  ChevronDown,
  ExternalLink,
  Landmark,
  Gamepad2,
  Compass,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArtworkDetailModal,
  type PublicArtwork,
} from "@/components/public/ArtworkDetailModal";
import { FeaturedBadge, NewReleaseBadge } from "@/components/public/ArtworkBadge";
import { VideoIndicator } from "@/components/public/VideoIndicator";
import { MiniGamesLauncher } from "@/components/public/minigames/MiniGamesLauncher";
import { GoToMuseumButton } from "@/components/public/GoToMuseumButton";
import { HoverShimmer } from "@/components/public/HoverShimmer";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { DEFAULT_HOVER_SHIMMER, type ShimmerSettings } from "@/lib/hover-shimmer";
import type { PublicGame } from "@/lib/minigames/types";
import { imageVariantUrl } from "@/lib/images/variants";
import {
  sanitizeCarouselMode,
  clampCarouselSpeed,
  carouselLoopDuration,
} from "@/lib/gallery-carousel";

type Artwork = PublicArtwork;

// Sort options for the artworks inside an opened section — mirrors the
// admin's Featured/New Release tagged-first pattern, scoped to fields the
// public artwork payload actually carries (no createdAt here).
type ArtworkSortOption = "default" | "title" | "price" | "featured" | "newRelease";
type SortOrder = "asc" | "desc";

// Mirrors the modal's sm/lg/xl breakpoints (Tailwind 640/1024/1280). Keyed by
// max-width, per react-masonry-css's convention — this is what makes the
// masonry distribute artworks left-to-right, top-to-bottom (round-robin by
// index) instead of CSS multi-columns' height-balanced fill, which is what
// scattered the last row of a section with few artworks.
const ARTWORK_MASONRY_BREAKPOINTS = {
  default: 4,
  1279: 3,
  1023: 2,
  639: 1,
};

interface Section {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  coverImageUrl: string | null;
  artworks: Artwork[];
}

interface GalleryClientProps {
  sections?: Section[];
  // Admin-configured mobile carousel (Settings → Preferences → Branding).
  // Both re-validated here (defense-in-depth against a row edited directly
  // in the DB), same reasoning as PublicThemeStyle for the site theme.
  carouselMode?: string;
  carouselSpeed?: number;
  // Admin-configured hover light-sweep for the section cards (Settings →
  // Preferences → Branding → Hover Shimmer, "Gallery" tab). Already
  // sanitized by the page; defaults to a white sweep when nothing is saved.
  shimmer?: ShimmerSettings;
  // Playable mini games, resolved server-side so the launcher costs no client
  // request until a visitor opens it. Empty (the default) hides it entirely —
  // see components/public/minigames/MiniGamesLauncher.tsx.
  miniGames?: PublicGame[];
  // Digital Museum enabled + has at least one (published) curated artwork —
  // resolved server-side (see app/(public)/page.tsx's getMuseumStatus()) so
  // the button simply doesn't render rather than linking to an empty/disabled
  // museum. See app/(public)/gallery/museum/.
  museumEnabled?: boolean;
  // Freedom Wall button visibility (FreedomWallSettings.isActive).
  // false → button hidden; true → direct link or dropdown (see below).
  freedomWallActive?: boolean;
  // Whether the Freedom Wall museum room is enabled (MuseumRoom.enabled).
  // true  → button shows a dropdown: "To Page" vs "Inside the Museum"
  // false → button is a plain link straight to /gallery/freedom-wall
  freedomWallMuseumEnabled?: boolean;
}

// ── Freedom Wall Button ─────────────────────────────────────────────────────
// Direct link when museum room is off; dropdown when it's on.
function FreedomWallButton({ museumRoomEnabled }: { museumRoomEnabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const btnCls =
    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap " +
    "bg-yellow-300/90 hover:bg-yellow-400 text-yellow-900 shadow-md " +
    "transition-colors ring-1 ring-yellow-400/50";

  // No museum room → plain link, no dropdown needed
  if (!museumRoomEnabled) {
    return (
      <Link href="/gallery/freedom-wall" className={btnCls}>
        <StickyNote size={15} />
        Freedom Wall
      </Link>
    );
  }

  // Museum room enabled → dropdown
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className={btnCls}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <StickyNote size={15} />
        Freedom Wall
        <ChevronDown
          size={13}
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className={
              "absolute right-0 mt-2 w-52 rounded-xl shadow-xl z-30 overflow-hidden " +
              "bg-white dark:bg-zinc-800 border border-black/8 dark:border-white/10"
            }
          >
            <Link
              href="/gallery/freedom-wall"
              onClick={() => setOpen(false)}
              className={
                "flex items-center gap-3 px-4 py-3 text-sm font-medium " +
                "hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors " +
                "text-zinc-700 dark:text-zinc-200 border-b border-black/6 dark:border-white/8"
              }
            >
              <ExternalLink size={14} className="shrink-0 text-yellow-600" />
              <span>
                <span className="block font-semibold text-zinc-800 dark:text-zinc-100">Visit the Page</span>
                <span className="block text-xs text-zinc-400 font-normal">gallery/freedom-wall</span>
              </span>
            </Link>
            <Link
              href="/gallery/museum?room=freedom-wall"
              onClick={() => setOpen(false)}
              className={
                "flex items-center gap-3 px-4 py-3 text-sm font-medium " +
                "hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors " +
                "text-zinc-700 dark:text-zinc-200"
              }
            >
              <Landmark size={14} className="shrink-0 text-yellow-600" />
              <span>
                <span className="block font-semibold text-zinc-800 dark:text-zinc-100">Inside the Museum</span>
                <span className="block text-xs text-zinc-400 font-normal">Freedom Wall room</span>
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Mobile "Explore" sheet ──────────────────────────────────────────────────
// Below `sm` the three pills (Freedom Wall / Mini Games / Go To Museum) never
// fit one row — at 390px the third ran off the edge, and stacking them ate a
// third of the first screen. On a phone they collapse into this one pill,
// which opens the same bottom sheet MiniGamesLauncher uses, listing every
// destination as a row. Desktop keeps the three pills; only the trigger is
// swapped, the destinations are identical.
function ExploreMenu({
  freedomWallActive,
  freedomWallMuseumEnabled,
  hasMiniGames,
  museumEnabled,
  onMiniGames,
}: {
  freedomWallActive: boolean;
  freedomWallMuseumEnabled: boolean;
  hasMiniGames: boolean;
  museumEnabled: boolean;
  onMiniGames: () => void;
}) {
  const [open, setOpen] = useState(false);
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const rowCls =
    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-white/5 active:bg-white/10 transition-colors";
  const iconCls = "shrink-0 w-9 h-9 rounded-full flex items-center justify-center";

  return (
    <div className="sm:hidden">
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm whitespace-nowrap bg-gradient-to-br from-ink-900 via-ink-700 to-ink-600 border-white/20 shadow-[0_2px_16px_-2px_rgba(255,255,255,0.25)] font-body text-xs font-medium tracking-[0.2em] uppercase text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </span>
        <span className="relative inline-flex items-center gap-2">
          <Compass size={15} strokeWidth={1.5} aria-hidden="true" />
          Explore
          <ChevronDown size={13} aria-hidden="true" />
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Explore"
          >
            <motion.div
              className="w-full rounded-t-2xl border-t border-white/10 bg-ink-900/95 backdrop-blur-md p-4 pb-8 space-y-2"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="flex items-center gap-2 font-grotesk text-sm font-semibold tracking-widest uppercase text-cream">
                  <Compass size={16} className="text-sepia" aria-hidden="true" />
                  Explore
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1.5 -m-1 text-white/50 hover:text-cream transition-colors"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>

              {freedomWallActive && (
                <Link href="/gallery/freedom-wall" onClick={() => setOpen(false)} className={rowCls}>
                  <span className={`${iconCls} bg-yellow-300/15 text-yellow-300`}>
                    <StickyNote size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-sm text-cream">Freedom Wall</span>
                    <span className="block font-body text-[11px] text-white/35">
                      {freedomWallMuseumEnabled ? "Visit the page" : "Leave a note"}
                    </span>
                  </span>
                  <ExternalLink size={14} className="shrink-0 text-white/30" />
                </Link>
              )}
              {freedomWallActive && freedomWallMuseumEnabled && (
                <Link href="/gallery/museum?room=freedom-wall" onClick={() => setOpen(false)} className={rowCls}>
                  <span className={`${iconCls} bg-yellow-300/15 text-yellow-300`}>
                    <Landmark size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-sm text-cream">Freedom Wall</span>
                    <span className="block font-body text-[11px] text-white/35">Inside the Museum</span>
                  </span>
                </Link>
              )}
              {hasMiniGames && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onMiniGames();
                  }}
                  className={rowCls}
                >
                  <span className={`${iconCls} bg-vermillion/15 text-vermillion`}>
                    <Gamepad2 size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-sm text-cream">Mini Games</span>
                    <span className="block font-body text-[11px] text-white/35">Pick a game to play</span>
                  </span>
                  <ChevronDown size={14} className="shrink-0 -rotate-90 text-white/30" />
                </button>
              )}
              {museumEnabled && (
                <Link href="/gallery/museum" onClick={() => setOpen(false)} className={rowCls}>
                  <span className={`${iconCls} bg-emerald-500/15 text-emerald-400`}>
                    <Landmark size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-sm text-cream">Go To Museum</span>
                    <span className="block font-body text-[11px] text-white/35">Walk the Digital Museum</span>
                  </span>
                  <ExternalLink size={14} className="shrink-0 text-white/30" />
                </Link>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getCoverImage(section: Section): string | null {
  if (section?.coverImageUrl) return section.coverImageUrl;
  const artworks = section?.artworks || [];
  if (artworks.length > 0 && artworks[0]?.imageUrl) return artworks[0].imageUrl;
  return null;
}

interface SectionCardProps {
  section: Section;
  index: number;
  onOpenSection: (section: Section) => void;
  shimmer: ShimmerSettings;
}

function SectionCard({ section, index, onOpenSection, shimmer }: SectionCardProps) {
  const cover = getCoverImage(section);
  const artworksCount = (section.artworks || []).length;
  return (
    <motion.div
      className="artwork-card group cursor-pointer relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: (index % 12) * 0.05 }}
      onClick={() => onOpenSection(section)}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl transition-shadow duration-500 group-hover:shadow-[0_12px_40px_-10px_rgba(200,169,110,0.6)]">
        {cover ? (
          <Image
            src={cover}
            alt={section.name || "Section cover"}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-ink-800/50 flex items-center justify-center">
            <FolderOpen size={48} className="text-white/20" strokeWidth={1} />
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

        {/* Section info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-5 pointer-events-none">
          <h3 className="font-grotesk text-sm sm:text-base lg:text-lg font-semibold tracking-wider uppercase text-white leading-tight line-clamp-2 break-words">
            {section.name}
          </h3>
          <p className="font-body text-xs text-white/50 tracking-widest uppercase mt-1.5">
            {artworksCount} work{artworksCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Premium hover frame — gilded ring + light sweep, replacing the old thin ring.
            The sweep's colour/speed/brightness are the admin's (Hover Shimmer →
            Gallery); its default is the same sepia-light/25 it always had. */}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-sepia-light/0 group-hover:ring-sepia-light/80 transition-all duration-500 pointer-events-none" />
        <HoverShimmer settings={shimmer} />
      </div>
    </motion.div>
  );
}

export function GalleryClient({
  sections = [],
  carouselMode,
  carouselSpeed,
  shimmer = DEFAULT_HOVER_SHIMMER.gallery,
  miniGames = [],
  museumEnabled = false,
  freedomWallActive = false,
  freedomWallMuseumEnabled = false,
}: GalleryClientProps) {
  const safeSections = Array.isArray(sections) ? sections : [];
  const mode = sanitizeCarouselMode(carouselMode);
  const speed = clampCarouselSpeed(carouselSpeed);
  const [openSection, setOpenSection] = useState<Section | null>(null);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  // The mobile Explore sheet's "Mini Games" row opens the launcher's own
  // sheet — see MiniGamesLauncher's openRequest.
  const [miniGamesOpenRequest, setMiniGamesOpenRequest] = useState(0);

  // Sort controls for the artworks inside the currently open section
  const [artworkSortBy, setArtworkSortBy] = useState<ArtworkSortOption>("default");
  const [artworkSortOrder, setArtworkSortOrder] = useState<SortOrder>("desc");

  // Reset back to the curator's default order whenever a (different) section
  // is opened, so a sort choice doesn't leak from a previously viewed section
  useEffect(() => {
    if (openSection) {
      setArtworkSortBy("default");
      setArtworkSortOrder("desc");
    }
  }, [openSection]);

  const sortedSectionArtworks = useMemo(() => {
    const artworks = openSection?.artworks || [];
    if (artworkSortBy === "default") return artworks;

    return [...artworks].sort((a, b) => {
      let comparison = 0;

      switch (artworkSortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "price": {
          const priceA = a.product?.price ?? -1;
          const priceB = b.product?.price ?? -1;
          comparison = priceA - priceB;
          break;
        }
        case "featured":
          comparison = Number(b.featured) - Number(a.featured);
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        case "newRelease":
          comparison = Number(b.isNewRelease) - Number(a.isNewRelease);
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
      }

      return artworkSortOrder === "asc" ? comparison : -comparison;
    });
  }, [openSection, artworkSortBy, artworkSortOrder]);

  // Full image preview lightbox — separate from ArtworkDetailModal, just the
  // raw image, opened via the hover zoom-in affordance on each thumbnail.
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // Lock background body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(
      openSection || selectedArtwork || previewImage
    );
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [openSection, selectedArtwork, previewImage]);

  // Close modals on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previewImage) {
          setPreviewImage(null);
        } else if (selectedArtwork) {
          setSelectedArtwork(null);
        } else if (openSection) {
          setOpenSection(null);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedArtwork, openSection, previewImage]);

  const totalArtworks = safeSections.reduce(
    (sum, s) => sum + (s.artworks || []).length,
    0
  );

  // Duplication for a seamless loop of the conveyor / marquee effect
  const marqueeSections = [...safeSections, ...safeSections];

  return (
    <>
      {/* Count + mini games entry — kept on one line so the games read as part
          of the gallery's own chrome rather than a bolted-on widget. */}
      {/* Stacked and centered on a phone (the count above the Explore pill,
          both centred — justify-between on one narrow row left them
          stranded at opposite edges); back to the original side-by-side row
          from `sm` up, where there's width for both. */}
      <div className="flex flex-col items-center gap-4 mb-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="font-body text-xs text-white/50 tracking-widest uppercase">
          {safeSections.length} section{safeSections.length !== 1 ? "s" : ""} ·{" "}
          {totalArtworks} work{totalArtworks !== 1 ? "s" : ""}
        </p>
        {/* Desktop: the three pills. Phone: one "Explore" pill opening a sheet
            with the same destinations (see ExploreMenu). The launcher is
            rendered once for both — only its trigger is hidden on a phone;
            its sheet/preview/session still mount, driven by openRequest. */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {freedomWallActive && (
            <div className="hidden sm:block">
              <FreedomWallButton museumRoomEnabled={freedomWallMuseumEnabled} />
            </div>
          )}
          <MiniGamesLauncher
            initialGames={miniGames}
            triggerClassName="hidden sm:inline-flex"
            openRequest={miniGamesOpenRequest}
          />
          {museumEnabled && (
            <div className="hidden sm:block">
              <GoToMuseumButton />
            </div>
          )}
          <ExploreMenu
            freedomWallActive={freedomWallActive}
            freedomWallMuseumEnabled={freedomWallMuseumEnabled}
            hasMiniGames={miniGames.length > 0}
            museumEnabled={museumEnabled}
            onMiniGames={() => setMiniGamesOpenRequest((n) => n + 1)}
          />
        </div>
      </div>

      {/* Empty state */}
      {safeSections.length === 0 ? (
        <div className="text-center py-24">
          <FolderOpen
            size={48}
            strokeWidth={1}
            className="mx-auto mb-4 text-white/20"
          />
          <p className="font-display text-3xl font-light italic text-white/40">
            No artworks yet
          </p>
          <p className="font-body text-sm text-white/30 mt-2">
            Check back soon for new collections.
          </p>
        </div>
      ) : mode === "grid" ? (
        /* Grid mode: admin opted out of the mobile carousel entirely — same
           grid at every breakpoint, no conveyor/swipe track at all.
           Flex + justify-center (not CSS grid) on purpose: when the last row
           is short a card or two, grid tracks stay left-anchored, but a
           flex-wrap row with explicit per-item widths centers its leftover
           items instead. */
        <div className="flex flex-wrap justify-center gap-5">
          {safeSections.map((section, i) => (
            <div
              key={section.id}
              className="w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)] xl:w-[calc(25%-0.9375rem)] shrink-0"
            >
              <SectionCard
                section={section}
                index={i}
                onOpenSection={setOpenSection}
                shimmer={shimmer}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Desktop Grid (md+) — unaffected by the mobile carousel mode.
              Same flex-wrap + centered-last-row treatment as grid mode above. */}
          <div className="hidden md:flex flex-wrap justify-center gap-5">
            {safeSections.map((section, i) => (
              <div
                key={section.id}
                className="w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.834rem)] xl:w-[calc(25%-0.9375rem)] shrink-0"
              >
                <SectionCard
                  section={section}
                  index={i}
                  onOpenSection={setOpenSection}
                  shimmer={shimmer}
                />
              </div>
            ))}
          </div>

          {mode === "swipe" ? (
            /* Swipe mode: real touch-scrolling + scroll-snap, no auto-motion. */
            <div className="md:hidden -mx-4 px-4 py-2 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar">
              {safeSections.map((section, i) => (
                <div
                  key={section.id}
                  className="w-[70vw] max-w-[260px] flex-none snap-start"
                >
                  <SectionCard
                    section={section}
                    index={i}
                    onOpenSection={setOpenSection}
                    shimmer={shimmer}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* Auto mode: Mobile Conveyor / Infinite Marquee */
            <div className="md:hidden overflow-hidden py-2 w-full relative">
              <motion.div
                className="flex gap-4 w-max"
                animate={{ x: isPaused ? undefined : ["0%", "-50%"] }}
                transition={{
                  x: {
                    repeat: Infinity,
                    repeatType: "loop",
                    duration: carouselLoopDuration(safeSections.length, speed),
                    ease: "linear",
                  },
                }}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                {marqueeSections.map((section, i) => (
                  <div
                    key={`${section.id}-${i}`}
                    className="w-[70vw] max-w-[260px] flex-none"
                  >
                    <SectionCard
                      section={section}
                      index={i}
                      onOpenSection={setOpenSection}
                      shimmer={shimmer}
                    />
                  </div>
                ))}
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* ── Section Modal (artworks inside a section) ── */}
      <AnimatePresence>
        {openSection && !selectedArtwork && (
          <motion.div
            className="fixed inset-0 z-50 bg-ink/90 backdrop-blur-sm flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpenSection(null)}
          >
            {/* Header */}
            <div
              className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-6 md:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="font-body text-xs tracking-[0.3em] uppercase text-sepia mb-1">
                  {(openSection.artworks || []).length} work
                  {(openSection.artworks || []).length !== 1 ? "s" : ""}
                </p>
                <h2 className="font-grotesk text-2xl md:text-3xl font-bold tracking-widest uppercase text-white">
                  {openSection.name}
                </h2>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Sort controls */}
                {(openSection.artworks || []).length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5">
                      <ArrowUpDown size={12} className="text-white/40 shrink-0" />
                      <select
                        value={artworkSortBy}
                        onChange={(e) => {
                          const next = e.target.value as ArtworkSortOption;
                          setArtworkSortBy(next);
                          // Tagged-first is the useful default here too
                          if (next === "featured" || next === "newRelease") {
                            setArtworkSortOrder("asc");
                          }
                        }}
                        className="bg-transparent font-body text-xs text-white/80 outline-none cursor-pointer"
                        aria-label="Sort artworks"
                      >
                        <option value="default" className="bg-ink-900 text-white">
                          Curator&apos;s Order
                        </option>
                        <option value="title" className="bg-ink-900 text-white">
                          Title (A–Z)
                        </option>
                        <option value="price" className="bg-ink-900 text-white">
                          Price
                        </option>
                        <option value="featured" className="bg-ink-900 text-white">
                          Featured
                        </option>
                        <option value="newRelease" className="bg-ink-900 text-white">
                          New Release
                        </option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={artworkSortBy === "default"}
                      onClick={() =>
                        setArtworkSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                      }
                      className="p-2 rounded-lg border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/5"
                      title={artworkSortOrder === "asc" ? "Ascending" : "Descending"}
                      aria-label="Toggle sort direction"
                    >
                      {artworkSortOrder === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )}
                    </button>
                  </div>
                )}

                <button
                  className="text-cream hover:text-sepia transition-colors p-2"
                  onClick={() => setOpenSection(null)}
                  aria-label="Close"
                >
                  <X size={24} strokeWidth={1} />
                </button>
              </div>
            </div>

            {/* Scrollable artwork grid */}
            <div
              className="flex-1 overflow-y-auto px-6 md:px-8 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              <Masonry
                breakpointCols={ARTWORK_MASONRY_BREAKPOINTS}
                className="flex w-auto -ml-4 md:-ml-6"
                columnClassName="pl-4 md:pl-6"
              >
                {sortedSectionArtworks.map((artwork, i) => (
                  <motion.div
                    key={artwork.id}
                    className="artwork-card mb-4 md:mb-6 group"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: (i % 12) * 0.04 }}
                  >
                    <div
                      className="relative overflow-hidden cursor-pointer"
                      onClick={() => setSelectedArtwork(artwork)}
                    >
                      <Image
                        src={imageVariantUrl(artwork.imageUrl, "thumb")}
                        alt={artwork.title}
                        width={600}
                        height={800}
                        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />

                      {/* Sold badge */}
                      {artwork.status === "SOLD" && (
                        <div className="absolute top-3 right-3 bg-vermillion px-3 py-1">
                          <span className="font-body text-[10px] tracking-widest uppercase text-cream">
                            Sold
                          </span>
                        </div>
                      )}

                      {/* New Release badge */}
                      {artwork.isNewRelease && (
                        <div className="absolute top-3 left-3">
                          <NewReleaseBadge size="sm" />
                        </div>
                      )}

                      {/* Featured badge */}
                      {artwork.featured && (
                        <div className="absolute bottom-3 left-3">
                          <FeaturedBadge size="sm" />
                        </div>
                      )}

                      {/* Timelapse video indicator — centered so it never
                          collides with the corner badges/zoom button above */}
                      {artwork.videoUrl && <VideoIndicator />}

                      {/* Hover overlay */}
                      <div className="artwork-overlay">
                        <div>
                          <h3 className="font-display text-xl font-light italic text-cream mb-1">
                            {artwork.title}
                          </h3>
                          <p className="font-body text-xs text-white/60 uppercase tracking-wider">
                            {artwork.medium}
                          </p>
                          <p className="font-body text-xs text-white/50 mt-2 leading-relaxed line-clamp-2">
                            {artwork.description}
                          </p>
                        </div>
                      </div>

                      {/* Zoom-in — quick full image preview, separate from the detail modal */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage({
                            url: artwork.imageUrl,
                            title: artwork.title,
                          });
                        }}
                        className="absolute bottom-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/80 transition-all duration-300"
                        title="View full image"
                        aria-label="View full image"
                      >
                        <ZoomIn size={16} />
                      </button>
                    </div>
                    <div className="p-4 border-t border-white/5">
                      <h3
                        className="font-display text-lg font-light italic text-white cursor-pointer hover:text-sepia transition-colors"
                        onClick={() => setSelectedArtwork(artwork)}
                      >
                        {artwork.title}
                      </h3>
                      <div className="flex items-center justify-between mt-2">
                        <p className="font-body text-xs text-white/50 uppercase tracking-wider">
                          {artwork.medium}
                        </p>
                        {artwork.status === "SOLD" && (
                          <span className="font-body text-[10px] tracking-widest uppercase text-vermillion">
                            Sold
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </Masonry>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Artwork Detail Modal ── */}
      <ArtworkDetailModal
        artwork={selectedArtwork}
        onClose={() => setSelectedArtwork(null)}
      />

      {/* ── Full Image Preview Lightbox ── */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPreviewImage(null)}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X size={22} />
            </button>
            <div
              className="relative w-full max-w-4xl flex flex-col items-center gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-[75vh]">
                <Image
                  src={previewImage.url}
                  alt={previewImage.title || "Full image preview"}
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              {previewImage.title && (
                <p className="font-display text-lg italic text-cream text-center">
                  {previewImage.title}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
