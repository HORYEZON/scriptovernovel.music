"use client";

// components/public/ReleaseCover.tsx
//
// A release's cover as a square tile that opens full-size. The tile loads the
// `medium` variant; the lightbox loads the original only once it's asked for —
// the cover is the artwork of the record, the one picture on a release page
// someone might actually want to look at.
//
// Extracted from ReleaseCard so /music's card and /music/[slug] share one
// cover (and one lightbox) rather than two copies of the same hover treatment.
import { useState } from "react";
import { Expand } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import { ImageLightbox } from "@/components/public/system/ImageLightbox";

export function ReleaseCover({
  src,
  title,
  className,
  priority = false,
}: {
  src: string;
  title: string;
  className?: string;
  /** The detail page's cover is its main image — don't lazy-load it. */
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${title} cover full size`}
        className={cn(
          "group relative block aspect-square w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageVariantUrl(src, "medium")}
          alt={`${title} cover`}
          draggable={false}
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
        <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-ink/70 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-cream backdrop-blur-sm">
            <Expand size={11} />
            View
          </span>
        </span>
      </button>
      {open && (
        // `full`, not the `medium` variant the tile uses — opening it is the
        // request for the original.
        <ImageLightbox
          src={imageVariantUrl(src, "full")}
          alt={`${title} cover`}
          caption={title}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
