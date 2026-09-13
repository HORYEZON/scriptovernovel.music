// lib/museum/stitchedMap.ts
//
// Stitches a small grid of XYZ slippy-map tiles into one offscreen canvas
// so it can be used as a THREE texture — the "Timeline & Gigs" wall block
// in the About ScriptOverNovel room shows a static street map with the gig pins on
// it (AboutRoomContents.tsx's GigsBoard).
//
// A live Leaflet map can't render into a WebGL texture, so we fetch the
// ~12–20 tiles that cover the framed area once (only while the visitor is
// near the room — see `shouldLoad`), draw them to a canvas, and hand back a
// CanvasTexture plus a `project()` that maps a lon/lat to a UV on that
// texture (for placing pins). This is ordinary Leaflet-equivalent tile
// usage — one map's worth of tiles per visit — well within the OSM tile
// usage policy. Any tile that fails to load (or taints the canvas) is
// skipped; the caller falls back to a plain panel if nothing loaded.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { TILE_STYLES, type TileStyleKey } from "@/lib/map-tile-styles";

const TILE = 256;

/** Fractional tile-x for a longitude at zoom z (Web Mercator). */
function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
/** Fractional tile-y for a latitude at zoom z (Web Mercator). */
function latToTileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z);
}

function loadTile(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export interface StitchedMap {
  texture: THREE.CanvasTexture | null;
  /** true once at least one tile has drawn. */
  ready: boolean;
  /** true when every tile failed / the canvas tainted — caller shows a plain panel. */
  failed: boolean;
  /** lon/lat → [u, v] on the texture (three.js UV, origin bottom-left), or
   *  null when the point falls outside the stitched area. */
  project: (lon: number, lat: number) => [number, number] | null;
}

export function useStitchedMapTexture({
  centerLon,
  centerLat,
  zoom,
  width = 1024,
  height = 768,
  style = "streets",
  shouldLoad = true,
}: {
  centerLon: number;
  centerLat: number;
  zoom: number;
  width?: number;
  height?: number;
  style?: TileStyleKey;
  shouldLoad?: boolean;
}): StitchedMap {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // World-pixel of the canvas's top-left corner — everything project()
  // needs, recomputed only when the framing changes.
  const frame = useMemo(() => {
    const scale = Math.pow(2, zoom);
    const cwx = lonToTileX(centerLon, zoom) * TILE;
    const cwy = latToTileY(centerLat, zoom) * TILE;
    return { wx0: cwx - width / 2, wy0: cwy - height / 2, worldSize: scale * TILE };
  }, [centerLon, centerLat, zoom, width, height]);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;

    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setFailed(true); return; }
    ctx.fillStyle = "#e9e5dc";
    ctx.fillRect(0, 0, width, height);

    const scale = Math.pow(2, zoom);
    const tpl = TILE_STYLES[style].url.replace("{s}", "a");
    const { wx0, wy0 } = frame;
    const txMin = Math.floor(wx0 / TILE);
    const txMax = Math.floor((wx0 + width) / TILE);
    const tyMin = Math.floor(wy0 / TILE);
    const tyMax = Math.floor((wy0 + height) / TILE);

    const jobs: Promise<boolean>[] = [];
    for (let ty = tyMin; ty <= tyMax; ty++) {
      if (ty < 0 || ty >= scale) continue;
      for (let tx = txMin; tx <= txMax; tx++) {
        const wrappedX = ((tx % scale) + scale) % scale;
        const url = tpl
          .replace("{z}", String(zoom))
          .replace("{x}", String(wrappedX))
          .replace("{y}", String(ty));
        jobs.push(
          loadTile(url).then((img) => {
            if (cancelled || !img) return false;
            try {
              ctx.drawImage(img, Math.round(tx * TILE - wx0), Math.round(ty * TILE - wy0));
              return true;
            } catch {
              return false;
            }
          })
        );
      }
    }

    Promise.all(jobs).then((results) => {
      if (cancelled) return;
      const anyDrawn = results.some(Boolean);
      if (!anyDrawn) { setFailed(true); return; }
      try {
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setTexture(tex);
        setReady(true);
      } catch {
        setFailed(true);
      }
    });

    return () => { cancelled = true; };
  }, [shouldLoad, width, height, zoom, style, frame]);

  useEffect(() => () => { texture?.dispose(); }, [texture]);

  const project = useMemo(() => {
    const { wx0, wy0 } = frame;
    return (lon: number, lat: number): [number, number] | null => {
      const px = lonToTileX(lon, zoom) * TILE - wx0;
      const py = latToTileY(lat, zoom) * TILE - wy0;
      const u = px / width;
      const v = 1 - py / height;
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      return [u, v];
    };
  }, [frame, zoom, width, height]);

  return { texture, ready, failed, project };
}
