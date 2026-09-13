// lib/stories-server.ts
//
// Server-only helpers for Story pages. Kept out of lib/stories.ts on purpose:
// that module is imported by client components (labels, type list), and
// pulling prisma in there would drag the server client into the browser
// bundle.
import { prisma } from "@/lib/prisma";

/**
 * Re-normalize a story's pages to a contiguous 1..n run.
 *
 * Every add / reorder / delete funnels through here rather than trying to
 * patch individual numbers, so a page can never end up duplicated or leave a
 * gap behind — the reader UI (and "page 3 of 12") assumes contiguity.
 * Ordered by the current pageNumber, then createdAt as the tie-break for rows
 * that were just appended with the same number.
 */
export async function renumberStoryPages(storyId: string) {
  const pages = await prisma.storyPage.findMany({
    where: { storyId },
    orderBy: [{ pageNumber: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await prisma.$transaction(
    pages.map((page, i) =>
      prisma.storyPage.update({ where: { id: page.id }, data: { pageNumber: i + 1 } })
    )
  );
}

/** A story with its pages in reading order — the shape every route returns. */
export const storyInclude = {
  pages: { orderBy: { pageNumber: "asc" } },
  _count: { select: { pages: true } },
} as const;
