"use client";

import Link from "next/link";
import Image from "@/components/ui/SafeImage";
import { X, ExternalLink, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WishlistButton } from "@/components/public/WishlistButton";
import { cn, formatPrice, formatPriceRange } from "@/lib/utils";
import type { MuseumArtwork } from "@/types";

/**
 * The [E]-triggered / grid-card info panel — a lighter cousin of
 * ArtworkDetailModal.tsx sized for the museum's trimmed MuseumArtwork
 * payload (no imageUrls/tags/etc., which the museum query deliberately
 * doesn't fetch). "View in Gallery" hands off to the real, full-detail
 * /artwork/[slug] page rather than duplicating that view here.
 */
export function ArtworkInfoPanel({
  artwork,
  onClose,
  isListing = false,
  landscape = false,
}: {
  artwork: MuseumArtwork | null;
  onClose: () => void;
  /** True only when this frame was opened in the Services Room — the shop
   * wall (lib/museum/servicesRoom.ts), where every frame is a live listing.
   * Adds the price and a link through to /shop. The same artwork opened from
   * an ordinary gallery room shows neither, even if it happens to be for
   * sale: there it's a work on a wall, not a product on a shelf. */
  isListing?: boolean;
  /** True only on a touch device in landscape (MuseumScene.tsx's
   * touchLandscape). Switches to the wide, image-beside-text arrangement.
   * Deliberately a prop and not Tailwind's `landscape:` variant, for the
   * reason CertificateInfoPanel.tsx documents: that variant is a *physical*
   * orientation media query, so it stayed false throughout the museum's
   * forced-landscape mode (a CSS rotate on a browser that still considers
   * itself portrait) — the one case it was added for — while firing on every
   * desktop, which is landscape by definition. On desktop it took the phone
   * layout's `h-full` image column into a `flex-1` parent with no definite
   * height, collapsing it to zero and leaving the panel with no artwork in
   * it at all. */
  landscape?: boolean;
}) {
  const listing = isListing ? artwork?.product ?? null : null;
  return (
    <AnimatePresence>
      {artwork && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            // max-h + flex column here, with the scrolling moved onto the
            // inner wrapper below — keeps the close button fixed in the
            // corner instead of scrolling away, and caps the whole panel's
            // height so a tall/portrait video (see the video block below)
            // can never push the panel taller than the viewport on any
            // screen size, mobile included. `landscape` (the prop — see its
            // doc above) switches to a wider, shorter panel with the image
            // beside the text instead of above it, because the portrait
            // stacked layout leaves almost no room below a 4:3 image on a
            // short landscape phone screen. Desktop keeps the stacked
            // layout: it has the height for it.
            //
            // Both height caps are min(…vh, 100%) rather than bare `vh`, for
            // the same reason MuseumMap.tsx's is: under the forced-landscape
            // CSS rotate the overlay above is `fixed inset-0` inside a
            // transformed ancestor, so it fills the pre-rotation box — as
            // tall as the phone is *wide* — while `vh` went on measuring the
            // phone's full height and sized this panel to roughly twice the
            // room it had. The 100% term resolves against the real
            // containing block and so wins exactly when the two disagree;
            // desktop and un-rotated mobile are unchanged.
            className={cn(
              "relative w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col",
              landscape
                ? "max-w-3xl max-h-[min(88vh,100%)]"
                : "max-w-lg max-h-[min(85vh,100%)]"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className={cn("overflow-y-auto", landscape && "flex flex-1 overflow-hidden")}>
              {/* `self-stretch` rather than `h-full` in the side-by-side
                  layout: this column's parent is a `flex-1` item of an
                  auto-height column, so a percentage height has nothing
                  definite to resolve against and collapses the box — and
                  with it the `fill` image, which is positioned against this
                  box alone. Stretching to the flex line's cross size (i.e.
                  the text column beside it) needs no such resolution. */}
              <div
                className={cn(
                  "relative bg-black",
                  landscape
                    ? "w-2/5 self-stretch min-h-[200px] flex-shrink-0"
                    : "w-full aspect-[4/3]"
                )}
              >
                <Image src={artwork.imageUrl} alt={artwork.title} fill className="object-contain" />
              </div>

              <div className={cn(landscape ? "w-3/5 overflow-y-auto p-4" : "p-6")}>
                {/* Museum-style plaque — title/medium/year only, whatever of
                    that metadata actually exists on the artwork (no invented
                    fields, e.g. there's no per-artwork "artist" on this
                    single-artist site, so that line just never appears). */}
                <div className="border-l-2 border-emerald-500/40 pl-3 mb-4">
                  <h2 className="font-grotesk text-xl uppercase tracking-wide text-white mb-1">
                    {artwork.title}
                  </h2>
                  {(artwork.medium || artwork.year) && (
                    <p className="font-body text-xs text-white/40">
                      {[artwork.medium, artwork.year].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <p className="font-body text-sm text-white/70 mb-6 line-clamp-4">
                  {artwork.description}
                </p>

                {/* Services Room only — the price the visitor sees on the
                    plaque under the frame (ServicesRoomContents.tsx), repeated
                    here so the panel is self-contained once it's covering the
                    wall. Variants (sizes) aren't broken out: this is the
                    "from" figure, and /shop is where the real choice happens. */}
                {/* flex-wrap + the tighter landscape sizing keep the price and
                    its caption on one line on a phone in portrait and from
                    eating the panel's limited height in forced-landscape,
                    where this column is only 3/5 as wide. */}
                {listing !== null && (
                  <div className={landscape ? "mb-4" : "mb-6"}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "font-grotesk text-white",
                          landscape ? "text-xl" : "text-2xl"
                        )}
                      >
                        {formatPriceRange(
                          listing.price,
                          listing.variants.map((v) => v.price)
                        )}
                      </span>
                      <span className="font-body text-[11px] uppercase tracking-wider text-white/40">
                        {listing.variants.length > 0
                          ? `${listing.variants.length} size${listing.variants.length === 1 ? "" : "s"} in the shop`
                          : "Available in the shop"}
                      </span>
                    </div>

                    {/* Read-only chips, not the shop's selectable buttons —
                        the span above answers "how much", and this answers
                        "which size costs what", but choosing one (and the
                        cart it leads to) stays on /shop rather than being a
                        second checkout path to keep working inside a 3D
                        scene. A sold-out size still shows: knowing the A3 is
                        gone is worth more than a shorter list. */}
                    {listing.variants.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {listing.variants.map((v) => (
                          <span
                            key={v.id}
                            className={cn(
                              "font-body text-[11px] tracking-wider uppercase px-2.5 py-1 rounded-md border",
                              v.stock === 0
                                ? "border-white/10 text-white/25 line-through"
                                : "border-white/15 text-white/70"
                            )}
                          >
                            {v.label} · {formatPrice(v.price)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bonus content alongside the wall image, not a replacement
                    for it (unlike ArtworkDetailModal.tsx's carousel, where
                    the video is one of several equally-weighted slides the
                    visitor explicitly picked) — so this stays a deliberate
                    "press play" moment (no autoPlay) instead of starting
                    unprompted the instant a visitor opens the panel.
                    aspect-video boxes the video at 16:9 and lets it
                    letterbox within that (object-contain) regardless of its
                    own orientation — a portrait/vertical upload used to
                    render at its native height with nothing capping it,
                    which could push the panel taller than the viewport
                    (especially on mobile, with no way to scroll back up to
                    the close button). Fixed aspect + the panel-level
                    max-h-[85vh]/overflow-y-auto above between them cap it
                    on every screen size now. */}
                {artwork.videoUrl && (
                  <div className="mb-6">
                    <p className="font-body text-[11px] uppercase tracking-wider text-white/40 mb-2">
                      🎬 Timelapse
                    </p>
                    <div className="w-full aspect-video rounded-xl bg-black overflow-hidden">
                      <video
                        src={artwork.videoUrl}
                        poster={artwork.imageUrl}
                        controls
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {/* In the Services Room the shop is the primary action, so
                      it leads and takes the filled treatment; "View in
                      Gallery" stays available below it as the secondary. */}
                  {isListing && (
                    <Link
                      href="/shop"
                      // Opens in a new tab on purpose: navigating away tears
                      // down the whole 3D session — WebGL context, loaded
                      // textures, and wherever the visitor was standing — and
                      // coming back means walking the corridor again. Shopping
                      // is a side trip from the room, not an exit from it.
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia hover:bg-sepia-dark text-white text-sm font-medium transition-colors"
                    >
                      <ShoppingBag size={14} />
                      View in Shop
                    </Link>
                  )}
                  {artwork.slug && (
                    <Link
                      href={`/artwork/${artwork.slug}`}
                      // New tab, same reason as View in Shop above: leaving
                      // tears down the WebGL context, every loaded texture and
                      // the visitor's place in the corridor, and getting back
                      // means walking it again.
                      target="_blank"
                      rel="noopener noreferrer"
                      className={
                        isListing
                          ? "inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-white hover:bg-white/5 text-sm font-medium transition-colors"
                          : "inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                      }
                    >
                      <ExternalLink size={14} />
                      View Full Size
                    </Link>
                  )}
                  <WishlistButton
                    artwork={{
                      artworkId: artwork.id,
                      slug: artwork.slug,
                      title: artwork.title,
                      imageUrl: artwork.imageUrl,
                      price: artwork.product?.price ?? null,
                      status: artwork.status,
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 text-white hover:bg-white/5 transition-colors text-sm font-medium"
                    size={16}
                    showLabel
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
