"use client";

// components/public/VideoCard.tsx
//
// One video tile: the YouTube poster, blurred until hovered, with a play
// mark; clicking swaps the tile for the player in place (EmbedFrame's
// click-to-load, so no YouTube script runs until then). Used by /videos
// and the homepage strip.
import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmbedFrame } from "@/components/public/system/EmbedFrame";
import { VIDEO_KIND_LABELS, youtubeThumbnail, type PublicVideo } from "@/lib/videos";

export function VideoCard({ video, className }: { video: PublicVideo; className?: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article id={video.id} className={cn("group scroll-mt-28", className)}>
      {playing ? (
        <EmbedFrame url={video.youtubeUrl} title={video.title} showOpenLink={false} autoplay />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${video.title}`}
          className="relative block aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={youtubeThumbnail(video.youtubeId)}
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] transition-[filter,transform] duration-700 group-hover:scale-100 group-hover:blur-0"
          />
          <span className="absolute inset-0 bg-ink/35 transition-colors group-hover:bg-ink/15" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cream/40 bg-ink/50 text-cream backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play size={20} className="ml-0.5" fill="currentColor" />
            </span>
          </span>
        </button>
      )}
      <div className="mt-3">
        <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">
          {VIDEO_KIND_LABELS[video.kind]}
          {video.release && <> · {video.release.title}</>}
        </p>
        <h3 className="mt-1 font-fraunces text-xl font-light leading-snug text-cream">{video.title}</h3>
        {video.description && <p className="mt-1 font-body text-sm text-cream/60">{video.description}</p>}
      </div>
    </article>
  );
}
