"use client";

// app/(public)/music/MusicClient.tsx
//
// The release list with a type filter (All · Singles · EPs · Albums …).
// Each release is a ReleaseCard: cover beside the details, the chosen
// player, the tracklist with fold-out lyrics, "Listen on" pills for every
// other platform. Anchored by slug so /music#slug lands on a release.
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/public/system/Reveal";
import { ReleaseCard, type ReleaseCardData } from "@/components/public/ReleaseCard";
import { RELEASE_TYPES, RELEASE_TYPE_LABELS, type ReleaseType } from "@/lib/releases";

export function MusicClient({ releases }: { releases: ReleaseCardData[] }) {
  const [type, setType] = useState<ReleaseType | "ALL">("ALL");
  const present = useMemo(() => new Set(releases.map((r) => r.type)), [releases]);
  const shown = useMemo(() => (type === "ALL" ? releases : releases.filter((r) => r.type === type)), [releases, type]);

  if (releases.length === 0) {
    return (
      <div className="section-padding mt-16">
        <p className="font-body text-sm text-cream/60">Nothing released yet — soon.</p>
      </div>
    );
  }

  return (
    <div className="section-padding mt-12 md:mt-16">
      {present.size > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {(["ALL", ...RELEASE_TYPES.filter((t) => present.has(t))] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "rounded-full border px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.2em] transition-colors",
                type === t ? "border-cream/70 bg-cream/10 text-cream" : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream"
              )}
            >
              {t === "ALL" ? "All" : RELEASE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-12 md:space-y-16">
        {shown.map((r, i) => (
          <Reveal key={r.id} delayMs={Math.min(i, 3) * 80}>
            <ReleaseCard release={r} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
