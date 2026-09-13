// lib/public-data.ts
//
// Shared per-request data-fetchers for the (public) route group. Several
// Server Components independently need the same rows in the same request —
// e.g. PublicLayout and every page under it each want `Profile` — and plain
// Prisma calls don't get Next's automatic fetch-request memoization the way
// `fetch()` does. Wrapping them in React's `cache()` makes repeat calls
// within one render pass resolve to the same in-flight promise instead of
// re-querying the DB, which is what was causing e.g. `Profile` to be fetched
// 3x (layout + page + a nested page) on a single page load.
//
// Callers keep their own `.catch()` (or lack of one) around these calls —
// this file doesn't swallow errors itself, so existing per-page fallback
// behavior is unchanged.
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const getProfile = cache(() => prisma.profile.findFirst());

export const getSocialLinks = cache(() =>
  prisma.socialLink.findMany({ orderBy: { sortOrder: "asc" } })
);
