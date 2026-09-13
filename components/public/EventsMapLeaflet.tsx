// components/public/EventsMapLeaflet.tsx
"use client";

// The actual Leaflet map for EventsMap.tsx, split into its own file so it
// can be loaded as ONE dynamic(..., { ssr: false }) component instead of
// dynamic-importing MapContainer/TileLayer/Marker separately. Leaflet
// components are tightly coupled through React context (TileLayer/Marker
// both call useMap() to reach the MapContainer that's supposed to be their
// parent) — wrapping each one in its own separate dynamic() chunk let them
// mount across different async boundaries instead of together as one
// controlled tree, which is what was letting the map's internal Leaflet
// panes (position: absolute, no reliable containing block yet) escape this
// component's `overflow-hidden` wrapper and render full-bleed over the
// rest of the page instead of staying inside its rounded card. A single
// client-only module doing plain (non-dynamic) imports of react-leaflet —
// safe here since this whole file only ever runs after the dynamic()
// import at the call site resolves, i.e. client-side only — avoids that
// entirely. Same fix applied to the admin location picker
// (app/(admin)/admin/events/EventLocationPickerLeaflet.tsx), which also
// shares this file's zoom slider / style switcher (components/map/*).
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapStyleSwitcher } from "@/components/map/MapStyleSwitcher";
import { MapControlsBar } from "@/components/map/MapControlsBar";
import { TILE_STYLES, MIN_ZOOM, MAX_ZOOM, type TileStyleKey } from "@/lib/map-tile-styles";
import type { PublicEvent } from "./EventsMap";

// The map's box resizes (see EventsMap.tsx's isFullscreen state, applied
// to an ancestor outside this component) whenever fullscreen is toggled —
// Leaflet needs invalidateSize() once that CSS transition/layout settles,
// or its tiles stay laid out for the old size. Has to live inside
// <MapContainer> to reach it via useMap().
function InvalidateSizeOnChange({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [trigger, map]);
  return null;
}

// Built once per icon kind, not per marker — the icon HTML only depends on
// isNext, so every "regular" pin on the map shares one instance.
function makePinIcon(isNext: boolean) {
  const color = isNext ? "#FFE135" : "#C0392B";
  const glow = isNext
    ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:0.5;filter:blur(2px);" class="motion-safe:animate-ping motion-reduce:hidden"></span>`
    : "";
  return L.divIcon({
    className: "scriptovernovel-event-pin",
    html: `
      <div style="position:relative;width:34px;height:34px;transform:translateY(-6px);">
        ${glow}
        <svg viewBox="0 0 24 24" width="34" height="34" style="position:relative;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5));${isNext ? "animation:scriptovernovel-pin-pulse 1.6s ease-in-out infinite;" : ""}">
          <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="${color}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
          <circle cx="12" cy="10" r="3" fill="rgba(0,0,0,0.35)"/>
        </svg>
      </div>
      <style>@keyframes scriptovernovel-pin-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}</style>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
}

export default function EventsMapLeaflet({
  events,
  center,
  zoom,
  onSelect,
  isFullscreen,
  onToggleFullscreen,
}: {
  events: PublicEvent[];
  center: [number, number];
  zoom: number;
  onSelect: (event: PublicEvent) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  // "Streets" rather than lib/map-tile-styles.ts's shared DEFAULT_TILE_STYLE
  // ("Retro") — a visitor opening the About page's Timeline & Gigs map to
  // find where a show actually is wants real street names, not a game-skin
  // canvas. The admin's own location picker (EventLocationPickerLeaflet.tsx)
  // keeps the shared default; this override is this map only.
  const [style, setStyle] = useState<TileStyleKey>("streets");
  const tile = TILE_STYLES[style];

  // Most-recently-added pin — "latest added" per the admin's own record
  // (createdAt), not the soonest-upcoming eventDate. Null when there are
  // no events at all, which just hides the locate button.
  const latestPosition = useMemo((): [number, number] | null => {
    if (events.length === 0) return null;
    const latest = events.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    return [latest.latitude, latest.longitude];
  }, [events]);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom={false}
      zoomControl={false}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer key={style} attribution={tile.attribution} url={tile.url} maxNativeZoom={tile.maxNativeZoom} />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={makePinIcon(event.isNextEvent)}
          eventHandlers={{ click: () => onSelect(event) }}
        />
      ))}
      <InvalidateSizeOnChange trigger={isFullscreen} />
      <MapStyleSwitcher style={style} onChange={setStyle} />
      <MapControlsBar
        latestPosition={latestPosition}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />
    </MapContainer>
  );
}
