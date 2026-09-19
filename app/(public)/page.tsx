import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/public-data";
import { getSiteDesign } from "@/lib/site-design-server";
import { HomeHero } from "@/components/public/site-design/HomeHero";
import { buildPublicGames } from "@/lib/minigames/server";
import { readPlayerId } from "@/lib/minigames/player";
import { GalleryClient } from "./gallery/GalleryClient";
import { FeaturedCarousel } from "@/components/public/FeaturedCarousel";
import { SquidLetter } from "@/components/public/SquidLetter";
import { JsonLd } from "@/components/public/JsonLd";
import { SITE_URL } from "@/lib/site-url";
import { sanitizeHoverShimmer } from "@/lib/hover-shimmer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gallery",
  description: "Browse the full collection of original artworks by ScriptOverNovel.",
};

async function getPublishedSections() {
  return prisma.section.findMany({
    where: { isPublished: true, deletedAt: null },
    orderBy: { displayOrder: "asc" },
    include: {
      artworks: {
        where: { published: true, deletedAt: null },
        include: { product: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// Artworks flagged Featured by the admin, across all sections — powers the
// homepage "Curator's Picks" shelf. Only pulled from sections that are
// themselves published (or unsectioned) so the shelf never leaks a hidden
// section's work.
async function getFeaturedArtworks() {
  return prisma.artwork.findMany({
    where: {
      featured: true,
      published: true,
      deletedAt: null,
      OR: [{ sectionId: null }, { section: { isPublished: true } }],
    },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
}

// Playable mini games for the gallery's launcher. Resolved here rather than
// fetched from the browser so opening the page costs nothing extra and the
// button only renders when there is actually something to play.
async function getMiniGames() {
  const playerId = await readPlayerId();
  return buildPublicGames(playerId);
}

// Whether the "Go To Museum" button should render at all — resolved here
// (not a client fetch) for the same reason as getMiniGames above. Only
// counts artworks that would actually be visible on /gallery/museum
// (published + non-deleted), so a museum with only draft artworks staged
// still hides the button rather than linking to an empty room.
async function getMuseumStatus() {
  const [museum, count] = await Promise.all([
    prisma.digitalMuseum.findUnique({ where: { id: "singleton" }, select: { enabled: true } }),
    // V2: artworks live under enabled rooms now, not directly on the
    // museum — count across all of them so the button still hides itself
    // when every room is either disabled or empty of published artworks.
    prisma.museumRoomArtwork.count({
      where: { room: { enabled: true, deletedAt: null }, artwork: { published: true, deletedAt: null } },
    }),
  ]);
  return { enabled: museum?.enabled ?? false, count };
}

// Freedom Wall button visibility + behaviour:
//   isActive  — FreedomWallSettings.isActive (admin room-toggle);
//               false → button hidden entirely.
//   museumRoomEnabled — MuseumRoom.enabled WHERE roomType = FREEDOM_WALL;
//               false → button is a direct link to /gallery/freedom-wall
//               true  → button shows a "Page / Museum" dropdown
async function getFreedomWallStatus() {
  const [settings, room] = await Promise.all([
    prisma.freedomWallSettings
      .findUnique({ where: { id: "singleton" }, select: { isActive: true } })
      .catch(() => null),
    prisma.museumRoom
      .findFirst({ where: { roomType: "FREEDOM_WALL" }, select: { enabled: true } })
      .catch(() => null),
  ]);
  return {
    isActive: settings?.isActive ?? false,
    museumRoomEnabled: room?.enabled ?? false,
  };
}

export default async function HomePage() {
  const [sections, featuredArtworks, profile, miniGames, museumStatus, freedomWallStatus, siteDesign] = await Promise.all([
    getPublishedSections(),
    getFeaturedArtworks(),
    getProfile().catch(() => null),
    getMiniGames().catch(() => []),
    getMuseumStatus().catch(() => ({ enabled: false, count: 0 })),
    getFreedomWallStatus().catch(() => ({ isActive: false, museumRoomEnabled: false })),
    // Same memoized call the layout makes for the header — one query.
    getSiteDesign(),
  ]);

  // Filter out sections with no published artworks
  const sectionsWithArtworks = sections.filter((s) => s.artworks.length > 0);

  // The hero is the first full screen (Admin → Site Design → Homepage Hero);
  // it already clears the fixed header itself, so the collection below only
  // needs top padding when the hero is switched off.
  const showHero = siteDesign.settings.heroEnabled;

  return (
    <div className={showHero ? "pb-24" : "pt-24 pb-24"}>
      {showHero && <HomeHero settings={siteDesign.settings} />}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "ScriptOverNovel",
          url: SITE_URL,
          description:
            "A curated collection from ScriptOverNovel — House of Arts. Original paintings, prints, and mixed media available for acquisition.",
        }}
      />
      <div className={showHero ? "section-padding pt-16 md:pt-24" : "section-padding"}>
        {/* Dark glass content panel */}
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            {/* <p className="font-body text-xs font-semibold tracking-widest uppercase text-white/50 mb-3"> */}
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Collection
            </p>
            <h1 className="font-grotesk font-bold text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex">
              <span className="transition-colors duration-200 hover:text-[#FFE135]">
                G
              </span>
              <SquidLetter />
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">
                l
              </span>
              <span className="transition-colors duration-200 hover:text-[#5BC8F5]">
                l
              </span>
              <span className="transition-colors duration-200 hover:text-[#FFE135]">
                e
              </span>
              <span className="transition-colors duration-200 hover:text-[#44D700]">
                r
              </span>
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">
                y
              </span>
            </h1>
            <div className="deco-line mt-6" />
          </div>

          <FeaturedCarousel artworks={featuredArtworks} />

          <GalleryClient
            sections={sectionsWithArtworks}
            carouselMode={profile?.carouselMode}
            carouselSpeed={profile?.carouselSpeed}
            shimmer={sanitizeHoverShimmer(profile?.hoverShimmer).gallery}
            miniGames={miniGames}
            museumEnabled={museumStatus.enabled && museumStatus.count > 0}
            freedomWallActive={freedomWallStatus.isActive}
            freedomWallMuseumEnabled={freedomWallStatus.museumRoomEnabled}
          />
        </div>
      </div>
    </div>
  );
}
