// components/public/ImagePreviewModal.tsx
// Shared lightbox for clickable thumbnails (cart, checkout, shop). Mirrors
// the artwork detail modal look from GalleryClient, scoped down to just the
// image so it can be dropped into any page that lists product/artwork art.
"use client";

import { useEffect } from "react";
import Image from "@/components/ui/SafeImage";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export interface PreviewImage {
  src: string;
  alt: string;
}

interface ImagePreviewModalProps {
  image: PreviewImage | null;
  onClose: () => void;
}

export function ImagePreviewModal({ image, onClose }: ImagePreviewModalProps) {
  // Scroll lock goes through the shared counter rather than writing
  // document.body directly: this lightbox is opened from *inside* other
  // locked surfaces (the admin Cosplays create/edit modal, the museum's
  // standee info panel), and a direct `overflow = ""` on close would clear
  // the still-open parent's lock too. See useLockBodyScroll's own note.
  useLockBodyScroll(Boolean(image));

  // Escape closes; touch-scroll suppression is this component's own, since
  // the shared hook only owns `overflow`.
  useEffect(() => {
    if (!image) return;

    const originalTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = "none";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.touchAction = originalTouchAction;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [image, onClose]);

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          className="fixed inset-0 z-[70] bg-ink/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={image.alt}
        >
          <button
            className="absolute top-6 right-6 text-cream hover:text-sepia transition-colors z-10"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X size={24} strokeWidth={1} />
          </button>
          <motion.div
            className="relative w-full max-w-3xl h-[70vh] md:h-[80vh]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
