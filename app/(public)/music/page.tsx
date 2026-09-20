// app/(public)/music/page.tsx
//
// The Music page: every published release, newest first, each with its
// cover, the platform player the admin chose, the tracklist (lyrics fold
// out under a track) and "Listen on" links for the rest. The lead release
// (featured, else newest) is the page's hazy backdrop.
import type { Metadata } from "next";
import { getLeadRelease, getPublicReleases } from "@/lib/releases-server";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { MusicClient } from "./MusicClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Music",
  description: "Every ScriptOverNovel release — singles, EPs and albums — with where to stream them.",
};

export default async function MusicPage() {
  const [releases, lead] = await Promise.all([getPublicReleases().catch(() => []), getLeadRelease().catch(() => null)]);

  return (
    <div className="pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: releases.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "MusicAlbum",
              name: r.title,
              url: `${SITE_URL}/music#${r.slug ?? r.id}`,
              image: r.coverImageUrl,
              ...(r.releaseDate && { datePublished: r.releaseDate.toISOString().slice(0, 10) }),
              byArtist: { "@type": "MusicGroup", name: "ScriptOverNovel" },
              numTracks: r.tracks.length,
            },
          })),
        }}
      />
      <PageHero
        image={lead?.coverImageUrl ?? null}
        blur="lg"
        eyebrow="Discography"
        title="Music"
        subtitle={lead ? `Latest: ${lead.title}` : "Singles, EPs and albums — and where to hear them."}
      />
      <MusicClient releases={JSON.parse(JSON.stringify(releases))} />
    </div>
  );
}
