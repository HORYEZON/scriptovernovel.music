// app/(admin)/admin/artworks/ArtworksTabs.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImagePlus, FolderOpen } from "lucide-react";
import { ArtworksClient } from "./ArtworksClient";
import { SectionsClient } from "../sections/SectionsClient";

type PageTab = "artworks" | "sections";

// Matches the props shape that page.tsx fetches. ArtworksClient handles
// artwork CRUD; SectionsClient handles the gallery sections that used to
// live at the standalone /admin/sections route.
export function ArtworksTabs({
  initialArtworks,
  sections = [],
  sectionRecords = [],
}: {
  initialArtworks: Parameters<typeof ArtworksClient>[0]["initialArtworks"];
  /** id/name list for the artwork form's "assign to section" dropdown. */
  sections?: Parameters<typeof ArtworksClient>[0]["sections"];
  /** Full Section rows for the Sections tab. */
  sectionRecords?: Parameters<typeof SectionsClient>[0]["initialSections"];
}) {
  const [tab, setTab] = useState<PageTab>("artworks");
  const searchParams = useSearchParams();

  // Keep the visible tab in sync with ?tab= so links (GlobalSearch, the old
  // /admin/sections redirect) land on — and switch back to — the right tab.
  useEffect(() => {
    setTab(searchParams.get("tab") === "sections" ? "sections" : "artworks");
  }, [searchParams]);

  const TABS = [
    { id: "artworks" as const, label: "Artworks", icon: ImagePlus },
    { id: "sections" as const, label: "Sections", icon: FolderOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Page Tabs — scrollable on mobile so they never overflow */}
      <div
        role="tablist"
        aria-label="Artworks view"
        className="flex gap-1 p-1 rounded-2xl admin-input border overflow-x-auto no-scrollbar mb-6"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-jakarta text-sm font-medium transition-all whitespace-nowrap ${
              tab === id
                ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {tab === "sections" && <SectionsClient initialSections={sectionRecords} />}

      {tab === "artworks" && (
        <ArtworksClient initialArtworks={initialArtworks} sections={sections} />
      )}
    </div>
  );
}
