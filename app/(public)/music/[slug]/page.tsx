// app/(public)/music/[slug]/page.tsx
//
// One release, on its own page: the cover, the player, the tracklist with
// fold-out lyrics, every platform it's on, the videos made for it, whether it
// exists as a record in the Vinyl Room, and the rest of the discography.
//
// Until this page existed, a release was an anchor on /music — `#slug` on one
// long page. That meant the whole discography shared a single title, a single
// description and a single share image, so posting a new single linked to a
// page mostly about the others, and a search engine had one URL to rank for
// every record. This page is per-release metadata, a per-release OG image, and
// `MusicAlbum` structured data with the tracklist in it.
//
// The route resolves by slug *or* id (getPublicReleaseBySlug) because
// `Release.slug` is nullable for rows older than the generator.
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, Disc3, ExternalLink } from "lucide-react";
import { getOtherReleases, getPublicReleaseBySlug } from "@/lib/releases-server";
import {
  RELEASE_TYPE_LABELS,
  formatReleaseDate,
  primaryEmbed,
  releaseEmbeds,
  releaseHref,
} from "@/lib/releases";
import { EMBED_PROVIDER_LABELS } from "@/lib/embeds";
import { imageVariantUrl } from "@/lib/images/variants";
import { SITE_URL } from "@/lib/site-url";
import { getProfile } from "@/lib/public-data";
import type { PublicVideo } from "@/lib/videos";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { CtaButton } from "@/components/public/system/CtaButton";
import { EmbedFrame } from "@/components/public/system/EmbedFrame";
import { Reveal } from "@/components/public/system/Reveal";
import { ReleaseCover } from "@/components/public/ReleaseCover";
import { ReleaseTracklist } from "@/components/public/ReleaseTracklist";
import { VideoCard } from "@/components/public/VideoCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const release = await getPublicReleaseBySlug(slug).catch(() => null);
  if (!release) return { title: "Release not found" };

  const kind = RELEASE_TYPE_LABELS[release.type];
  const description =
    release.description?.trim().slice(0, 160) ||
    `${release.title} — a ${kind.toLowerCase()} by ScriptOverNovel${
      release.releaseDate ? `, released ${formatReleaseDate(release.releaseDate)}` : ""
    }.`;
  // Canonical on the slug, never the id: both resolve, but only one should be
  // the address search engines keep.
  const url = `${SITE_URL}${releaseHref(release)}`;

  return {
    title: release.title,
    description,
    openGraph: {
      title: `${release.title} — ScriptOverNovel`,
      description,
      url,
      type: "music.album",
      images: [{ url: release.coverImageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${release.title} — ScriptOverNovel`,
      description,
      images: [release.coverImageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function ReleasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const release = await getPublicReleaseBySlug(slug);
  if (!release) notFound();

  const [others, profile] = await Promise.all([
    getOtherReleases(release.id).catch(() => []),
    getProfile().catch(() => null),
  ]);

  const bandName = profile?.displayName || "ScriptOverNovel";
  const url = `${SITE_URL}${releaseHref(release)}`;
  const player = primaryEmbed(release);
  const embeds = releaseEmbeds(release);
  const otherEmbeds = embeds.filter((e) => e.provider !== player?.provider);
  const kind = RELEASE_TYPE_LABELS[release.type];

  // The nested `where` already dropped unpublished/trashed videos; the release
  // relation is filled in from the record we're on rather than re-queried.
  const videos: PublicVideo[] = release.videos.map((v) => ({
    id: v.id,
    title: v.title,
    youtubeUrl: v.youtubeUrl,
    youtubeId: v.youtubeId,
    kind: v.kind,
    description: v.description,
    featured: v.featured,
    release: { id: release.id, title: release.title, slug: release.slug },
  }));

  return (
    <div className="pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "MusicAlbum",
          name: release.title,
          url,
          image: release.coverImageUrl,
          albumProductionType:
            release.type === "LIVE"
              ? "https://schema.org/LiveAlbum"
              : release.type === "COMPILATION"
                ? "https://schema.org/CompilationAlbum"
                : "https://schema.org/StudioAlbum",
          ...(release.type === "SINGLE" && { albumReleaseType: "https://schema.org/SingleRelease" }),
          ...(release.type === "EP" && { albumReleaseType: "https://schema.org/EPRelease" }),
          byArtist: { "@type": "MusicGroup", name: bandName, url: `${SITE_URL}/about` },
          ...(release.releaseDate && { datePublished: release.releaseDate.toISOString().slice(0, 10) }),
          ...(release.description && { description: release.description }),
          // Omitted rather than sent as 0 when the tracklist hasn't been typed
          // in yet — "this album has no tracks" is a claim, not a blank.
          ...(release.tracks.length > 0 && { numTracks: release.tracks.length }),
          ...(embeds.length > 0 && { sameAs: embeds.map((e) => e.canonicalUrl) }),
          ...(release.tracks.length > 0 && {
            track: {
              "@type": "ItemList",
              numberOfItems: release.tracks.length,
              itemListElement: release.tracks.map((t) => ({
                "@type": "ListItem",
                position: t.trackNumber,
                item: {
                  "@type": "MusicRecording",
                  name: t.title,
                  ...(t.durationSec && { duration: `PT${Math.floor(t.durationSec / 60)}M${t.durationSec % 60}S` }),
                  ...(t.url && { url: t.url }),
                  byArtist: { "@type": "MusicGroup", name: bandName },
                },
              })),
            },
          }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Music", item: `${SITE_URL}/music` },
            { "@type": "ListItem", position: 2, name: release.title, item: url },
          ],
        }}
      />

      <PageHero
        image={release.coverImageUrl}
        // "sm", not the other pages' heavier blur: this one is the cover, and a
        // cover should still be recognisable behind its own title.
        blur="sm"
        eyebrow={
          <>
            {kind}
            {release.releaseDate && <> · {formatReleaseDate(release.releaseDate)}</>}
          </>
        }
        title={release.title}
        subtitle={release.description?.split("\n")[0] ?? undefined}
      >
        {player && (
          <CtaButton href={player.canonicalUrl} external>
            Listen on {EMBED_PROVIDER_LABELS[player.provider]}
          </CtaButton>
        )}
        <CtaButton href="/music" variant="ghost">
          All releases
        </CtaButton>
      </PageHero>

      <div className="section-padding mt-8">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/50">
          <Link href="/music" className="transition-colors hover:text-cream">
            Music
          </Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span className="truncate text-cream/70">{release.title}</span>
        </nav>
      </div>

      <div className="mt-8 space-y-16 md:space-y-24">
        <Reveal as="section" className="section-padding">
          <GlassPanel as="article" padding="page">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[18rem_minmax(0,1fr)] md:gap-12">
              <div>
                <ReleaseCover src={release.coverImageUrl} title={release.title} priority />
                {release.vinyls.length > 0 && (
                  <Link
                    href="/gallery/museum"
                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-sepia/30 bg-sepia/5 p-3.5 transition-colors hover:border-sepia/60"
                  >
                    <Disc3 size={15} className="mt-0.5 shrink-0 text-sepia-light" />
                    <span className="font-body text-xs leading-relaxed text-cream/70">
                      <span className="text-cream">On vinyl in the museum.</span> Put{" "}
                      {release.vinyls.length === 1 && release.vinyls[0].sideLabel
                        ? release.vinyls[0].sideLabel.toLowerCase()
                        : "this record"}{" "}
                      on the turntable in the Vinyl Room.
                    </span>
                  </Link>
                )}
              </div>

              <div className="min-w-0">
                {release.description && (
                  <p className="max-w-2xl whitespace-pre-line font-body text-sm leading-relaxed text-cream/70 md:text-base">
                    {release.description}
                  </p>
                )}

                {player && (
                  <EmbedFrame
                    url={player.canonicalUrl}
                    title={release.title}
                    className={release.description ? "mt-6" : ""}
                    compact={release.tracks.length <= 1}
                  />
                )}

                {otherEmbeds.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {otherEmbeds.map((e) => (
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
                  <>
                    <p className="mt-10 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">
                      {release.tracks.length} track{release.tracks.length === 1 ? "" : "s"}
                    </p>
                    <ReleaseTracklist tracks={release.tracks} size="page" className="mt-3" />
                  </>
                )}
              </div>
            </div>
          </GlassPanel>
        </Reveal>

        {videos.length > 0 && (
          <Reveal as="section" className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading
                eyebrow="Watch"
                title={`Videos for ${release.title}`}
                action={{ label: "All videos", href: "/videos" }}
              />
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                {videos.map((v) => (
                  <VideoCard key={v.id} video={v} />
                ))}
              </div>
            </GlassPanel>
          </Reveal>
        )}

        {others.length > 0 && (
          <Reveal as="section" className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Discography" title="More releases" action={{ label: "All releases", href: "/music" }} />
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {others.map((r) => (
                  <li key={r.id}>
                    <Link href={releaseHref(r)} className="group block">
                      <div className="aspect-square overflow-hidden rounded-xl border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageVariantUrl(r.coverImageUrl, "thumb")}
                          alt={`${r.title} cover`}
                          draggable={false}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <p className="mt-2.5 truncate font-body text-xs text-cream transition-colors group-hover:text-sepia-light">
                        {r.title}
                      </p>
                      <p className="truncate font-body text-[10px] uppercase tracking-[0.2em] text-cream/40">
                        {RELEASE_TYPE_LABELS[r.type]}
                        {r.releaseDate && <> · {formatReleaseDate(r.releaseDate, "year")}</>}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          </Reveal>
        )}
      </div>
    </div>
  );
}
