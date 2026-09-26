// lib/shows-server.ts
//
// Server-only Show helpers: the one Prisma select every public reader uses,
// the upcoming/past split, and the revalidate list. Imported by /shows, the
// homepage's Upcoming shows section and the Events API routes. Not
// client-safe (imports Prisma) — mirrors lib/releases-server.ts.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isUpcomingShow, type PublicShow } from "@/lib/shows";

/** Enabled and not trashed. `enabled` is the admin's show/hide toggle;
 *  `deletedAt` is the Trash module's soft delete. */
export const PUBLIC_SHOW_WHERE: Prisma.EventWhereInput = { enabled: true, deletedAt: null };

export const SHOW_SELECT = {
  id: true,
  title: true,
  description: true,
  venueName: true,
  city: true,
  lineup: true,
  latitude: true,
  longitude: true,
  eventDate: true,
  createdAt: true,
  ticketUrl: true,
  ticketPrice: true,
  ticketNote: true,
  status: true,
  isNextEvent: true,
  media: { orderBy: { order: "asc" as const }, select: { id: true, url: true, type: true, order: true } },
} satisfies Prisma.EventSelect;

type ShowRow = Prisma.EventGetPayload<{ select: typeof SHOW_SELECT }>;

export function toPublicShow(e: ShowRow): PublicShow {
  return {
    ...e,
    eventDate: e.eventDate ? e.eventDate.toISOString() : null,
    createdAt: e.createdAt.toISOString(),
  };
}

/**
 * Every public show, soonest-first among the upcoming and newest-first among
 * the past — which is one `orderBy` away from impossible, so /shows fetches
 * them in date order and `splitShows` does the arranging. One query, because
 * the page needs the whole set for the map anyway.
 */
export async function getPublicShows(): Promise<PublicShow[]> {
  const rows = await prisma.event
    .findMany({
      where: PUBLIC_SHOW_WHERE,
      select: SHOW_SELECT,
      orderBy: [{ eventDate: { sort: "desc", nulls: "first" } }, { displayOrder: "asc" }],
    })
    .catch(() => []);
  return rows.map(toPublicShow);
}

/**
 * The next few shows, for the homepage strip. Undated ("TBA") shows count as
 * upcoming and sort last; a cancelled one is excluded — the homepage should
 * never promise a night that isn't happening. Kept as its own query so the
 * homepage doesn't read the band's whole gig history for three rows.
 */
export async function getUpcomingShows(take = 3): Promise<PublicShow[]> {
  const rows = await prisma.event
    .findMany({
      where: {
        ...PUBLIC_SHOW_WHERE,
        status: { not: "CANCELLED" },
        OR: [{ eventDate: { gte: new Date() } }, { eventDate: null }],
      },
      select: SHOW_SELECT,
      orderBy: [{ eventDate: { sort: "asc", nulls: "last" } }, { displayOrder: "asc" }],
      take,
    })
    .catch(() => []);
  return rows.map(toPublicShow);
}

/**
 * A date-ordered list → the two lists /shows renders: what's coming (soonest
 * first) and what's been (newest first). The rule for which side a show falls
 * on is `isUpcomingShow`, so the page, the homepage and the map all agree.
 */
export function splitShows(shows: PublicShow[]): { upcoming: PublicShow[]; past: PublicShow[] } {
  const upcoming: PublicShow[] = [];
  const past: PublicShow[] = [];
  for (const show of shows) {
    (isUpcomingShow(show) ? upcoming : past).push(show);
  }
  upcoming.sort((a, b) => {
    // TBA last: it is announced, not scheduled.
    if (!a.eventDate) return b.eventDate ? 1 : 0;
    if (!b.eventDate) return -1;
    return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
  });
  return { upcoming, past };
}

/** The past, bucketed by year for the archive's subheadings. Insertion order
 *  is preserved, so the input's newest-first order carries through. */
export function groupShowsByYear(shows: PublicShow[]): Map<string, PublicShow[]> {
  const byYear = new Map<string, PublicShow[]>();
  for (const show of shows) {
    const year = show.eventDate
      ? new Date(show.eventDate).toLocaleDateString("en-PH", { year: "numeric", timeZone: "Asia/Manila" })
      : "Undated";
    byYear.set(year, [...(byYear.get(year) ?? []), show]);
  }
  return byYear;
}

/** Every page a show shows on. */
export function revalidateShowPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/shows");
  revalidatePath("/about");
  revalidatePath("/admin/events");
}
