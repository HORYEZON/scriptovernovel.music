// app/(public)/page.tsx
//
// The band's homepage: a release-led hero, then one section per thing the
// band has going — the latest release, upcoming shows, videos, merch, the
// fan wall, the Digital Museum with the arcade beside
// it. Every section is a server component that renders nothing when it
// has no data (see components/public/home/*), so the page is only ever as
// long as the band's news; a fresh install shows the hero and whatever
// the museum has.
//
// The gallery grid that used to live here (sections of artworks, the
// Curator's Picks shelf) is gone from the public site; that content is the
// Digital Museum's now.
import { Suspense } from "react";
import { getSocialLinks } from "@/lib/public-data";
import { JsonLd } from "@/components/public/JsonLd";
import { SITE_URL } from "@/lib/site-url";
import { ReleaseHero } from "@/components/public/home/ReleaseHero";
import { LatestRelease } from "@/components/public/home/LatestRelease";
import { UpcomingShows } from "@/components/public/home/UpcomingShows";
import { VideosStrip } from "@/components/public/home/VideosStrip";
import { MerchStrip } from "@/components/public/home/MerchStrip";
import { FanWallTeaser } from "@/components/public/home/FanWallTeaser";
import { MuseumBlock } from "@/components/public/home/MuseumBlock";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Home",
  description:
    "ScriptOverNovel — shoegaze, dreampop, math rock and post-rock from Valenzuela City. Music, videos, shows and merch.",
};

export default async function HomePage() {
  const socialLinks = await getSocialLinks().catch(() => []);

  return (
    <div className="pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "MusicGroup",
          name: "ScriptOverNovel",
          url: SITE_URL,
          genre: ["Shoegaze", "Dream pop", "Math rock", "Post-rock"],
          foundingLocation: { "@type": "Place", name: "Valenzuela City, Philippines" },
          sameAs: socialLinks.map((s) => s.url),
        }}
      />

      <ReleaseHero />

      {/* Sections stream in independently — a slow query in one never holds
          the hero back, and each hides itself when it has nothing. */}
      <div className="mt-16 space-y-16 md:mt-24 md:space-y-24">
        <Suspense>
          <LatestRelease />
        </Suspense>
        <Suspense>
          <UpcomingShows />
        </Suspense>
        <Suspense>
          <VideosStrip />
        </Suspense>
        <Suspense>
          <MerchStrip />
        </Suspense>
        <Suspense>
          <FanWallTeaser />
        </Suspense>
        <Suspense>
          <MuseumBlock />
        </Suspense>
      </div>
    </div>
  );
}
