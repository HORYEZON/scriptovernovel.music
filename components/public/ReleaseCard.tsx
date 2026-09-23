"use client";

// components/public/ReleaseCard.tsx
//
// One release, in full: cover, type · date, description, the platform
// player (EmbedFrame), the tracklist with fold-out lyrics, and "Listen on"
// pills for every platform that isn't the player. Used by /music and the
// homepage's Latest release section.
import { useState } from "react";
import { ChevronDown, Expand, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { EmbedFrame } from "@/components/public/system/EmbedFrame";
import { ImageLightbox } from "@/components/public/system/ImageLightbox";
import { EMBED_PROVIDER_LABELS } from "@/lib/embeds";
import {
  RELEASE_TYPE_LABELS,
  formatDuration,
  formatReleaseDate,
  primaryEmbed,
  releaseEmbeds,
  type ReleaseType,
} from "@/lib/releases";

export interface ReleaseCardData {
  id: string;
  title: string;
  slug: string | null;
  type: ReleaseType;
  coverImageUrl: string;
  releaseDate: string | null;
  description: string | null;
  spotifyUrl: string | null;
  bandcampUrl: string | null;
  youtubeUrl: string | null;
  soundcloudUrl: string | null;
  appleMusicUrl: string | null;
  primaryPlayer: string | null;
  tracks: { id: string; trackNumber: number; title: string; durationSec: number | null; url: string | null; lyrics: string | null }[];
}

export function ReleaseCard({ release, compact = false }: { release: ReleaseCardData; compact?: boolean }) {
  const player = primaryEmbed(release);
  const others = releaseEmbeds(release).filter((e) => e.provider !== player?.provider);
  const [openLyrics, setOpenLyrics] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);

  return (
    <GlassPanel as="article" padding="page" id={release.slug ?? release.id} className="scroll-mt-24">
      <div className={cn("grid grid-cols-1 gap-8", compact ? "md:grid-cols-[14rem_minmax(0,1fr)]" : "md:grid-cols-[18rem_minmax(0,1fr)] md:gap-12")}>
        <div>
          {/* The cover opens full-size. It is the artwork of the record — the
              one picture on this page someone might actually want to look at
              — and it was shown at 18rem, cropped square, with no way through
              to the original. The grid tile stays a `medium` variant; the
              lightbox loads the full file only once it is asked for. */}
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            aria-label={`View ${release.title} cover full size`}
            className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] transition-transform duration-300 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageVariantUrl(release.coverImageUrl, "medium")}
              alt={`${release.title} cover`}
              draggable={false}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-ink/70 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-cream backdrop-blur-sm">
                <Expand size={11} />
                View
              </span>
            </span>
          </button>
        </div>

        <div className="min-w-0">
          <p className="font-body text-[11px] uppercase tracking-[0.4em] text-sepia-light">
            {RELEASE_TYPE_LABELS[release.type]}
            {release.releaseDate && <> · {formatReleaseDate(release.releaseDate)}</>}
          </p>
          <h2 className="mt-2 font-fraunces text-3xl font-light leading-tight text-cream md:text-5xl">{release.title}</h2>
          {release.description && (
            <p className="mt-4 max-w-2xl whitespace-pre-line font-body text-sm leading-relaxed text-cream/70">{release.description}</p>
          )}

          {player && (
            <EmbedFrame
              url={player.canonicalUrl}
              title={release.title}
              className="mt-6"
              compact={release.tracks.length <= 1}
            />
          )}

          {others.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {others.map((e) => (
                <a
                  key={e.provider}
                  href={e.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-cream/15 px-3.5 py-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/70 transition-colors hover:border-cream/50 hover:text-cream"
                >
                  <ExternalLink size={11} /> {EMBED_PROVIDER_LABELS[e.provider]}
                </a>
              ))}
            </div>
          )}

          {release.tracks.length > 0 && (
            <ol className="mt-8 divide-y divide-white/10 border-t border-white/10">
              {release.tracks.map((t) => {
                const open = openLyrics === t.id;
                return (
                  <li key={t.id}>
                    <div className="flex items-center gap-4 py-3">
                      <span className="w-6 shrink-0 font-mono text-xs text-cream/40">{String(t.trackNumber).padStart(2, "0")}</span>
                      <span className="min-w-0 flex-1 truncate font-body text-sm text-cream">
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:text-sepia-light hover:underline">
                            {t.title}
                          </a>
                        ) : (
                          t.title
                        )}
                      </span>
                      {t.lyrics && (
                        <button
                          type="button"
                          onClick={() => setOpenLyrics(open ? null : t.id)}
                          aria-expanded={open}
                          className="inline-flex shrink-0 items-center gap-1 font-body text-[10px] uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream"
                        >
                          Lyrics <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
                        </button>
                      )}
                      {t.durationSec !== null && <span className="w-10 shrink-0 text-right font-mono text-xs text-cream/40">{formatDuration(t.durationSec)}</span>}
                    </div>
                    {t.lyrics && open && (
                      <p className="whitespace-pre-line pb-5 pl-10 font-body text-sm leading-relaxed text-cream/70 motion-safe:animate-fade-in">
                        {t.lyrics}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>

      {coverOpen && (
        // `full`, not the `medium` variant the tile uses — opening it is the
        // request for the original.
        <ImageLightbox
          src={imageVariantUrl(release.coverImageUrl, "full")}
          alt={`${release.title} cover`}
          caption={release.title}
          onClose={() => setCoverOpen(false)}
        />
      )}
    </GlassPanel>
  );
}
