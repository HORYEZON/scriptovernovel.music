// app/(public)/shop/page.tsx
import { prisma } from "@/lib/prisma";
import { ShopClient } from "./ShopClient";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { sanitizeHoverShimmer } from "@/lib/hover-shimmer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description: "Acquire original artworks and limited prints from ScriptOverNovel.",
};

async function getProducts() {
  return prisma.product.findMany({
    where: {
      available: true,
      deletedAt: null,
      artwork: { deletedAt: null },
    },
    include: {
      artwork: true,
      variants: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export default async function ShopPage() {
  // The hover shimmer's settings ride on Profile (Settings → Preferences →
  // Branding → Hover Shimmer); one narrow select alongside the products so
  // the card sweep is configured server-side, like the Gallery's carousel.
  const [products, profile] = await Promise.all([
    getProducts(),
    prisma.profile.findFirst({ select: { hoverShimmer: true } }).catch(() => null),
  ]);
  const shimmer = sanitizeHoverShimmer(profile?.hoverShimmer).shop;

  return (
    <div className="pt-24 pb-24">
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Acquire
            </p>
            <AnimatedHeading text="Shop" />
            <p className="font-body text-sm text-white/60 max-w-lg mt-4 leading-relaxed">
              Each work is a singular original. Once sold, it is gone — securing a
              piece means securing a moment in time.
            </p>
            <div className="deco-line mt-6" />
          </div>

          <ShopClient products={products} shimmer={shimmer} />
        </div>
      </div>
    </div>
  );
}
