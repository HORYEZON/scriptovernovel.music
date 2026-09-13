"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Star, ZoomIn, X } from "lucide-react";
import { ArtworkDetailModal, type PublicArtwork } from "@/components/public/ArtworkDetailModal";
import { FeaturedBadge } from "@/components/public/ArtworkBadge";
import { VideoIndicator } from "@/components/public/VideoIndicator";
import { imageVariantUrl } from "@/lib/images/variants";

interface FeaturedCarouselProps {
  artworks: PublicArtwork[];
}

// Curated shelf for artworks the admin has flagged as "Featured" — a
// horizontally scrolling row of wide (landscape) cards, separate from the
// per-section grid below. Renders nothing if there's nothing featured yet.
export function FeaturedCarousel({ artworks }: FeaturedCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
    loop: true,
  });
  const [quickView, setQuickView] = useState<PublicArtwork | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Full image preview lightbox — separate from the quick-view detail modal,
  // opened via the hover zoom-in affordance on each card.
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay — advance one slide every 4s, looping continuously. Paused
  // while the quick-view modal is open or the user is hovering/dragging.
  const stopAutoplay = useCallback(() => {
    if (autoplayRef.current) {
      clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const startAutoplay = useCallback(() => {
    if (!emblaApi) return;
    stopAutoplay();
    autoplayRef.current = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
  }, [emblaApi, stopAutoplay]);

  // Close the image preview lightbox on Escape.
  useEffect(() => {
    if (!previewImage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewImage(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewImage]);

  useEffect(() => {
    if (!emblaApi || quickView || previewImage) return;
    startAutoplay();
    emblaApi.on("pointerDown", stopAutoplay);
    emblaApi.on("pointerUp", startAutoplay);
    return () => {
      stopAutoplay();
      emblaApi.off("pointerDown", stopAutoplay);
      emblaApi.off("pointerUp", startAutoplay);
    };
  }, [emblaApi, quickView, previewImage, startAutoplay, stopAutoplay]);

  if (artworks.length === 0) return null;

  return (
    <div className="mb-10 md:mb-14">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="font-body text-xs tracking-[0.4em] uppercase text-sepia-light mb-2 flex items-center gap-2">
            <Star size={12} className="fill-current" />
            Featured
          </p>
          <h2 className="font-grotesk text-xl md:text-2xl font-bold tracking-widest uppercase text-white">
            Curator&apos;s Picks
          </h2>
        </div>

        {/* Arrow controls (desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
            aria-label="Scroll left"
            className="p-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
            aria-label="Scroll right"
            className="p-2 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Carousel viewport */}
      <div
        className="overflow-hidden -mx-1"
        ref={emblaRef}
        onMouseEnter={stopAutoplay}
        onMouseLeave={startAutoplay}
      >
        <div className="flex gap-4 md:gap-5 px-1">
          {artworks.map((artwork) => (
            <div
              key={artwork.id}
              className="flex-none w-[78vw] sm:w-[360px] md:w-[400px]"
            >
              {/* Not a <button> — the zoom-in control below is its own
                  interactive element, and a <button> can't nest one. */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setQuickView(artwork)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setQuickView(artwork);
                  }
                }}
                className="artwork-card group w-full text-left cursor-pointer"
              >
                {/* Rectangle (16:9) frame */}
                <div className="relative aspect-video overflow-hidden rounded-xl transition-shadow duration-500 group-hover:shadow-[0_12px_40px_-10px_rgba(200,169,110,0.6)]">
                  <Image
                    src={imageVariantUrl(artwork.imageUrl, "medium")}
                    alt={artwork.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 80vw, 400px"
                  />

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

                  {/* Featured pill */}
                  <div className="absolute top-3 left-3">
                    <FeaturedBadge size="sm" />
                  </div>

                  {/* Sold ribbon */}
                  {artwork.status === "SOLD" && (
                    <div className="absolute top-3 right-3 bg-vermillion px-2.5 py-1 rounded-md">
                      <span className="font-body text-[10px] tracking-widest uppercase text-cream">
                        Sold
                      </span>
                    </div>
                  )}

                  {/* Timelapse video indicator — centered so it never
                      collides with the corner badges/zoom button */}
                  {artwork.videoUrl && <VideoIndicator />}

                  {/* Title overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display text-lg sm:text-xl font-light italic text-white leading-tight truncate">
                      {artwork.title}
                    </h3>
                    <p className="font-body text-xs text-white/60 uppercase tracking-wider mt-1 truncate">
                      {[artwork.medium, artwork.year].filter(Boolean).join(" · ")}
                    </p>
                  </div>

                  {/* Zoom-in — quick full image preview, separate from the quick-view modal */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewImage({ url: artwork.imageUrl, title: artwork.title });
                    }}
                    className="hidden sm:flex absolute bottom-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/80 transition-all duration-300"
                    title="View full image"
                    aria-label="View full image"
                  >
                    <ZoomIn size={16} />
                  </button>

                  {/* Premium hover frame — gilded ring + light sweep, replacing the old thin ring */}
                  <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-sepia-light/0 group-hover:ring-sepia-light/80 transition-all duration-500 pointer-events-none" />
                  <div className="absolute inset-0 rounded-xl overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-sepia-light/25 to-transparent group-hover:animate-shimmer" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ArtworkDetailModal artwork={quickView} onClose={() => setQuickView(null)} />

      {/* ── Full Image Preview Lightbox ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
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
        </div>
      )}
    </div>
  );
}
