// app/(public)/artwork/[slug]/page.tsx
//
// The dedicated, indexable, shareable page for a single artwork — the
// counterpart to ArtworkDetailModal.tsx's quick-browse overlay. Nothing
// else in the app links here yet by default; it exists so a Share action
// (or a search engine) has a real URL to point at.
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { ArtworkPageClient } from "./ArtworkPageClient";

export const dynamic = "force-dynamic";

async function getArtwork(slug: string) {
  return prisma.artwork.findFirst({
    where: { slug, published: true, deletedAt: null },
    include: { product: true, section: { select: { id: true, name: true, slug: true } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artwork = await getArtwork(slug);
  if (!artwork) return { title: "Artwork Not Found — ScriptOverNovel" };

  const description = artwork.description.slice(0, 160);
  const url = `${SITE_URL}/artwork/${artwork.slug}`;

  return {
    title: artwork.title,
    description,
    openGraph: {
      title: `${artwork.title} — ScriptOverNovel`,
      description,
      url,
      type: "article",
      images: [{ url: artwork.imageUrl }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${artwork.title} — ScriptOverNovel`,
      description,
      images: [artwork.imageUrl],
    },
    alternates: { canonical: url },
  };
}

export default async function ArtworkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artwork = await getArtwork(slug);
  if (!artwork) notFound();

  const url = `${SITE_URL}/artwork/${artwork.slug}`;

  return (
    <div className="pt-24 pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: artwork.title,
          description: artwork.description,
          image: [artwork.imageUrl, ...artwork.imageUrls],
          url,
          ...(artwork.product && {
            offers: {
              "@type": "Offer",
              url,
              priceCurrency: "PHP",
              price: artwork.product.price,
              availability:
                artwork.status === "SOLD"
                  ? "https://schema.org/SoldOut"
                  : "https://schema.org/InStock",
            },
          }),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Gallery", item: SITE_URL },
            ...(artwork.section
              ? [
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: artwork.section.name,
                    item: `${SITE_URL}/#${artwork.section.slug}`,
                  },
                ]
              : []),
            {
              "@type": "ListItem",
              position: artwork.section ? 3 : 2,
              name: artwork.title,
              item: url,
            },
          ],
        }}
      />
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-6 sm:p-8 md:p-14">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 mb-8 font-body text-xs text-white/40 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">
              Gallery
            </Link>
            {artwork.section && (
              <>
                <ChevronRight size={12} />
                <span>{artwork.section.name}</span>
              </>
            )}
            <ChevronRight size={12} />
            <span className="text-white/70 truncate max-w-[200px]">{artwork.title}</span>
          </div>

          <ArtworkPageClient artwork={artwork} siteUrl={SITE_URL} />
        </div>
      </div>
    </div>
  );
}
