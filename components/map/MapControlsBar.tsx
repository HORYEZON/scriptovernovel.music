// components/map/MapControlsBar.tsx
"use client";

// One unified bottom control bar for the public Timeline map — zoom
// out/slider/in, then a divider, then jump-to-latest-pin and fullscreen —
// all sharing a single row instead of two separate floating groups. Two
// groups only fit side by side on a wide map; on a narrow phone-width map
// they had nowhere to go but overlap. A single bar that the zoom slider's
// <input> shrinks inside of (flex-1 min-w-0) scales down cleanly instead.
//
// Deliberately a self-contained component rather than reusing
// MapZoomSlider (which renders its own separate pill, still used as-is by
// the admin location picker's simpler single-map-pin case, with no
// locate/fullscreen buttons competing for the same row) — merging them
// would mean threading a "bare, no wrapper" mode through a component this
// small isn't worth the indirection.
//
// Fullscreen here is a CSS-driven "pseudo-fullscreen" (isFullscreen/
// onToggleFullscreen are owned by EventsMap.tsx, which actually resizes
// the map's DOM box to fixed inset-0) rather than the browser's native
// Fullscreen API — the native API shows its own "Press Esc / swipe down
// to exit full screen" browser chrome that can't be styled or
// suppressed, and support is inconsistent on mobile (iOS Safari doesn't
// support requestFullscreen() on arbitrary elements at all, only
// <video>). This works identically everywhere and the Minimize icon
// below is the only exit affordance — no browser prompt.
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { ZoomIn, ZoomOut, MapPinned, Maximize, Minimize } from "lucide-react";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/map-tile-styles";

export function MapControlsBar({
  latestPosition,
  isFullscreen,
  onToggleFullscreen,
}: {
  latestPosition: [number, number] | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [map]);

  return (
    <div className="absolute left-3 right-3 bottom-3 z-[500] flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full pl-2 pr-2 py-2 border border-white/10">
      <button
        type="button"
        onClick={() => map.setZoom(Math.max(MIN_ZOOM, zoom - 1))}
        className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        aria-label="Zoom out"
      >
        <ZoomOut size={14} />
      </button>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={1}
        value={zoom}
        onChange={(e) => map.setZoom(Number(e.target.value))}
        className="flex-1 min-w-0 accent-[#5BC8F5] cursor-pointer"
        aria-label="Zoom level"
      />
      <button
        type="button"
        onClick={() => map.setZoom(Math.min(MAX_ZOOM, zoom + 1))}
        className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        aria-label="Zoom in"
      >
        <ZoomIn size={14} />
      </button>

      <div className="w-px h-5 bg-white/15 shrink-0 mx-0.5" aria-hidden="true" />

      {latestPosition && (
        <button
          type="button"
          onClick={() => map.flyTo(latestPosition, Math.max(map.getZoom(), 13))}
          className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Jump to latest added event"
          aria-label="Jump to latest added event"
        >
          <MapPinned size={15} />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        title={isFullscreen ? "Exit full screen" : "Full screen"}
        aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
      >
        {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
      </button>
    </div>
  );
}
