"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import Link from "next/link";
import { X, ZoomIn, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShareButton } from "@/components/public/ShareButton";
import { WishlistButton } from "@/components/public/WishlistButton";
import { FeaturedBadge, NewReleaseBadge } from "@/components/public/ArtworkBadge";
import { VideoIndicator } from "@/components/public/VideoIndicator";

export interface PublicArtwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  // Extra angle/detail shots beyond the cover (imageUrl) — see
  // Artwork.imageUrls in prisma/schema.prisma. Empty for most pieces.
  imageUrls: string[];
  // Optional "making of" timelapse, max 60s — rendered as the last slide in
  // the carousel below, after the images.
  videoUrl: string | null;
  tags: string[];
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  featured: boolean;
  isNewRelease: boolean;
  published: boolean;
  status: "AVAILABLE" | "SOLD";
  product: { price: number } | null;
  // Null only for the sliver of pre-backfill rows that somehow slipped
  // through — Share/permalink UI just hides itself when this is null.
  slug: string | null;
}

interface ArtworkDetailModalProps {
  artwork: PublicArtwork | null;
  onClose: () => void;
}

type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

// Shared "full details" modal for an artwork — used by the section browser
// (GalleryClient) and the homepage Featured carousel so both surfaces open
// the exact same view.
export function ArtworkDetailModal({ artwork, onClose }: ArtworkDetailModalProps) {
  // Tap/click the artwork photo to see it full-screen — this is what mobile
  // relies on instead of a hover-only zoom icon (no hover state on
  // touchscreens), and it's a nice bonus on desktop too.
  const [showFullImage, setShowFullImage] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Reset whenever the modal opens with a (possibly different) artwork or closes.
  useEffect(() => {
    setShowFullImage(false);
    setActiveImageIndex(0);
  }, [artwork?.id]);

  // Cover + extra shots first, then the timelapse (if any) as a final slide
  // — same order the thumbnail strip below renders in.
  const mediaItems = useMemo<MediaItem[]>(() => {
    if (!artwork) return [];
    const items: MediaItem[] = [artwork.imageUrl, ...artwork.imageUrls].map((url) => ({
      type: "image",
      url,
    }));
    if (artwork.videoUrl) items.push({ type: "video", url: artwork.videoUrl });
    return items;
  }, [artwork]);
  const activeItem = mediaItems[activeImageIndex];
  // Only ever an image URL — used by the main display's <Image> and by the
  // full-screen lightbox, which the video slide never opens (see below).
  const activeImage = activeItem?.type === "image" ? activeItem.url : artwork?.imageUrl;
  const artworkUrl =
    artwork?.slug && typeof window !== "undefined"
      ? `${window.location.origin}/artwork/${artwork.slug}`
      : null;

  return (
    <>
      <AnimatePresence>
        {artwork && (
          <motion.div
            className="fixed inset-0 z-[60] bg-ink/90 flex items-center justify-center p-4 md:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            role="dialog"
          >
            <button
              className="absolute top-6 right-6 text-cream hover:text-sepia transition-colors z-10"
              onClick={onClose}
            >
              <X size={24} strokeWidth={1} />
            </button>
            <motion.div
              className="bg-cream dark:bg-ink-800 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 max-h-[90vh] overflow-auto"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full h-64 sm:h-80 md:h-full min-h-[320px] flex flex-col bg-ink-900/40">
                <div
                  className={`relative flex-1 min-h-0 group/photo ${
                    activeItem?.type === "video" ? "" : "cursor-pointer"
                  }`}
                  onClick={() => {
                    if (activeItem?.type !== "video") setShowFullImage(true);
                  }}
                >
                  {activeItem?.type === "video" ? (
                    <video
                      key={activeItem.url}
                      src={activeItem.url}
                      poster={artwork.imageUrl}
                      controls
                      loop
                      muted
                      playsInline
                      autoPlay
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    activeImage && (
                      <Image
                        src={activeImage}
                        alt={artwork.title}
                        fill
                        className="object-contain"
                      />
                    )
                  )}

                  {/* Zoom hint — always visible on touch (no hover there), fades
                      in on hover for pointer devices. Hidden on the video slide,
                      which has its own native fullscreen via <video controls>. */}
                  {activeItem?.type !== "video" && (
                    <div className="absolute bottom-4 right-4 p-2 rounded-full bg-black/60 text-white sm:opacity-0 sm:group-hover/photo:opacity-100 transition-opacity duration-200 pointer-events-none">
                      <ZoomIn size={16} />
                    </div>
                  )}

                  {artwork.status === "SOLD" && (
                    <div className="absolute top-4 right-4 bg-vermillion px-4 py-1.5">
                      <span className="font-body text-xs tracking-widest uppercase text-cream">
                        Sold
                      </span>
                    </div>
                  )}
                  {artwork.isNewRelease && (
                    <div className="absolute top-4 left-4">
                      <NewReleaseBadge />
                    </div>
                  )}
                  {artwork.featured && (
                    <div className="absolute bottom-4 left-4">
                      <FeaturedBadge />
                    </div>
                  )}
                </div>

                {/* Thumbnail strip — only when there's more than the cover image */}
                {mediaItems.length > 1 && (
                  <div className="flex gap-2 p-3 shrink-0 overflow-x-auto no-scrollbar bg-black/20">
                    {mediaItems.map((item, i) => (
                      <button
                        key={`${item.url}-${i}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveImageIndex(i);
                        }}
                        className={`relative w-12 h-12 shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                          i === activeImageIndex
                            ? "border-sepia"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={item.type === "video" ? artwork.imageUrl : item.url}
                          alt={
                            item.type === "video"
                              ? `${artwork.title} timelapse`
                              : `${artwork.title} thumbnail ${i + 1}`
                          }
                          fill
                          className="object-cover"
                        />
                        {item.type === "video" && <VideoIndicator size="sm" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-8 flex flex-col justify-between">
                <div>
                  <p className="font-body text-xs tracking-[0.3em] uppercase text-sepia mb-3">
                    {artwork.year}
                  </p>
                  <h2 className="font-display text-3xl font-light italic mb-4">
                    {artwork.title}
                  </h2>
                  <div className="deco-line mb-6" />
                  <p className="font-body text-sm text-ink-500 dark:text-ink-300 leading-relaxed mb-6">
                    {artwork.description}
                  </p>
                  <div className="space-y-2 font-body text-sm">
                    {artwork.medium && (
                      <p>
                        <span className="text-ink-400 text-xs uppercase tracking-widest">
                          Medium:{" "}
                        </span>
                        {artwork.medium}
                      </p>
                    )}
                    {artwork.dimensions && (
                      <p>
                        <span className="text-ink-400 text-xs uppercase tracking-widest">
                          Size:{" "}
                        </span>
                        {artwork.dimensions}
                      </p>
                    )}
                    {artwork.year && (
                      <p>
                        <span className="text-ink-400 text-xs uppercase tracking-widest">
                          Year:{" "}
                        </span>
                        {artwork.year}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-8 space-y-4">
                  {artwork.status === "SOLD" ? (
                    <p className="font-body text-sm text-vermillion italic">
                      This piece has been sold.
                    </p>
                  ) : (
                    <p className="font-body text-sm text-ink-400 italic">
                      Available — reach out via the contact page to inquire.
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <WishlistButton
                      artwork={{
                        artworkId: artwork.id,
                        slug: artwork.slug,
                        title: artwork.title,
                        imageUrl: artwork.imageUrl,
                        price: artwork.product?.price ?? null,
                        status: artwork.status,
                      }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/15 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-medium"
                      size={16}
                      showLabel
                    />
                    {artworkUrl && (
                      <ShareButton
                        artworkId={artwork.id}
                        url={artworkUrl}
                        title={artwork.title}
                      />
                    )}
                  </div>

                  {artwork.slug && (
                    <Link
                      href={`/artwork/${artwork.slug}`}
                      className="inline-flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-sepia dark:hover:text-cream transition-colors"
                    >
                      View full page <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full-screen image — reached by tapping/clicking the photo above. */}
      <AnimatePresence>
        {showFullImage && artwork && (
          <motion.div
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowFullImage(false)}
          >
            <button
              onClick={() => setShowFullImage(false)}
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
                {activeImage && (
                  <Image
                    src={activeImage}
                    alt={artwork.title}
                    fill
                    className="object-contain"
                    priority
                  />
                )}
              </div>
              <p className="font-display text-lg italic text-cream text-center">
                {artwork.title}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
