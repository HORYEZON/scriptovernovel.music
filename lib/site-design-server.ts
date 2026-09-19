// lib/site-design-server.ts
//
// Per-request loader for the Site Design singleton + its menu rows, wrapped
// in React's cache() for the same reason lib/public-data.ts wraps Profile:
// the public layout (header/menu) and the homepage (hero) both want it on
// the same render, and plain Prisma calls aren't memoized like fetch() is.
//
// Server-only (imports Prisma) — the public components take the resolved
// result as props so they stay usable in the admin's live preview too.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  resolveSiteDesign,
  resolveMenuItems,
  type SiteDesignSettings,
  type SiteMenuItem,
} from "@/lib/site-design";

export interface SiteDesignData {
  settings: SiteDesignSettings;
  menuItems: SiteMenuItem[];
}

export const getSiteDesign = cache(async (): Promise<SiteDesignData> => {
  const [record, rows] = await Promise.all([
    prisma.siteDesign.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.siteMenuItem.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
  ]);
  return {
    settings: resolveSiteDesign(record),
    menuItems: resolveMenuItems(rows),
  };
});
