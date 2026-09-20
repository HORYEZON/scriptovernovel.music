// app/api/admin/search/route.ts
//
// GET ?q=<term> — global admin search. Backs the command-palette style
// GlobalSearch modal (components/admin/GlobalSearch.tsx), which sits next to
// the notification bell in every admin page's top bar.
//
// Deliberately shallow: a handful of `contains`/insensitive matches per
// content model, capped at MAX_PER_GROUP each, run in parallel. This is a
// "jump to the right record" tool, not a full-text search engine — the admin
// still lands on the record's list page (these models have no per-item
// detail route; everything is edited via modal on the list page itself) and
// finds it themselves from there, same as clicking through the sidebar would
// have required. Soft-deleted (deletedAt) rows are always excluded, matching
// every list page's default view.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX_PER_GROUP = 5;
const MIN_QUERY_LENGTH = 2;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({
      artworks: [],
      stories: [],
      cosplays: [],
      products: [],
      orders: [],
      sections: [],
      rooms: [],
      announcements: [],
      faqs: [],
      events: [],
      releases: [],
    });
  }

  try {
    const insensitive = { contains: q, mode: "insensitive" as const };

    const [artworks, stories, cosplays, products, orders, sections, rooms, announcements, faqs, events, releases] =
      await Promise.all([
        prisma.artwork.findMany({
          where: {
            deletedAt: null,
            OR: [{ title: insensitive }, { medium: insensitive }, { tags: { has: q } }],
          },
          select: { id: true, title: true, imageUrl: true, status: true, published: true },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        // Stories (books/novels/comics/manga) — same "land on the list page"
        // rule as everything else here; they're edited via modal on
        // /admin/stories.
        prisma.story.findMany({
          where: {
            deletedAt: null,
            OR: [{ title: insensitive }, { author: insensitive }, { genre: { has: q } }],
          },
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            type: true,
            author: true,
            published: true,
          },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        // Cosplays — same "land on the list page" rule; they're edited via
        // modal on /admin/cosplays. Searched by the fields an admin actually
        // remembers a costume by, which is rarely its title.
        prisma.cosplay.findMany({
          where: {
            deletedAt: null,
            OR: [
              { title: insensitive },
              { character: insensitive },
              { series: insensitive },
              { event: insensitive },
              { cosplayer: insensitive },
            ],
          },
          select: {
            id: true,
            title: true,
            character: true,
            series: true,
            standeeImageUrl: true,
            published: true,
          },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.product.findMany({
          where: {
            deletedAt: null,
            artwork: { title: insensitive },
          },
          select: {
            id: true,
            price: true,
            available: true,
            artwork: { select: { title: true, imageUrl: true } },
          },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.order.findMany({
          where: {
            OR: [
              { customerName: insensitive },
              { customerEmail: insensitive },
              { id: insensitive },
            ],
          },
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            status: true,
            total: true,
          },
          take: MAX_PER_GROUP,
          orderBy: { createdAt: "desc" },
        }),
        prisma.section.findMany({
          where: { deletedAt: null, name: insensitive },
          select: { id: true, name: true, isPublished: true },
          take: MAX_PER_GROUP,
          orderBy: { displayOrder: "asc" },
        }),
        // Digital Museum rooms edit from the Artworks page's Digital Museum
        // tab (no per-item detail route, same as everything else here), so
        // results land on /admin/artworks?tab=museum (see GlobalSearch.tsx).
        prisma.museumRoom.findMany({
          where: { deletedAt: null, name: insensitive },
          select: { id: true, name: true, roomType: true, enabled: true },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.marqueeAnnouncement.findMany({
          where: {
            deletedAt: null,
            OR: [{ text: insensitive }, { category: insensitive }],
          },
          select: { id: true, text: true, category: true, isActive: true },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.faq.findMany({
          where: { OR: [{ question: insensitive }, { answer: insensitive }] },
          select: { id: true, question: true, isActive: true },
          take: MAX_PER_GROUP,
          orderBy: { displayOrder: "asc" },
        }),
        // Timeline/Gigs map pins — edited from /admin/events (no per-item
        // detail route, same as everything else here).
        prisma.event.findMany({
          where: {
            deletedAt: null,
            OR: [{ title: insensitive }, { venueName: insensitive }],
          },
          select: { id: true, title: true, venueName: true, enabled: true, isNextEvent: true },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
        // Releases — by title or any track title; edited from /admin/releases.
        prisma.release.findMany({
          where: {
            deletedAt: null,
            OR: [{ title: insensitive }, { tracks: { some: { title: insensitive } } }],
          },
          select: { id: true, title: true, type: true, published: true, featured: true },
          take: MAX_PER_GROUP,
          orderBy: { updatedAt: "desc" },
        }),
      ]);

    return NextResponse.json({ artworks, stories, cosplays, products, orders, sections, rooms, announcements, faqs, events, releases });
  } catch (error) {
    console.error("[admin/search] failed to search", error);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
