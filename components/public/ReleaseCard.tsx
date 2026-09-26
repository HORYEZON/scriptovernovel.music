"use client";

// components/public/ReleaseCard.tsx
//
// One release, in full: cover, type · date, description, the platform
// player (EmbedFrame), the tracklist with fold-out lyrics, and "Listen on"
// pills for every platform that isn't the player. Used by /music and the
// homepage's Latest release section.
//
// The title links to the release's own page (/music/[slug]), which is the
// same content plus its videos, its vinyl and the rest of the discography —
// this card stays the browsing view, that page is the shareable one.
import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { EmbedFrame } from "@/components/public/system/EmbedFrame";
import { ReleaseCover } from "@/components/public/ReleaseCover";
import { ReleaseTracklist, type ReleaseTrackData } from "@/components/public/ReleaseTracklist";
import { EMBED_PROVIDER_LABELS } from "@/lib/embeds";
import {
  RELEASE_TYPE_LABELS,
  formatReleaseDate,
  primaryEmbed,
  releaseEmbeds,
  releaseHref,
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
  tracks: ReleaseTrackData[];
}

export function ReleaseCard({ release, compact = false }: { release: ReleaseCardData; compact?: boolean }) {
  const player = primaryEmbed(release);
  const others = releaseEmbeds(release).filter((e) => e.provider !== player?.provider);
  const href = releaseHref(release);

  return (
    <GlassPanel as="article" padding="page" id={release.slug ?? release.id} className="scroll-mt-24">
      <div className={cn("grid grid-cols-1 gap-8", compact ? "md:grid-cols-[14rem_minmax(0,1fr)]" : "md:grid-cols-[18rem_minmax(0,1fr)] md:gap-12")}>
        <div>
          <ReleaseCover src={release.coverImageUrl} title={release.title} />
        </div>

        <div className="min-w-0">
          <p className="font-body text-[11px] uppercase tracking-[0.4em] text-sepia-light">
            {RELEASE_TYPE_LABELS[release.type]}
            {release.releaseDate && <> · {formatReleaseDate(release.releaseDate)}</>}
          </p>
          <h2 className="mt-2 font-fraunces text-3xl font-light leading-tight text-cream md:text-5xl">
            <Link href={href} className="group inline-flex items-start gap-2 transition-colors hover:text-sepia-light">
              {release.title}
              <ArrowUpRight
                size={20}
                className="mt-2 shrink-0 text-cream/40 transition-[transform,color] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-sepia-light md:mt-3"
              />
            </Link>
          </h2>
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

          <ReleaseTracklist tracks={release.tracks} release={release} className="mt-8" />

          <Link
            href={href}
            className="mt-6 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.25em] text-cream/60 transition-colors hover:text-cream"
          >
            Release page
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </GlassPanel>
  );
}
