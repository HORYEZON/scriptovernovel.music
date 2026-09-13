"use client";

import Image from "@/components/ui/SafeImage";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MuseumAboutCertificate } from "@/types";

/**
 * The [E]-triggered info panel for a wall certificate — same trigger/shell
 * as ArtworkInfoPanel.tsx (proximity + facing via AboutRoomContents.tsx's
 * own tracker, not PlayerControls' artwork placements — the About room
 * carries zero MuseumRoomArtwork entries, see roomConstants.ts's ABOUT
 * preset comment), content styled to match CertificatesGallery.tsx's card
 * (italic display title, sepia issuer, muted date) instead of copying
 * ArtworkInfoPanel's artwork-specific fields (medium/year/Wishlist/"View in
 * Gallery" — none of which apply to a certificate).
 */
export function CertificateInfoPanel({
  certificate,
  onClose,
  landscape = false,
}: {
  certificate: MuseumAboutCertificate | null;
  onClose: () => void;
  /** True only on a touch device in landscape (MuseumClient.tsx's toggle).
   * Switches to the same wide, image-beside-text arrangement
   * ArtworkInfoPanel.tsx uses, which exists because a 4:3 image stacked
   * above the text is taller on its own than a landscape phone's whole
   * drawn area. Deliberately a prop and not Tailwind's `landscape:` variant:
   * that's a *physical* orientation media query, and the museum's
   * forced-landscape mode is a CSS rotate on a phone the browser still
   * considers portrait, so the variant never fires exactly where it's needed
   * most. */
  landscape?: boolean;
}) {
  return (
    <AnimatePresence>
      {certificate && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            // This panel had no height cap at all — the 4:3 image alone is
            // ~384px tall at max-w-lg, more than a landscape phone's entire
            // drawn area, with nothing to scroll and the close button pushed
            // off-screen with it. max-h + flex-col here, scrolling on the
            // body below, so the close button stays put in the corner.
            // min(85vh,100%) rather than a bare 85vh for the reason
            // MuseumMap.tsx documents: the overlay above is `fixed inset-0`
            // inside a transformed ancestor, so it fills the pre-rotation
            // box while vh keeps measuring the phone's full height.
            className={cn(
              "relative w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[min(85vh,100%)]",
              landscape ? "max-w-3xl" : "max-w-lg"
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
              {certificate.imageUrl && (
                <div
                  className={cn(
                    "relative bg-black",
                    landscape ? "w-2/5 h-full flex-shrink-0" : "w-full aspect-[4/3]"
                  )}
                >
                  <Image src={certificate.imageUrl} alt={certificate.title} fill className="object-contain" />
                </div>
              )}

              <div className={cn(landscape ? "w-3/5 overflow-y-auto p-4" : "p-6")}>
                <div className="border-l-2 border-emerald-500/40 pl-3 mb-4">
                  <h2 className="font-display text-xl italic text-white mb-1">{certificate.title}</h2>
                  {(certificate.issuer || certificate.dateAwarded) && (
                    <p className="font-body text-xs text-white/40">
                      {[
                        certificate.issuer,
                        certificate.dateAwarded &&
                          new Date(certificate.dateAwarded).toLocaleDateString("en-PH", {
                            year: "numeric",
                            month: "long",
                          }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                {certificate.description && (
                  <p className="font-body text-sm text-white/70 line-clamp-4">
                    {certificate.description}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
