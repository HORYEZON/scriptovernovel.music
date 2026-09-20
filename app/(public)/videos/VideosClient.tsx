"use client";

// app/(public)/videos/VideosClient.tsx — grid of VideoCards with a kind filter.
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/public/system/Reveal";
import { VideoCard } from "@/components/public/VideoCard";
import { VIDEO_KINDS, VIDEO_KIND_LABELS, type PublicVideo, type VideoKind } from "@/lib/videos";

export function VideosClient({ videos }: { videos: PublicVideo[] }) {
  const [kind, setKind] = useState<VideoKind | "ALL">("ALL");
  const present = useMemo(() => new Set(videos.map((v) => v.kind)), [videos]);
  const shown = useMemo(() => (kind === "ALL" ? videos : videos.filter((v) => v.kind === kind)), [videos, kind]);

  if (videos.length === 0) {
    return (
      <div className="section-padding mt-16">
        <p className="font-body text-sm text-cream/60">No videos yet — soon.</p>
      </div>
    );
  }

  return (
    <div className="section-padding mt-12 md:mt-16">
      {present.size > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {(["ALL", ...VIDEO_KINDS.filter((k) => present.has(k))] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full border px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.2em] transition-colors",
                kind === k ? "border-cream/70 bg-cream/10 text-cream" : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream"
              )}
            >
              {k === "ALL" ? "All" : VIDEO_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
        {shown.map((v, i) => (
          <Reveal key={v.id} delayMs={(i % 2) * 100}>
            <VideoCard video={v} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
