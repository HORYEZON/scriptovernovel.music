// lib/map-tile-styles.ts
//
// Free XYZ tile sources shared by every Leaflet map in the Timeline/Events
// feature — the public map (components/map/*, used by
// components/public/EventsMapLeaflet.tsx) and the admin location picker
// (app/(admin)/admin/events/EventLocationPickerLeaflet.tsx). No API key or
// billing account for any of them. "Retro" (Esri Light Gray Canvas),
// "Night Drive" (Esri Dark Gray Canvas) and "Satellite" (Esri World
// Imagery) are the closest free equivalents to an open-world-game map skin
// — there's no actual licensed GTA-style tileset available for free.
// (CARTO Voyager / Dark Matter used to fill the Retro / Night Drive slots
// but CARTO now watermarks every request that has no API key.)
// Object key order = dropdown order (MapStyleSwitcher.tsx just does
// Object.keys(TILE_STYLES)) — `retro` listed first makes it both the
// default style (DEFAULT_TILE_STYLE below) and the top of the list.
// `maxNativeZoom`: Esri's Gray Canvas layers only render up to z16 (past
// that they serve a "Map data not yet available" placeholder), so cap the
// fetch there and let Leaflet upscale the z16 tiles for z17–18.
export const TILE_STYLES = {
  retro: {
    label: "Retro",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors",
    maxNativeZoom: 16,
  },
  streets: {
    label: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  night: {
    label: "Night Drive",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, HERE, &copy; OpenStreetMap contributors",
    maxNativeZoom: 16,
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxNativeZoom: 18,
  },
} as const;

export type TileStyleKey = keyof typeof TILE_STYLES;

export const DEFAULT_TILE_STYLE: TileStyleKey = "retro";

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 18;
