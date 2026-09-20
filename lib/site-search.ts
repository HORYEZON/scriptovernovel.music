// lib/site-search.ts
//
// Shape of one row in the header search (app/api/site-search → SearchOverlay).
export type SiteSearchKind = "release" | "video" | "merch";

export interface SiteSearchItem {
  id: string;
  kind: SiteSearchKind;
  title: string;
  subtitle: string | null;
  /** Extra words a row should match on (tags, track titles…). */
  keywords: string[];
  imageUrl: string | null;
  href: string;
}

export const SITE_SEARCH_KIND_LABELS: Record<SiteSearchKind, string> = {
  release: "Release",
  video: "Video",
  merch: "Merch",
};
