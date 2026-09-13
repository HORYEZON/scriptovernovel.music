"use client";

// Bottom-left "radar" widget — a GTA-style always-on minimap of just the
// room the visitor is currently standing in (not the whole corridor; see
// MuseumMap.tsx's [M] modal for the full room list / travel picker, which
// this doesn't replace). Plots the room's own artwork frames and whichever
// active Chase Companions are physically in it, alongside the player's own
// facing dot. No stats of its own — MuseumClient.tsx stacks the existing
// top-bar HUD (AchievementHud.tsx, steps/views/time) directly underneath
// this component instead of duplicating those numbers here; this file only
// owns its own little rounded box, not the outer positioning.
//
// Always-on on desktop; on touch it's opt-in instead — the original
// "desktop only" rule was about clutter (the mobile HUD already carries a
// joystick, a look-drag zone, a jump button and the interaction prompt),
// which a *persistent* overlay really would add to, but a visitor who taps
// the stats card to ask for it has said they want it right now. So mobile
// mounts this only while StatsMinimapPanel.tsx has it expanded, at the
// smaller size that component passes in via `width`/`height`.
//
// Reads MiniMapTracker.tsx's ref via its own requestAnimationFrame loop
// rather than React state or the R3F render loop — this needs to feel
// alive at a game's frame rate, and a plain <canvas> + rAF is the cheapest
// way to get that without re-rendering the whole HUD tree every frame.
import { useEffect, useRef, type MutableRefObject } from "react";
import { DOORWAY_WIDTH } from "./roomConstants";
import type { MiniMapFrameState } from "./MiniMapTracker";
import {
  MINIMAP_HUD_DEFAULTS,
  withAlpha,
  type MinimapHudConfig,
} from "@/lib/museum/minimapHud";

// Desktop's size — mobile passes its own smaller pair (see
// StatsMinimapPanel.tsx), so these are defaults rather than fixed constants.
// Both now also default to whatever the admin set museum-wide, which is what
// MINIMAP_HUD_DEFAULTS falls back to when nothing has been configured.
const PADDING = 16;
// Every mark's colour is an admin setting now (Artworks ▸ Digital Museum ▸
// General Settings ▸ Minimap HUD), but its *opacity* is not, and that split
// is deliberate: these alphas are what make a prop dot recede behind an
// artwork dot instead of competing with it. An admin picks the hue; the
// relationship between the marks stays as designed. Defaulting the colours
// to the values that were hard-coded here means an unconfigured museum draws
// exactly the map it drew before.
const ROOM_ALPHA = 0.55;
const DOOR_ALPHA = 0.65;
const ARTWORK_ALPHA = 0.8;
// Admin-placed .glb props. Dimmer and a touch smaller than the artwork dots:
// the two would otherwise be indistinguishable, and a room full of identical
// dots says less than one where the pieces you came to see read as the
// primary marks and the decor sits behind them.
const OBJECT_ALPHA = 0.45;
// World units — approximately an arm's reach from the wall, same ballpark
// as an artwork's own [E]-interact range. Sticky notes reuse the artwork
// dot/glow treatment exactly, judged "near" by plain distance to the player
// dot rather than any [E]-interact range, since a note has no per-item
// target the way an artwork does.
const STICKY_NOTE_NEAR_DISTANCE = 3;

/**
 * The "you're on this" dot: a solid mark with a soft halo behind it, in the
 * same yellow wherever it appears. One helper rather than a copy per dot
 * type, because the whole point of the treatment is that an artwork frame in
 * a curated room, an About-room block and the Contact Desk all say the same
 * thing with it.
 */
function drawActiveDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draws one edge of the room's rectangle, leaving a centered gap of
 * `doorSpan` canvas units when that side has a doorway — used for all
 * four edges so north/south (which can have an opening) and east/west
 * (always solid, rooms never chain sideways) share one helper. */
