"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { MutableRefObject } from "react";
import toast from "@/lib/toast";

// How large the logo watermark renders, as a fraction of the captured
// canvas's shorter dimension — "big" per request, roughly a quarter of the
// screenshot's height/width so it reads as an intentional brand mark
// rather than a subtle corner logo. Clamped between a floor (tiny mobile
// captures) and a ceiling (huge desktop captures) so it never looks absurd
// at either extreme.
const LOGO_SIZE_RATIO = 0.26;
const LOGO_MIN_SIZE = 96;
const LOGO_MAX_SIZE = 420;
const LOGO_MARGIN_RATIO = 0.035;
const LOGO_MARGIN_MIN = 16;
const LOGO_OPACITY = 0.92;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same crossOrigin as loadDownscaledTexture.ts — Supabase Storage
    // already serves CORS headers permissive enough for that (the exact
    // same logoImage URL is already loaded as a WebGL texture in
    // AboutRoomContents.tsx), so this should never actually fail here.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load logo image"));
    img.src = url;
  });
}

/** Hand the finished PNG to the browser. Extracted so the filtered-but-
 *  unbranded path can finish early without duplicating it. */
function download(dataUrl: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `scriptovernovel-digital-museum-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Bridges "take a screenshot" out of the R3F tree — gl.domElement (the
 * canvas) is only reachable via useThree(), inside <Canvas>, but the
 * trigger ([R], or a HUD button) lives in plain DOM outside it, in
 * MuseumClient.tsx. Same ref-bridge idea as moveRef/lookRef
 * (TouchControls.tsx <-> PlayerControls.tsx), just carrying a callback
 * instead of a value — MuseumClient.tsx owns `captureRef`, this assigns
 * the real capture function into it once mounted, and both the [R]
 * keydown handler (MuseumScene.tsx) and the HUD button (MuseumClient.tsx)
 * just call `captureRef.current?.()`.
 *
 * `gl.domElement.toDataURL()` only ever returns *this canvas's own drawn
 * pixels* — the HUD, "Click to look around" card, etc. are a completely
 * separate DOM compositing layer, never part of the canvas's pixel buffer
 * to begin with. So a capture here is naturally clean without needing to
 * hide anything first — unlike an OS-level screenshot (Cmd+Shift+4 /
 * Win+Shift+S), which flattens the whole page including that DOM, and
 * which is exactly the tool that used to catch the pointer-lock legend
 * mid-frame (see MuseumClient.tsx's hudHidden docstring).
 */
export function ScreenshotCapture({
  captureRef,
  logoUrl,
  isCoarsePointer,
  filterCss,
}: {
  captureRef: MutableRefObject<(() => void) | null>;
  /** Profile.logoImage (same source as Navbar.tsx's wordmark) — stamped as
   * a watermark onto every screenshot when set; skipped entirely when not
   * (an unbranded site just gets a plain capture, same as before this
   * feature existed). */
  logoUrl?: string | null;
  /** Watermark position — bottom-center on mobile, bottom-right on desktop
   * — same signal MuseumClient.tsx already uses to switch the Camera
   * button between its HUD placements. */
  isCoarsePointer?: boolean;
  /**
   * The Filter Vision look currently on screen, as a CSS `filter` value, or
   * null for none (see lib/museum/visionFilters.ts).
   *
   * This has to be re-applied here, and it is the one real cost of applying
   * the filter in CSS rather than in a postprocessing pass: the filter lives
   * on a DOM wrapper *outside* the canvas, so `gl.domElement`'s pixels are
   * always the unfiltered scene. Without this a visitor walking a night-
   * vision museum would press [R] and get an ordinary daylight photo — a
   * mismatch nobody would think to look for.
   *
   * A 2D context's `.filter` takes the identical syntax, which is why the
   * whole filter vocabulary is expressed as filter functions and never as an
   * overlay: an overlay could not have been reproduced here at all.
   */
  filterCss?: string | null;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    captureRef.current = () => {
      (async () => {
        try {
          const source = gl.domElement;
          // Draw the scene again right now, immediately before reading the
          // pixels back. WebGL is free to discard a canvas's drawing buffer
          // as soon as it has been composited, so by the time a click handler
          // runs, the last frame's pixels may be gone — which is what
          // preserveDrawingBuffer prevents, at the cost of blocking driver
          // optimisations and burning bandwidth on every single frame for the
          // sake of this one button. Rendering on demand gets the same result
          // without that standing cost, so MuseumScene.tsx can now turn
          // preserveDrawingBuffer off for old phones. Harmless where it's
          // still on: one extra frame, drawn only when a capture is asked for.
          //
          // Must stay synchronous with the reads below — an `await` between
          // this and toDataURL/drawImage would let the browser composite and
          // discard in between, putting the original bug back. (The logo
          // fetch further down is fine: the canvas is already copied into
          // `composite` before that await.)
          gl.render(scene, camera);
          let dataUrl: string;

          // A filter forces the composite path even with no logo — the plain
          // `source.toDataURL()` shortcut can only ever return the canvas's
          // own unfiltered pixels.
          if (logoUrl || filterCss) {
            // Composite onto a throwaway plain 2D canvas rather than
            // drawing the watermark straight onto the WebGL canvas itself
            // — touching gl.domElement's own buffer would either bake the
            // logo into the *live* scene for a frame, or get wiped by the
            // next render pass before the download even starts. A separate
            // canvas never touches the museum the visitor is still walking
            // around in.
            const composite = document.createElement("canvas");
            composite.width = source.width;
            composite.height = source.height;
            const ctx = composite.getContext("2d");
            if (!ctx) throw new Error("2D context unavailable");

            // Set before the scene is drawn and cleared straight after, so
            // the filter applies to the museum and *not* to the watermark
            // below it — a logo run through Night Vision would be unreadable,
            // and the watermark is branding, not part of the picture.
            if (filterCss) ctx.filter = filterCss;
            ctx.drawImage(source, 0, 0);
            ctx.filter = "none";

            if (!logoUrl) {
              dataUrl = composite.toDataURL("image/png");
              download(dataUrl);
              return;
            }

            const logo = await loadImage(logoUrl);
            const shortSide = Math.min(composite.width, composite.height);
            const logoWidth = Math.min(LOGO_MAX_SIZE, Math.max(LOGO_MIN_SIZE, shortSide * LOGO_SIZE_RATIO));
            const logoHeight = logoWidth * (logo.naturalHeight / logo.naturalWidth);
            const margin = Math.max(LOGO_MARGIN_MIN, shortSide * LOGO_MARGIN_RATIO);

            // Desktop: bottom-right. Mobile (isCoarsePointer): bottom-center.
            const x = isCoarsePointer
              ? (composite.width - logoWidth) / 2
              : composite.width - logoWidth - margin;
            const y = composite.height - logoHeight - margin;

            ctx.globalAlpha = LOGO_OPACITY;
            ctx.drawImage(logo, x, y, logoWidth, logoHeight);
            ctx.globalAlpha = 1;

            dataUrl = composite.toDataURL("image/png");
          } else {
            dataUrl = source.toDataURL("image/png");
          }

          download(dataUrl);
        } catch {
          // Most likely a tainted-canvas SecurityError (a texture — or the
          // logo — loaded without CORS clearance), or a logo URL that
          // failed to load. Either way toDataURL/loadImage fail loud
          // rather than silently, and there's no dangling state to clean
          // up — just tell the visitor it didn't work.
          toast.error("Couldn't save the screenshot — try again");
        }
      })();
    };
    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, captureRef, logoUrl, isCoarsePointer, filterCss]);

  return null;
}
