import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/public-data";
import { JsonLd } from "@/components/public/JsonLd";
import { SITE_URL } from "@/lib/site-url";
import { StoriesClient } from "./StoriesClient";
import { SquidLetter } from "@/components/public/SquidLetter";
import { sanitizeHoverShimmer } from "@/lib/hover-shimmer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tales",
  description:
    "Read the books, novels, comics and manga by ScriptOverNovel — page by page.",
};

async function getPublishedStories() {
  return prisma.story.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });
}

export default async function StoriesPage() {
  const [stories, profile] = await Promise.all([
    getPublishedStories(),
    // Mobile carousel behaviour for this shelf — Settings → Preferences →
    // Mobile Stories Carousel. Its own columns, separate from the homepage's.
    getProfile().catch(() => null),
  ]);

  return (
    <div className="pt-24 pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Tales",
          url: `${SITE_URL}/stories`,
          description:
            "Books, novels, comics and manga by ScriptOverNovel, readable page by page.",
          hasPart: stories.map((story) => ({
            "@type": "Book",
            name: story.title,
            author: story.author ?? "ScriptOverNovel",
            numberOfPages: story.pages.length,
            image: story.coverImageUrl,
          })),
        }}
      />
      <div className="section-padding">
        {/* Dark glass content panel — same shell as the Gallery home page */}
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            <p className="font-body text-md tracking-[0.5em] uppercase text-azure-light mb-3">
              Library
            </p>
            <h1 className="font-grotesk font-bold text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex">
              <span className="transition-colors duration-200 hover:text-[#FFE135]">T</span>
              <SquidLetter letter="A" />
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">L</span>
              <span className="transition-colors duration-200 hover:text-[#5BC8F5]">E</span>
              <span className="transition-colors duration-200 hover:text-[#FFE135]">S</span>
            </h1>
            <div className="deco-line mt-6" />
          </div>

          <StoriesClient
            stories={JSON.parse(JSON.stringify(stories))}
            carouselMode={profile?.storiesCarouselMode}
            carouselSpeed={profile?.storiesCarouselSpeed}
            shimmer={sanitizeHoverShimmer(profile?.hoverShimmer).stories}
          />
        </div>
      </div>
    </div>
  );
}
