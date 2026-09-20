"use client";

// components/public/system/EmbedFrame.tsx
//
// A streaming player for any link lib/embeds.ts understands. YouTube gets a
// click-to-load poster (its own thumbnail, blurred, with a play mark) so no
// third-party script runs until the visitor asks for it; Spotify /
// SoundCloud / Apple Music / Bandcamp players load lazily in place. Under
// the player: "Open in {provider}". A link the provider can't embed
// (a Bandcamp page URL) renders as that link alone.
import { useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMBED_PROVIDER_LABELS, parseEmbed, type ParsedEmbed } from "@/lib/embeds";

const ALLOW = "autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen";

/** Spotify/SoundCloud players are fixed-height widgets; video is 16:9. */
function frameHeight(embed: ParsedEmbed): string {
  if (embed.provider === "youtube") return "aspect-video";
  if (embed.provider === "spotify") return embed.kind === "track" ? "h-[152px]" : "h-[352px]";
  if (embed.provider === "soundcloud") return embed.kind === "track" ? "h-[166px]" : "h-[300px]";
  if (embed.provider === "applemusic") return embed.kind === "track" ? "h-[175px]" : "h-[450px]";
  return "h-[120px]";
}

export function EmbedFrame({
  url,
  title,
  className,
  showOpenLink = true,
  autoplay = false,
}: {
  url: string;
  title: string;
  className?: string;
  showOpenLink?: boolean;
  /** Skip the click-to-load poster and start playing at once — for a
   *  caller whose own click already was the consent (VideoCard). */
  autoplay?: boolean;
}) {
  const [armed, setArmed] = useState(autoplay);
  const embed = parseEmbed(url);
  if (!embed) return null;
  const label = EMBED_PROVIDER_LABELS[embed.provider];

  const openLink = showOpenLink && (
    <a
      href={embed.canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream"
    >
      Open in {label}
      <ExternalLink size={12} />
    </a>
  );

  if (!embed.embedUrl) {
    return (
      <div className={className}>
        <a
          href={embed.canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream/60"
        >
          <ExternalLink size={13} />
          Listen on {label}
        </a>
      </div>
    );
  }

  const poster = embed.provider === "youtube" && !armed;

  return (
    <div className={className}>
      <div className={cn("relative w-full overflow-hidden rounded-xl border border-white/10 bg-ink", frameHeight(embed))}>
        {poster ? (
          <button
            type="button"
            onClick={() => setArmed(true)}
            aria-label={`Play ${title}`}
            className="group absolute inset-0 flex h-full w-full items-center justify-center"
          >
            {embed.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img draggable={false}
                src={embed.thumbnailUrl}
                alt=""
                className="absolute inset-0 h-full w-full scale-105 object-cover blur-[2px] transition-[filter,transform] duration-700 group-hover:scale-100 group-hover:blur-0"
              />
            )}
            <span className="absolute inset-0 bg-ink/40 transition-colors group-hover:bg-ink/20" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full border border-cream/40 bg-ink/50 text-cream backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play size={22} className="ml-1" fill="currentColor" />
            </span>
          </button>
        ) : (
          <iframe
            src={embed.provider === "youtube" ? `${embed.embedUrl}${embed.embedUrl.includes("?") ? "&" : "?"}autoplay=1` : embed.embedUrl}
            title={title}
            loading="lazy"
            allow={ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>
      {openLink}
    </div>
  );
}
