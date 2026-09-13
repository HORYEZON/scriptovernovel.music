"use client";

import { useState } from "react";
import Image from "@/components/ui/SafeImage";
import { X, Camera, User, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ImagePreviewModal, type PreviewImage } from "@/components/public/ImagePreviewModal";
import type { MuseumCosplay } from "@/types";

/**
 * The [E]-triggered info panel for a cosplay standee — same trigger/shell as
 * CertificateInfoPanel.tsx (proximity via CosplayRoomContents.tsx's own
 * tracker, not PlayerControls' artwork placements, since the Cosplay Room
 * carries zero MuseumRoomArtwork entries), with the fields a costume photo
 * actually has: the character and what they're from, who wore it, who shot it,
 * and where.
 *
 * The one thing it adds over the certificate panel is a second image. A cosplay
 * has two — the standee shot and the photo hanging behind it — and both are
 * worth seeing full-size, so the panel shows the standee shot with the backdrop
 * as a thumbnail that swaps into the main view when tapped. That is the same
 * "look closer at what you just walked up to" move the room itself is for, and
 * it costs no request: both URLs already travelled with the room.
 */
export function CosplayInfoPanel({
  cosplay,
  onClose,
  landscape = false,
}: {
  cosplay: MuseumCosplay | null;
  onClose: () => void;
  /** True only on a touch device in landscape (MuseumClient.tsx's toggle) —
   * switches to the wide, image-beside-text arrangement, for the reason
   * ArtworkInfoPanel.tsx documents (a portrait image stacked above the text is
   * taller on its own than a landscape phone's whole drawn area). Deliberately
   * a prop and not Tailwind's `landscape:` variant: that's a *physical*
   * orientation media query, and the museum's forced-landscape mode is a CSS
   * rotate on a phone the browser still considers portrait. */
  landscape?: boolean;
}) {
  // Which of the cosplay's two photos fills the main view. Keyed on the
  // cosplay's id below (via the AnimatePresence child) so opening a different
  // standee always starts back on its standee shot rather than inheriting the
  // last one's choice.
  const [showBackdrop, setShowBackdrop] = useState(false);
  // Whichever photo is in the main view, opened full-screen — the same
  // lightbox the shop uses. The panel caps its image at two-fifths of a
  // landscape phone's width, which is a thumbnail of a photograph someone
  // built a costume for; this is the way to actually look at it.
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);

  const mainImage =
    showBackdrop && cosplay?.backdropImageUrl ? cosplay.backdropImageUrl : cosplay?.standeeImageUrl;

  const credits = cosplay
    ? [
        cosplay.cosplayer && { icon: User, label: "Cosplayer", value: cosplay.cosplayer },
        cosplay.photographer && { icon: Camera, label: "Photo", value: cosplay.photographer },
      ].filter((entry): entry is { icon: typeof User; label: string; value: string } => Boolean(entry))
    : [];

  return (
    <>
    <AnimatePresence
      onExitComplete={() => {
        setShowBackdrop(false);
        setZoomedImage(null);
      }}
    >
      {cosplay && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            // max-h + flex-col here, scrolling on the body below, so the close
            // button stays put in the corner however tall the photo is.
            // min(85vh,100%) rather than a bare 85vh for the reason
            // MuseumMap.tsx documents: the overlay above is `fixed inset-0`
            // inside a transformed ancestor, so it fills the pre-rotation box
            // while vh keeps measuring the phone's full height.
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
              {mainImage && (
                <div
                  // `self-stretch` rather than `h-full` in the side-by-side
                  // layout, for the reason ArtworkInfoPanel.tsx documents at
                  // length: this column's parent is a `flex-1` item of an
                  // auto-height column, so a percentage height has nothing
                  // definite to resolve against and collapses the box — taking
                  // the `fill` image, which is positioned against this box
                  // alone, with it. Stretching to the flex line's cross size
                  // (the text column beside it) needs no such resolution, and
                  // the min-height keeps a short caption from leaving the
                  // photo a sliver.
                  className={cn(
                    "relative bg-black",
                    landscape
                      ? "w-2/5 self-stretch min-h-[200px] flex-shrink-0"
                      : "w-full aspect-[3/4]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setZoomedImage({
                        src: mainImage,
                        alt: cosplay.character || cosplay.title,
                      })
                    }
                    aria-label="View this photo full size"
                    className="absolute inset-0 group cursor-zoom-in"
                  >
                    <Image
                      src={mainImage}
                      alt={cosplay.character || cosplay.title}
                      fill
                      className="object-contain"
                    />
                    <span className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 size={14} />
                    </span>
                  </button>
                  {/* Only offered when there's actually a second photo — a lone
                      thumbnail of the image already on screen would be a
                      control that does nothing. */}
                  {cosplay.backdropImageUrl && (
                    <div className="absolute bottom-2 left-2 flex gap-1.5">
                      {[
                        { url: cosplay.standeeImageUrl, active: !showBackdrop, backdrop: false },
                        { url: cosplay.backdropImageUrl, active: showBackdrop, backdrop: true },
                      ].map((thumb) => (
                        <button
                          key={thumb.url}
                          onClick={() => setShowBackdrop(thumb.backdrop)}
                          className={cn(
                            "relative w-10 h-12 rounded-md overflow-hidden border transition-colors",
                            thumb.active
                              ? "border-emerald-400"
                              : "border-white/20 hover:border-white/50"
                          )}
                          aria-label={thumb.backdrop ? "Show the photo behind" : "Show the standee"}
                        >
                          <Image src={thumb.url} alt="" fill className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className={cn(landscape ? "w-3/5 overflow-y-auto p-4" : "p-6")}>
                <div className="border-l-2 border-emerald-500/40 pl-3 mb-4">
                  <h2 className="font-display text-xl italic text-white mb-1">
                    {cosplay.character || cosplay.title}
                  </h2>
                  {(cosplay.series || cosplay.year || cosplay.event) && (
                    <p className="font-body text-xs text-white/40">
                      {[cosplay.series, cosplay.event, cosplay.year].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>

                {cosplay.description && (
                  <p className="font-body text-sm text-white/70 mb-4">{cosplay.description}</p>
                )}

                {credits.length > 0 && (
                  <div className="flex flex-wrap gap-x-5 gap-y-2 pt-3 border-t border-white/10">
                    {credits.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <Icon size={13} className="text-white/30 shrink-0" />
                        <span className="font-body text-xs text-white/50">
                          <span className="text-white/30">{label}: </span>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    {/* Outside the AnimatePresence above so it isn't torn down mid-exit with
        the panel — it layers over it at z-[70]. */}
    <ImagePreviewModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
    </>
  );
}
