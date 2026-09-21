// app/(public)/artwork/[slug]/ArtworkPageClient.tsx
"use client";

import { useState } from "react";
import Image from "@/components/ui/SafeImage";
import { ZoomIn, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { formatPrice } from "@/lib/utils";
import { ShareButton } from "@/components/public/ShareButton";
import { WishlistButton } from "@/components/public/WishlistButton";
import { FeaturedBadge } from "@/components/public/ArtworkBadge";
import { VideoIndicator } from "@/components/public/VideoIndicator";

type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

interface ArtworkPageArtwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  // Optional "making of" timelapse, max 60s — rendered as the last slide.
  videoUrl: string | null;
  tags: string[];
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  featured: boolean;
  isNewRelease: boolean;
  status: "AVAILABLE" | "SOLD";
  slug: string | null;
  product: { price: number } | null;
}

export function ArtworkPageClient({
  artwork,
  siteUrl,
}: {
  artwork: ArtworkPageArtwork;
  siteUrl: string;
}) {
  // Cover + extra shots first, then the timelapse (if any) as a final slide.
  const mediaItems: MediaItem[] = [artwork.imageUrl, ...artwork.imageUrls].map((url) => ({
    type: "image" as const,
    url,
  }));
  if (artwork.videoUrl) mediaItems.push({ type: "video", url: artwork.videoUrl });
  const [activeIndex, setActiveIndex] = useState(0);
  const [showFullImage, setShowFullImage] = useState(false);
  const activeItem = mediaItems[activeIndex];
  // Only ever an image URL — used by the main display's <Image> and the
  // full-screen lightbox, which the video slide never opens (see below).
  const activeImage = activeItem?.type === "image" ? activeItem.url : artwork.imageUrl;
  // Prefer the browser's actual origin over the server-computed siteUrl prop
  // (same fix as ArtworkDetailModal.tsx) — siteUrl falls back to
  // localhost:3000 whenever NEXTAUTH_URL/NEXT_PUBLIC_APP_URL aren't set in
  // the deployment env, which silently broke the Share link in production.
  const origin = typeof window !== "undefined" ? window.location.origin : siteUrl;
  const artworkUrl = artwork.slug ? `${origin}/artwork/${artwork.slug}` : origin;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
        {/* Gallery */}
        <div>
          <div
            className={`relative w-full aspect-square sm:aspect-[4/3] rounded-xl overflow-hidden bg-black/40 group/photo ${
              activeItem?.type === "video" ? "" : "cursor-zoom-in"
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
              <Image
                src={activeImage}
                alt={artwork.title}
                fill
                className="object-contain"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            )}

            {/* Zoom hint — hidden on the video slide, which has its own
                native fullscreen via <video controls>. */}
            {activeItem?.type !== "video" && (
              <div className="absolute bottom-4 right-4 p-2 rounded-full bg-black/60 text-white sm:opacity-0 sm:group-hover/photo:opacity-100 transition-opacity duration-200 pointer-events-none">
                <ZoomIn size={16} />
              </div>
            )}

            {artwork.featured && (
              <div className="absolute bottom-4 left-4">
                <FeaturedBadge />
              </div>
            )}
          </div>

          {mediaItems.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
              {mediaItems.map((item, i) => (
                <button
                  key={`${item.url}-${i}`}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeIndex
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

        {/* Details */}
        <div className="flex flex-col">
          <p className="font-body text-xs tracking-[0.3em] uppercase text-sepia-light mb-3">
            {artwork.year || "ScriptOverNovel"}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-light italic text-white mb-4">
            {artwork.title}
          </h1>
          <div className="deco-line mb-6" />

          {artwork.product && (
            <p className="font-jakarta text-2xl font-bold text-white mb-6">
              {formatPrice(artwork.product.price)}
            </p>
          )}

          <p className="font-body text-sm text-white/60 leading-relaxed mb-6 whitespace-pre-line">
            {artwork.description}
          </p>

          <div className="space-y-2 font-body text-sm mb-6">
            {artwork.medium && (
              <p>
                <span className="text-white/40 text-xs uppercase tracking-widest">
                  Kind:{" "}
                </span>
                <span className="text-white/80">{artwork.medium}</span>
              </p>
            )}
            {artwork.dimensions && (
              <p>
                <span className="text-white/40 text-xs uppercase tracking-widest">
                  Size:{" "}
                </span>
                <span className="text-white/80">{artwork.dimensions}</span>
              </p>
            )}
            {artwork.year && (
              <p>
                <span className="text-white/40 text-xs uppercase tracking-widest">
                  Year:{" "}
                </span>
                <span className="text-white/80">{artwork.year}</span>
              </p>
            )}
          </div>

          {artwork.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-8">
              {artwork.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50 uppercase tracking-wider"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* A museum piece, not a listing — no sold/available line. The
              shop-shaped columns (status, isNewRelease) still exist on the
              row but nothing on the band site reads them. */}
          <div className="mt-auto pt-6 border-t border-white/10">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-white hover:bg-white/5 transition-colors text-sm font-medium"
                size={16}
                showLabel
              />
              <ShareButton artworkId={artwork.id} url={artworkUrl} title={artwork.title} />
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen image lightbox */}
      <AnimatePresence>
        {showFullImage && (
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
                <Image
                  src={activeImage}
                  alt={artwork.title}
                  fill
                  className="object-contain"
                  priority
                />
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
