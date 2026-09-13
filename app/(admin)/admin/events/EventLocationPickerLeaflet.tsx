// app/(admin)/admin/events/EventLocationPickerLeaflet.tsx
"use client";

// The actual Leaflet map for EventsClient.tsx's LocationPicker, split into
// its own file so it can be loaded as ONE dynamic(..., { ssr: false })
// component instead of dynamic-importing MapContainer/TileLayer/Marker
// separately — see components/public/EventsMapLeaflet.tsx's header comment
// for why that split let Leaflet's internal panes escape their
// overflow-hidden wrapper and render full-bleed over the rest of the page.
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapZoomSlider } from "@/components/map/MapZoomSlider";
import { MapStyleSwitcher } from "@/components/map/MapStyleSwitcher";
import { TILE_STYLES, DEFAULT_TILE_STYLE, MIN_ZOOM, MAX_ZOOM, type TileStyleKey } from "@/lib/map-tile-styles";

// A plain <Marker> with no `icon` prop falls back to Leaflet's *default*
// marker image, which references image paths (marker-icon.png etc.)
// relative to leaflet.css — those never resolve through Next/webpack's
// bundling, so it renders as a broken-image icon. Building our own
// L.divIcon (inline SVG, no external file) sidesteps that entirely — same
// approach the public map's pin uses.
const PIN_ICON = L.divIcon({
  className: "scriptovernovel-event-pin",
  html: `<svg viewBox="0 0 24 24" width="34" height="34" style="transform:translateY(-6px);filter:drop-shadow(0 2px 3px rgba(0,0,0,0.5));">
    <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z" fill="#C0392B" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
    <circle cx="12" cy="10" r="3" fill="rgba(0,0,0,0.35)"/>
  </svg>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// MapContainer's `center`/`zoom` props only apply on first mount, not on
// re-render — Leaflet owns the view after that. Typing into the manual
// Latitude/Longitude inputs (EventsClient.tsx's LocationPicker, now
// debounced ~400ms per keystroke rather than committing immediately — see
// its useDebouncedCoordinateInput) needs this to actually pan the map and
// follow along, not just move the pin. Skips the call entirely when the
// map is already sitting on this center (e.g. a re-render for an unrelated
// reason produced an equal-but-new array) instead of resetting the view
// every time regardless.
function RecenterOnChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    if (Math.abs(current.lat - center[0]) < 1e-9 && Math.abs(current.lng - center[1]) < 1e-9) return;
    map.setView(center);
  }, [center, map]);
  return null;
}

export default function EventLocationPickerLeaflet({
  center,
  zoom,
  latitude,
  longitude,
  onChange,
}: {
  center: [number, number];
  zoom: number;
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const [style, setStyle] = useState<TileStyleKey>(DEFAULT_TILE_STYLE);
  const tile = TILE_STYLES[style];

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      zoomControl={false}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer key={style} attribution={tile.attribution} url={tile.url} maxNativeZoom={tile.maxNativeZoom} />
      <ClickHandler onClick={onChange} />
      <RecenterOnChange center={center} />
      {latitude !== null && longitude !== null && <Marker position={[latitude, longitude]} icon={PIN_ICON} />}
      <MapZoomSlider />
      <MapStyleSwitcher style={style} onChange={setStyle} />
    </MapContainer>
  );
}
