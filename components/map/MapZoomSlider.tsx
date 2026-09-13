// components/map/MapZoomSlider.tsx
"use client";

// Replaces Leaflet's default +/- button pair (render the parent
// <MapContainer zoomControl={false}> to remove those) with a drag-to-zoom
// slider — still has +/- buttons at each end for a single click, but
// dragging is the primary way to zoom instead of repeated clicking. Has to
// live inside <MapContainer> to reach it via useMap(). Shared by the
// public Timeline map (components/public/EventsMapLeaflet.tsx) and the
// admin location picker (app/(admin)/admin/events/EventLocationPickerLeaflet.tsx).
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { ZoomIn, ZoomOut } from "lucide-react";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/map-tile-styles";

export function MapZoomSlider() {
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
    <div className="absolute left-3 bottom-3 z-[500] flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-full pl-2 pr-3 py-2 border border-white/10">
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
        className="w-24 sm:w-32 accent-[#5BC8F5] cursor-pointer"
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
    </div>
  );
}