function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  hasOpening: boolean,
  doorSpan: number,
  roomStroke: string,
  doorStroke: string
) {
  if (!hasOpening) {
    ctx.strokeStyle = roomStroke;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    return;
  }
  // Horizontal edge (north/south) — gap centered on X. Vertical edges never
  // call this with hasOpening true (rooms don't chain sideways), so this
  // assumes x1 !== x2 the same way MuseumRoom.tsx's own Wall() does.
  const midX = (x1 + x2) / 2;
  ctx.strokeStyle = roomStroke;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(midX - doorSpan / 2, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(midX + doorSpan / 2, y2);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // A short emerald tick marking the doorway itself, so it doesn't just
  // read as "the wall has a gap" but as an actual opening to walk through.
  ctx.strokeStyle = doorStroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midX - doorSpan / 2, y1);
  ctx.lineTo(midX + doorSpan / 2, y1);
  ctx.stroke();
  ctx.lineWidth = 1;
}

export function MiniMapHud({
  frameStateRef,
  config = MINIMAP_HUD_DEFAULTS,
  width,
  height,
}: {
  frameStateRef: MutableRefObject<MiniMapFrameState | null>;
  /** The admin's museum-wide look for this card. Defaults to the values the
   *  component shipped with, so a caller that hasn't threaded it through
   *  (and a museum that has never configured it) renders unchanged. */
  config?: MinimapHudConfig;
  /** CSS pixels, overriding the configured size. Mobile's tap-to-open panel
   * renders this smaller than desktop's always-on card so it doesn't swallow
   * the view it's drawn over — everything below scales off these rather than
   * any module constant, so no other measurement needs adjusting alongside
   * them. Desktop passes neither and takes the admin's size. */
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxW = width ?? config.width;
  const boxH = height ?? config.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf: number;

    function draw() {
      if (!ctx || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      // Measured rather than taken from the prop, so the backing store always
      // matches the box the browser actually laid out (a fractional CSS pixel,
      // a transform on an ancestor). clientWidth is 0 only before first
      // layout, hence the fallback to the configured size.
      const w = canvas.clientWidth || boxW;
      const h = canvas.clientHeight || boxH;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      // setTransform, not scale — scale() *multiplies* into whatever
      // transform is already there, which was harmless only while the
      // canvas had one fixed size and so only ever ran once. Now that
      // width/height are props, a re-scale would compound (a re-sized map
      // drawn at dpr², off the canvas entirely). Assigning canvas.width
      // resets the transform anyway, so restating it every frame is both
      // cheap and the only version that's correct in all orders.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMiniMap(ctx, w, h, frameStateRef.current, config);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [frameStateRef, boxW, boxH, config]);

  return (
    // No background/border of its own — MuseumClient.tsx wraps this
    // together with AchievementHud in one shared card now, rather than two
    // separately-bordered boxes stacked with a visible gap between them.
    //
    // The width is the map's real width, not a floor. It used to be
    // `w-full` + `minWidth`, which meant the card's *widest* child decided the
    // map's size — and that child is the stats row underneath (tabular digits
    // with reserved `ch` widths), comfortably wider than the 240px default. So
    // the admin's "Map width" slider changed nothing at all until it was
    // dragged past the stats row, which is exactly how it read: a dead
    // control. Sizing the box itself puts the slider back in charge across its
    // whole range; `mx-auto` keeps a map narrower than the stats row centred
    // over it instead of hugging the left edge, and `shrink-0` stops the flex
    // column's stretch from taking the width back.
    <div className="pointer-events-none mx-auto shrink-0" style={{ width: boxW }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: boxH }}
        className="block rounded-lg"
      />
    </div>
  );
}

/**
 * One frame of the radar, into any 2D context — the DOM card above draws it
 * onto its own <canvas>, and VrHud.tsx draws the very same thing onto an
 * offscreen canvas it uploads as a texture, so the in-headset minimap can't
 * drift from the on-screen one. `w`/`h` are the CSS-pixel box; the caller
 * has already set whatever device-pixel transform it needs.
 */
export function drawMiniMap(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: MiniMapFrameState | null,
  config: MinimapHudConfig
) {
  ctx.clearRect(0, 0, w, h);
  if (!state) return;
  // Resolved once per frame rather than per mark — the config is a
  // prop, so these are constant for the life of this loop, and a dot
  // never has to think about opacity.
  const roomStroke = withAlpha(config.roomColor, ROOM_ALPHA);
  const doorStroke = withAlpha(config.doorColor, DOOR_ALPHA);
  const artworkFill = withAlpha(config.artworkColor, ARTWORK_ALPHA);
  const objectFill = withAlpha(config.objectColor, OBJECT_ALPHA);
  const activeFill = config.activeColor;

  const scale = Math.min(
    (w - PADDING * 2) / state.roomWidth,
    (h - PADDING * 2) / state.roomDepth
  );
  const rectW = state.roomWidth * scale;
  const rectH = state.roomDepth * scale;
  const rectX = (w - rectW) / 2;
  const rectY = (h - rectH) / 2;
  const doorSpan = DOORWAY_WIDTH * scale;
  // Room-local → canvas: rooms are centered at world X=0/local Z=0,
  // so the rect's own center is the natural origin for both.
  const originX = rectX + rectW / 2;
  const originY = rectY + rectH / 2;

  ctx.lineWidth = 1;
  // East/west — always solid, rooms never chain sideways.
  drawEdge(ctx, rectX, rectY, rectX, rectY + rectH, false, 0, roomStroke, doorStroke);
  drawEdge(ctx, rectX + rectW, rectY, rectX + rectW, rectY + rectH, false, 0, roomStroke, doorStroke);
  // North (top) / south (bottom) — a doorway gap when this room
  // connects to its neighbor there.
  drawEdge(ctx, rectX, rectY, rectX + rectW, rectY, state.hasNorthOpening, doorSpan, roomStroke, doorStroke);
  drawEdge(ctx, rectX, rectY + rectH, rectX + rectW, rectY + rectH, state.hasSouthOpening, doorSpan, roomStroke, doorStroke);

  // Admin-uploaded .glb props standing in this room — same room-local
  // space and same plotting as the artwork dots, drawn before them so
  // an artwork dot always wins where the two overlap.
  //
  // A prop dot can be lit too: the About room's Contact Desk stands on
  // the floor and so plots here rather than with the wall hangings, but
  // walking up to it means exactly what walking up to an artwork does,
  // so it gets the same glow. An uploaded .glb prop never sets that
  // flag — see MiniMapTracker's MiniMapDot.
  for (const obj of state.objectPositions) {
    const ox = originX + obj.x * scale;
    const oy = originY + obj.z * scale;
    if (obj.active) {
      drawActiveDot(ctx, ox, oy, activeFill);
    } else {
      ctx.fillStyle = objectFill;
      ctx.beginPath();
      ctx.arc(ox, oy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Artwork frames actually hanging in this room — plotted at their
  // own room-local wall position, same coordinate space the player
  // dot below uses, so they track whichever room the visitor is
  // currently standing in without this component needing to know
  // anything about artwork data itself (MiniMapTracker.tsx already
  // resolved it to plain {x,z} pairs).
  for (const art of state.artworkPositions) {
    const ax = originX + art.x * scale;
    const ay = originY + art.z * scale;
    if (art.active) {
      drawActiveDot(ctx, ax, ay, activeFill);
    } else {
      ctx.fillStyle = artworkFill;
      ctx.beginPath();
      ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Freedom Wall sticky notes — same dot/glow rendering as artwork
  // frames above, just judged "near" by plain distance to the player
  // dot (state.localX/localZ, same room-local space) rather than any
  // [E]-interact range, since a note has no per-item target the way an
  // artwork does. Empty in every room but the Freedom Wall.
  for (const note of state.stickyNotePositions) {
    const nx = originX + note.x * scale;
    const ny = originY + note.z * scale;
    const near = Math.hypot(note.x - state.localX, note.z - state.localZ) <= STICKY_NOTE_NEAR_DISTANCE;
    if (near) {
      ctx.save();
      ctx.shadowColor = activeFill;
      ctx.shadowBlur = 8;
      ctx.fillStyle = activeFill;
      ctx.beginPath();
      ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = artworkFill;
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Active Chase Companions currently sharing this room — dynamic,
  // however many are actually enabled and physically here (see
  // MiniMapTracker.tsx's room-bounds filter), distinct color from
  // both the artwork dots and the player wedge.
  ctx.fillStyle = config.companionColor;
  for (const c of state.companionPositions) {
    const cx = originX + c.x * scale;
    const cy = originY + c.z * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player dot + facing wedge — localX/localZ are room-local (rooms
  // centered at world X=0, so localX maps straight onto the rect's
  // own horizontal center; localZ likewise onto its vertical center,
  // same "smaller Z = north = up" orientation the rect itself uses).
  const px = originX + state.localX * scale;
  const py = originY + state.localZ * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.yaw);
  ctx.fillStyle = config.playerColor;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
