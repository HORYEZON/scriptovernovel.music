"use client";

// GigsPanel.tsx
// The HUD overlay that opens when a visitor walks up to the About room's
// "Timeline & Gigs" wall board and presses [E]. It just hosts the existing
// public Timeline/Gigs map (components/public/EventsMap.tsx) — a self-
// contained Leaflet map with pin clicks and a per-event detail modal — in
// the same fixed-overlay shell the artwork / certificate panels use
// (z-[60], backdrop, [X] / backdrop-click / Esc to close).

import { useEffect } from "react";
import { X } from "lucide-react";
import { EventsMap, type PublicEvent } from "@/components/public/EventsMap";
import { cn } from "@/lib/utils";

export function GigsPanel({
  gigs,
  onClose,
  landscape = false,
}: {
  gigs: PublicEvent[];
  onClose: () => void;
  /** True only on a touch device in the museum's forced-landscape view
   * (MuseumClient.tsx's toggle) — shortens the map so the panel fits the
   * room it actually has. Deliberately a prop and not Tailwind's
   * `landscape:` variant, for the reason CosplayInfoPanel.tsx documents:
   * that variant is a *physical* orientation query, and forced landscape is
   * a CSS rotate on a phone the browser still considers portrait. */
  landscape?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // min(…vh, 100%) rather than a bare vh, for the reason ContactPanel
        // and MuseumMap both document: under the forced-landscape rotate this
        // overlay fills the pre-rotation box — as tall as the phone is *wide*
        // — while `vh` goes on measuring the phone's full height. A bare 90vh
        // there sized the panel to roughly twice the room it had, which is
        // why it ran off the top and bottom edges of the screen.
        className={cn(
          "w-full max-w-3xl bg-ink-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col",
          landscape ? "max-h-[min(92vh,100%)]" : "max-h-[min(90vh,100%)]"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 className="font-grotesk font-bold text-base uppercase tracking-wide text-white">
            Timeline &amp; Gigs
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {/* min-h-0 overrides the flex item default of min-height:auto, which
            would otherwise let the map push the panel past the max-h above
            instead of scrolling inside it. */}
        <div className={cn("overflow-y-auto flex-1 min-h-0", landscape ? "p-3" : "p-4 sm:p-5")}>
          <EventsMap
            events={gigs}
            // The panel is a rotated container and the modal is meant to stay
            // inside it — portalling to <body> (which is what the public
            // /about map needs, see EventModal's `portalled`) would drop it
            // flat over the museum instead.
            portalModal={false}
            // The panel is only as tall as the phone is wide in landscape;
            // the default 300px map plus the header is already more than
            // that, and `md:` would read the pre-rotation width (the phone's
            // height) as a desktop and ask for 500px.
            heightClass={landscape ? "h-[200px]" : "h-[300px] md:h-[500px]"}
          />
        </div>
      </div>
    </div>
  );
}
