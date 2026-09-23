"use client";

// components/public/system/ImageLightbox.tsx
//
// A full-bleed look at one picture: the image at its own proportions on a
// dimmed backdrop, dismissed by the ✕, by clicking away, or by Escape.
//
// The Gallery has had this since it shipped (GalleryClient's previewImage
// lightbox) and it stayed welded into that one 900-line client component, so
// every other picture on the site — a release cover, a member portrait — was
// simply not openable. This is that overlay with nothing gallery-specific
// left in it.
//
// Portalled to <body>: these get rendered from inside cards that are
// themselves inside `overflow-hidden` panels, and an overlay laid out in that
// box is clipped by it rather than covering the page.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export function ImageLightbox({
  src,
  alt,
  caption,
  onClose,
}: {
  src: string;
  alt: string;
  /** Shown under the picture — a title, usually. */
  caption?: string | null;
  onClose: () => void;
}) {
  useLockBodyScroll(true);
  // Portals can't render during SSR, and `document` isn't there to portal
  // into until after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Capture + stopPropagation so this closes the picture and not the
      // modal or menu that may be underneath it.
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md motion-safe:animate-fade-in"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
      >
        <X size={22} />
      </button>
      <div
        className="flex w-full max-w-5xl flex-col items-center gap-3"
        // The picture itself isn't a dismiss target — clicking the thing you
        // opened to look at should not close it.
        onClick={(e) => e.stopPropagation()}
      >
        {/* Plain <img>, not next/image: these are R2 URLs at unknown
            proportions and the whole point is "show it as it is". `max-h`
            rather than a fixed box so a tall cover isn't letterboxed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[80vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
        />
        {caption && (
          <p className="text-center font-body text-sm text-cream/70">{caption}</p>
        )}
      </div>
    </div>,
    document.body
  );
}
