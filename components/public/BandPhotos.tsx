"use client";

// components/public/BandPhotos.tsx
//
// The band photos as a loose masonry-ish grid; a tap opens the full-size
// photo in the site's lightbox (ImagePreviewModal).
import { useState } from "react";
import { ImagePreviewModal } from "@/components/public/ImagePreviewModal";

export function BandPhotos({ photos }: { photos: { full: string; medium: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <ul className="columns-2 gap-4 md:columns-3 md:gap-6 [&>li]:mb-4 md:[&>li]:mb-6">
        {photos.map((p, i) => (
          <li key={p.full} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpen(p.full)}
              className="group block w-full overflow-hidden rounded-2xl border border-white/10"
              aria-label={`Open photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.medium}
                alt=""
                draggable={false}
                loading="lazy"
                className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>
      <ImagePreviewModal image={open ? { src: open, alt: "Band photo" } : null} onClose={() => setOpen(null)} />
    </>
  );
}
