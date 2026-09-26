// app/(public)/music/[slug]/[track]/page.tsx
//
// One song's lyrics, on its own page.
//
// "<song> lyrics" is one of the few things people actually search for by name,
// and until now the words were a fold-out under a track on /music — no address
// to send anyone, nothing for a search engine to read as the lyrics of a song.
// This page is that address: the words, a `MusicRecording` with its `lyrics`
// attached, and — when the track has been tap-synced in the admin — the record
// playing with each line lighting up as it comes.
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, ChevronRight, ExternalLink } from "lucide-react";
import { getPublicTrackPage } from "@/lib/releases-server";
import { RELEASE_TYPE_LABELS, formatDuration, formatReleaseDate, primaryEmbed, releaseHref } from "@/lib/releases";
import { EMBED_PROVIDER_LABELS } from "@/lib/embeds";
import { hasSyncedLyrics, lyricLines, resolveLyricTimings, trackLyricsHref } from "@/lib/lyrics";
import { getProfile } from "@/lib/public-data";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { CtaButton } from "@/components/public/system/CtaButton";
import { Reveal } from "@/components/public/system/Reveal";
import { LyricsReader } from "./LyricsReader";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; track: string }>;
}): Promise<Metadata> {
  const { slug, track: trackKey } = await params;
  const found = await getPublicTrackPage(slug, trackKey).catch(() => null);
  if (!found) return { title: "Track not found" };
  const { release, track } = found;

  // "<Song> lyrics" rather than just the song: it's the phrase people type, and
  // the page really is the lyrics rather than the song itself.
  const title = `${track.title} — lyrics`;
  const firstLines = lyricLines(track.lyrics).slice(0, 2).join(" / ");
  const description = firstLines
    ? `“${firstLines}…” — lyrics to ${track.title} by ScriptOverNovel, from ${release.title}.`
    : `Lyrics to ${track.title} by ScriptOverNovel, from ${release.title}.`;
  const url = `${SITE_URL}${trackLyricsHref(release, track)}`;

  return {
    title,
    description,
    openGraph: {
      title: `${track.title} — lyrics — ScriptOverNovel`,
      description,
      url,
      type: "music.song",
      images: [{ url: release.coverImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${track.title} — lyrics`,
      description,
      images: [release.coverImageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function TrackLyricsPage({
  params,
}: {
  params: Promise<{ slug: string; track: string }>;
}) {
  const { slug, track: trackKey } = await params;
  const found = await getPublicTrackPage(slug, trackKey);
  if (!found) notFound();
  const { release, track, trackIndex, previous, next, vinylAudioUrl } = found;

  const profile = await getProfile().catch(() => null);
  const bandName = profile?.displayName || "ScriptOverNovel";
  const lines = lyricLines(track.lyrics);
  const timings = resolveLyricTimings(track.lyricTimings, lines.length);
  // "Synced" needs both halves: every line timed *and* something to play them
  // against. Timings without the record's audio can't be followed.
  const synced = hasSyncedLyrics(timings, lines.length) && Boolean(vinylAudioUrl);
  const player = primaryEmbed(release);
  const url = `${SITE_URL}${trackLyricsHref(release, track)}`;
  const releaseUrl = releaseHref(release);

  return (
    <div className="pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "MusicRecording",
          name: track.title,
          url,
          image: release.coverImageUrl,
          byArtist: { "@type": "MusicGroup", name: bandName, url: `${SITE_URL}/about` },
          inAlbum: {
            "@type": "MusicAlbum",
            name: release.title,
            url: `${SITE_URL}${releaseUrl}`,
            ...(release.releaseDate && { datePublished: release.releaseDate.toISOString().slice(0, 10) }),
          },
          ...(track.durationSec && {
            duration: `PT${Math.floor(track.durationSec / 60)}M${track.durationSec % 60}S`,
          }),
          ...(track.url && { sameAs: track.url }),
          ...(track.lyrics && {
            lyrics: { "@type": "CreativeWork", text: track.lyrics },
          }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Music", item: `${SITE_URL}/music` },
            { "@type": "ListItem", position: 2, name: release.title, item: `${SITE_URL}${releaseUrl}` },
            { "@type": "ListItem", position: 3, name: track.title, item: url },
          ],
        }}
      />

      <PageHero
        image={release.coverImageUrl}
        blur="lg"
        eyebrow={
          <>
            {RELEASE_TYPE_LABELS[release.type]} · {release.title}
            {release.releaseDate && <> · {formatReleaseDate(release.releaseDate, "year")}</>}
          </>
        }
        title={track.title}
        subtitle={
          lines.length > 0
            ? `Lyrics · track ${track.trackNumber} of ${release.tracks.length}${track.durationSec ? ` · ${formatDuration(track.durationSec)}` : ""}`
            : `Track ${track.trackNumber} of ${release.tracks.length}`
        }
      >
        {player && (
          <CtaButton href={player.canonicalUrl} external>
            Listen on {EMBED_PROVIDER_LABELS[player.provider]}
          </CtaButton>
        )}
        <CtaButton href={releaseUrl} variant="ghost">
          {release.title}
        </CtaButton>
      </PageHero>

      <div className="section-padding mt-8">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/50"
        >
          <Link href="/music" className="transition-colors hover:text-cream">
            Music
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link href={releaseUrl} className="transition-colors hover:text-cream">
            {release.title}
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="truncate text-cream/70">{track.title}</span>
        </nav>
      </div>

      <Reveal as="section" className="section-padding mt-8">
        <GlassPanel padding="page" className="mx-auto max-w-3xl">
          {lines.length > 0 ? (
            <LyricsReader
              lyrics={track.lyrics ?? ""}
              timings={timings}
              audioUrl={vinylAudioUrl}
              synced={synced}
            />
          ) : (
            <>
              <p className="font-fraunces text-xl font-light text-cream">No lyrics for this one yet</p>
              <p className="mt-2 font-body text-sm leading-relaxed text-cream/70">
                {track.title} is on {release.title}
                {track.durationSec ? ` and runs ${formatDuration(track.durationSec)}` : ""}. The words aren&apos;t
                written up here — it may be an instrumental.
              </p>
            </>
          )}

          {track.url && (
            <a
              href={track.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/60 transition-colors hover:text-cream"
            >
              <ExternalLink size={12} /> This track on its own
            </a>
          )}

          {/* Prev / next through the tracklist — a lyrics page is somewhere
              people arrive from a search, so it has to offer the record it
              came from rather than being a dead end. */}
          {(previous || next) && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
              {previous ? (
                <Link
                  href={trackLyricsHref(release, previous)}
                  className="group inline-flex min-w-0 items-center gap-2 font-body text-sm text-cream/60 transition-colors hover:text-cream"
                >
                  <ArrowLeft size={14} className="shrink-0 transition-transform group-hover:-translate-x-0.5" />
                  <span className="truncate">{previous.title}</span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={trackLyricsHref(release, next)}
                  className="group inline-flex min-w-0 items-center gap-2 text-right font-body text-sm text-cream/60 transition-colors hover:text-cream"
                >
                  <span className="truncate">{next.title}</span>
                  <ArrowRight size={14} className="shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          )}
        </GlassPanel>
      </Reveal>

      {/* The rest of the record's tracklist, as lyric links. */}
      {release.tracks.length > 1 && (
        <Reveal as="section" className="section-padding mt-14">
          <GlassPanel padding="page" className="mx-auto max-w-3xl">
            <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">
              More from {release.title}
            </p>
            <ol className="mt-4 divide-y divide-white/10 border-t border-white/10">
              {release.tracks.map((t, i) => {
                const isCurrent = i === trackIndex;
                const hasLyrics = lyricLines(t.lyrics).length > 0;
                return (
                  <li key={t.id} className="flex items-center gap-4 py-3">
                    <span className="w-6 shrink-0 font-mono text-xs text-cream/40">
                      {String(t.trackNumber).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-body text-sm">
                      {isCurrent ? (
                        <span className="text-cream">{t.title}</span>
                      ) : hasLyrics ? (
                        <Link href={trackLyricsHref(release, t)} className="text-cream/70 hover:text-sepia-light">
                          {t.title}
                        </Link>
                      ) : (
                        <span className="text-cream/40">{t.title}</span>
                      )}
                    </span>
                    {!hasLyrics && !isCurrent && (
                      <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.2em] text-cream/30">
                        No lyrics
                      </span>
                    )}
                    {t.durationSec !== null && (
                      <span className="w-10 shrink-0 text-right font-mono text-xs text-cream/40">
                        {formatDuration(t.durationSec)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </GlassPanel>
        </Reveal>
      )}
    </div>
  );
}
