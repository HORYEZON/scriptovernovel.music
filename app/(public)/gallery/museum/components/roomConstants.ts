import type { MuseumRoomType } from "@/types";

// Shared room geometry/movement constants — kept in one place so
// MuseumRoom's walls, framePlacement's perimeter walk, roomLayout's corridor
// math, and PlayerControls' collision clamp all agree on the same numbers.
export const ROOM_HEIGHT = 5;
// Bumped from 0.2 — thin enough to read as flimsy right at a doorway
// (MuseumRoom.tsx's side posts/lintel). 0.30 rather than the first pass's
// 0.35 — noticeably sturdier than the original without needing to be that
// thick, especially now that each room insets its own wall by half this
// value at every shared boundary (see that file's Wall() doc comment).
export const WALL_THICKNESS = 0.3;

// Every room shares this width — rooms now chain together into one walkable
// corridor (see roomLayout.ts), connected by real doorway openings instead
// of a teleport/map jump. A shared width means every doorway lines up
// cleanly regardless of which two room types are adjacent, with no need for
// PlayerControls to re-clamp X bounds per room segment. Only *depth* (and
// lighting, see ROOM_LIGHTING_PRESETS) varies by roomType.
export const ROOM_WIDTH = 20;

export interface RoomSize {
  width: number;
  depth: number;
}

// Fixed per-roomType depths — deliberately not admin-configurable (see the
// V2 plan's §27 note: admins pick a room *type*, not raw dimensions).
// MAIN_HALL is the deepest, flagship arrival hall; GALLERY is a standard
// room; SPECIAL_EXHIBITION shares GALLERY's footprint but gets a moodier
// lighting preset below instead of a different size.
export const ROOM_SIZE_PRESETS: Record<MuseumRoomType, RoomSize> = {
  MAIN_HALL: { width: ROOM_WIDTH, depth: 26 },
  GALLERY: { width: ROOM_WIDTH, depth: 18 },
  SPECIAL_EXHIBITION: { width: ROOM_WIDTH, depth: 18 },
  // "About ScriptOverNovel" — the auto-generated capstone room at the end of the
  // corridor (see page.tsx). Same footprint as a standard GALLERY; nothing
  // about its size needs to differ, it just never gets any wall frames
  // since it carries zero MuseumRoomArtwork entries.
  ABOUT: { width: ROOM_WIDTH, depth: 18 },
  // Freedom Wall — same footprint as a standard GALLERY room; the wall
  // space is used for 3-D sticky notes (FreedomWallRoomContents.tsx) rather
  // than artwork frames, so room depth & width requirements are identical.
  FREEDOM_WALL: { width: ROOM_WIDTH, depth: 18 },
  // Stairs connector room (see prisma/schema.prisma's STAIRS enum comment
  // and roomLayout.ts) — deeper than a standard GALLERY room on purpose:
  // its floor is a ramp climbing RISE units over this depth, and a shallow
  // depth here would make for an uncomfortably steep slope.
  STAIRS: { width: ROOM_WIDTH, depth: 12 },
  // Services Room — the shop wall (lib/museum/servicesRoom.ts). Deeper than a
  // standard GALLERY because its frame count isn't curated: it holds however
  // many products are live at once, and framePlacement.ts's perimeter walk
  // divides the wall run evenly among them, so the extra depth is what keeps
  // a well-stocked shop from squeezing every frame down to its minimum.
  SERVICES: { width: ROOM_WIDTH, depth: 24 },
  // Stories Room — deep for the same reason SERVICES is, only more so: its
  // contents stand on the *floor* (one podium per published story, see
  // podiumPlacement.ts) rather than hanging on the walls, so floor area is
  // the constraint instead of wall run, and the count isn't curated. The
  // grid keeps a DOORWAY_WIDTH-wide walking lane clear down the middle, so
  // usable area is narrower than the footprint suggests.
  STORIES: { width: ROOM_WIDTH, depth: 26 },
  // Arcade Room — floor-area bound like STORIES: one cabinet per playable
  // mini game standing on the floor (cabinetPlacement.ts), count not curated,
  // same clear-centre-lane grid. There are only ever five game types, so it
  // doesn't need STORIES' full depth.
  ARCADE: { width: ROOM_WIDTH, depth: 22 },
  // Cosplay Room — bound by *wall run* rather than floor area, unlike the other
  // floor-standing rooms. Its standees line the perimeter, each with a photo
  // panel hung behind it (standeePlacement.ts), so what limits the room is how
  // much wall there is to stand them against — the same constraint SERVICES has,
  // hence the same depth. The middle of the floor stays empty on purpose: it is
  // the room a visitor walks down to look left and right.
  COSPLAY: { width: ROOM_WIDTH, depth: 24 },
  // Vinyl Room — sleeves on the east/west walls, the deck near the middle,
  // the Lyrics Wall across the north end; a gallery-sized room is enough.
  VINYL: { width: ROOM_WIDTH, depth: 18 },
};

// How many world units the second floor sits above the ground floor —
// climbed across the Stairs room's full depth (see ROOM_SIZE_PRESETS.STAIRS
// above). Only ever one rise, one Stairs room, in v1 (see
// docs/SecondFloorStairs_Spec.md's "one floor-0 ↔ floor-1 boundary" note).
// Untested-in-scene starting value — tune once it can actually be walked.
export const RISE = 4;

// How many individual visible steps the Stairs room's floor is built from —
// see MuseumRoom.tsx. Purely a visual staircase (solid ascending blocks);
// PlayerControls.tsx's actual walking motion stays a smooth ramp regardless
// (getFloorYAt's linear interpolation — see roomLayout.ts), same "visible
// steps, smooth walk" split many stylized games use rather than a literal
// per-step collision snap.
export const STAIR_STEP_COUNT = 10;

export function getRoomSize(roomType: MuseumRoomType): RoomSize {
  return ROOM_SIZE_PRESETS[roomType] ?? ROOM_SIZE_PRESETS.GALLERY;
}

// A doorway connecting two chained rooms is a gap of this width (centered
// on x=0, since every room is centered the same way) with a lintel above it
// up to this height — tall/wide enough to walk through comfortably, narrow
// enough that most of each shared wall stays solid. See MuseumRoom.tsx's
// doorway rendering and roomLayout.ts for which walls get one.
export const DOORWAY_WIDTH = 4.5;
export const DOORWAY_HEIGHT = 3.2;

export interface RoomLighting {
  ambientIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  pointColor: string;
  pointIntensity: number;
}

// MAIN_HALL/GALLERY share V1's original bright neutral lighting; only
// SPECIAL_EXHIBITION gets a warmer, moodier accent — the one place roomType
// visibly changes the room's *feel*, not just its footprint.
export const ROOM_LIGHTING_PRESETS: Record<MuseumRoomType, RoomLighting> = {
  MAIN_HALL: {
    ambientIntensity: 0.55,
    hemiSky: "#ffffff",
    hemiGround: "#94897a",
    hemiIntensity: 0.35,
    pointColor: "#fff6e0",
    pointIntensity: 18,
  },
  GALLERY: {
    ambientIntensity: 0.55,
    hemiSky: "#ffffff",
    hemiGround: "#94897a",
    hemiIntensity: 0.35,
    pointColor: "#fff6e0",
    pointIntensity: 18,
  },
  SPECIAL_EXHIBITION: {
    ambientIntensity: 0.4,
    hemiSky: "#ffe3bd",
    hemiGround: "#4a3626",
    hemiIntensity: 0.3,
    pointColor: "#ffcb8a",
    pointIntensity: 15,
  },
  // Warm, intimate "meet the artist" lighting — brighter and warmer than a
  // standard GALLERY, distinct from SPECIAL_EXHIBITION's moodier accent.
  ABOUT: {
    ambientIntensity: 0.5,
    hemiSky: "#fff1dc",
    hemiGround: "#6b5a44",
    hemiIntensity: 0.32,
    pointColor: "#ffdba8",
    pointIntensity: 17,
  },
  // Freedom Wall — slightly warmer than a standard gallery so sticky notes
  // feel vibrant and inviting; shares ABOUT's warmth without being identical.
  FREEDOM_WALL: {
    ambientIntensity: 0.52,
    hemiSky: "#fff5e0",
    hemiGround: "#7a6a50",
    hemiIntensity: 0.33,
    pointColor: "#ffe0a0",
    pointIntensity: 16,
  },
  // Neutral, slightly dim "in-between liminal space" — nobody lingers in
  // the Stairs room, it's a transition, so it doesn't need its own mood.
  STAIRS: {
    ambientIntensity: 0.45,
    hemiSky: "#eef0f4",
    hemiGround: "#7a7568",
    hemiIntensity: 0.28,
    pointColor: "#fff3d8",
    pointIntensity: 13,
  },
  // Services Room — the brightest, coolest preset of the set. A shop wall
  // wants merchandise read accurately (crisp near-neutral light, retail
  // rather than gallery-warm), which also makes it feel like a distinct stop
  // in the corridor rather than another GALLERY.
  SERVICES: {
    ambientIntensity: 0.62,
    hemiSky: "#ffffff",
    hemiGround: "#9a9384",
    hemiIntensity: 0.38,
    pointColor: "#fffaf0",
    pointIntensity: 19,
  },
  // Stories Room — a reading room, so warmer and softer than the retail-crisp
  // SERVICES preset next door, and a touch dimmer than GALLERY: the podium
  // lights are meant to pool on the books rather than flood the whole floor.
  STORIES: {
    ambientIntensity: 0.5,
    hemiSky: "#fff4e6",
    hemiGround: "#7d6f5c",
    hemiIntensity: 0.34,
    pointColor: "#ffe9c4",
    pointIntensity: 17,
  },
  // Arcade Room — the one cool-toned preset of the set: dimmer ambient and a
  // faint blue-magenta cast so the cabinet screens read as the brightest thing
  // in the room, the way a real arcade is lit.
  ARCADE: {
    ambientIntensity: 0.42,
    hemiSky: "#dfe4ff",
    hemiGround: "#3a3352",
    hemiIntensity: 0.3,
    pointColor: "#cfd6ff",
    pointIntensity: 15,
  },
  // Cosplay Room — the brightest, most neutral preset after SERVICES, and for a
  // related reason: costume colour has to read accurately (a wig or a fabric dye
  // shifted warm is a photo of a different costume), so this is closer to a
  // photo-studio light than to gallery-warm. A touch of warmth is kept so skin
  // tones in the prints don't go clinical.
  COSPLAY: {
    ambientIntensity: 0.6,
    hemiSky: "#fffdf8",
    hemiGround: "#8d8578",
    hemiIntensity: 0.36,
    pointColor: "#fff4e6",
    pointIntensity: 18,
  },
  // Vinyl Room — a listening room: dimmer and warmer than the galleries so
  // the sleeves and the glowing Lyrics Wall carry the light, tungsten-toned
  // like a record shop after hours.
  VINYL: {
    ambientIntensity: 0.4,
    hemiSky: "#f3e6cf",
    hemiGround: "#4a3a2a",
    hemiIntensity: 0.3,
    pointColor: "#ffd9a0",
    pointIntensity: 13,
  },
};

// Visitor-facing "Dark Mode" ([L] / the HUD toggle) — dims every room down
// to a moody after-hours gallery instead of the bright default above. Same
// three roomType presets, each roughly a third of its light-mode ambient/
// point intensity with a cooler/dimmer hemisphere, so SPECIAL_EXHIBITION's
// already-warmer accent still reads as visibly moodier than MAIN_HALL/
// GALLERY the same way it does in light mode.
export const ROOM_LIGHTING_DARK_PRESETS: Record<MuseumRoomType, RoomLighting> = {
  MAIN_HALL: {
    ambientIntensity: 0.16,
    hemiSky: "#232733",
    hemiGround: "#050506",
    hemiIntensity: 0.14,
    pointColor: "#ffdca8",
    pointIntensity: 7,
  },
  GALLERY: {
    ambientIntensity: 0.16,
    hemiSky: "#232733",
    hemiGround: "#050506",
    hemiIntensity: 0.14,
    pointColor: "#ffdca8",
    pointIntensity: 7,
  },
  SPECIAL_EXHIBITION: {
    ambientIntensity: 0.1,
    hemiSky: "#2e1f14",
    hemiGround: "#030201",
    hemiIntensity: 0.1,
    pointColor: "#ff9d52",
    pointIntensity: 5.5,
  },
  ABOUT: {
    ambientIntensity: 0.15,
    hemiSky: "#2a2018",
    hemiGround: "#080604",
    hemiIntensity: 0.13,
    pointColor: "#ffcf9a",
    pointIntensity: 6.5,
  },
  FREEDOM_WALL: {
    ambientIntensity: 0.15,
    hemiSky: "#2a2010",
    hemiGround: "#080502",
    hemiIntensity: 0.13,
    pointColor: "#ffd090",
    pointIntensity: 6.5,
  },
  STAIRS: {
    ambientIntensity: 0.13,
    hemiSky: "#20232c",
    hemiGround: "#060605",
    hemiIntensity: 0.11,
    pointColor: "#ffdca8",
    pointIntensity: 6,
  },
  SERVICES: {
    ambientIntensity: 0.18,
    hemiSky: "#252a35",
    hemiGround: "#060607",
    hemiIntensity: 0.15,
    pointColor: "#ffe6c0",
    pointIntensity: 8,
  },
  // Stories Room after hours — the podium pools stay readable (a book you
  // can't see isn't worth walking up to) while the room around them drops
  // away, which is exactly the effect dark mode is for here.
  STORIES: {
    ambientIntensity: 0.15,
    hemiSky: "#272219",
    hemiGround: "#0f0d0a",
    hemiIntensity: 0.15,
    pointColor: "#ffe4b8",
    pointIntensity: 9,
  },
  // Arcade Room after hours — the room falls almost fully dark so the cabinet
  // screens glow like the only light sources, which is the whole mood here.
  ARCADE: {
    ambientIntensity: 0.12,
    hemiSky: "#1a1c2c",
    hemiGround: "#08070c",
    hemiIntensity: 0.12,
    pointColor: "#bcc4ff",
    pointIntensity: 6,
  },
  // Cosplay Room after hours — the standees stay readable (a costume you can't
  // see isn't worth walking up to, same call the Stories Room's podium pools
  // make) while the floor between them drops away, which is what dark mode is
  // for here. Cooler than STORIES so it still reads as the daylight-lit room
  // dimmed rather than a second reading room.
  COSPLAY: {
    ambientIntensity: 0.17,
    hemiSky: "#262a30",
    hemiGround: "#0d0e10",
    hemiIntensity: 0.15,
    pointColor: "#ffeed6",
    pointIntensity: 9,
  },
  VINYL: {
    ambientIntensity: 0.12,
    hemiSky: "#2a2218",
    hemiGround: "#0d0a08",
    hemiIntensity: 0.14,
    pointColor: "#ffc98a",
    pointIntensity: 7,
  },
};

/**
 * Returns lighting values for a room, optionally scaled by a brightness
 * multiplier. `brightness` is a 0-100 admin-set value where 50 = 1.0×
 * (baseline as designed), 0 = fully dark, 100 = 2× as bright.
 */
export function getRoomLighting(
  roomType: MuseumRoomType,
  darkMode = false,
  /** 0–100 admin brightness (50 = baseline). Default 50 = no scaling. */
  brightness = 50
): RoomLighting {
  const presets = darkMode ? ROOM_LIGHTING_DARK_PRESETS : ROOM_LIGHTING_PRESETS;
  const base = presets[roomType] ?? presets.GALLERY;
  const m = Math.max(0, brightness) / 50; // 50 → 1.0×, 100 → 2.0×, 0 → 0×
  return {
    ...base,
    ambientIntensity: base.ambientIntensity * m,
    hemiIntensity: base.hemiIntensity * m,
    pointIntensity: base.pointIntensity * m,
  };
}

// Canvas background/fog — same light/dark split as the room lighting above,
// applied once at the scene level (MuseumScene.tsx) since the void beyond a
// doorway isn't any one room's lighting to own.
export const SCENE_BACKGROUND_LIGHT = "#141210";
// Slightly warmer near-black so the void glimpsed through doorways in dark
// mode reads as "deep gallery shadow" rather than a hard black wall — same
// hue as the light-mode background, just much dimmer.
export const SCENE_BACKGROUND_DARK = "#0d0b09";

// How far a frame's face sits off the wall surface. Every wall (all 4
// sides, see MuseumRoom.tsx's Wall()/east/west inset) is centered a full
// WALL_THICKNESS/2 in from the room's own boundary, so its near face (the
// side a frame actually sits against) is a full WALL_THICKNESS in from
// that boundary — not just half — plus ArtworkFrame's own backing box,
// which extends another 0.04 further back from this offset (it's centered
// at local z=-0.02 with depth 0.04). Anything smaller embeds the frame
// inside the wall's solid geometry, fully occluded and invisible from the
// room — this is exactly the bug a smaller FRAME_WALL_OFFSET produced
// right after WALL_THICKNESS grew (frames near a doorway wall visibly
// sank into it). Tracks WALL_THICKNESS's own value so this keeps the same
// real clearance margin regardless of that constant's tuning.
export const FRAME_WALL_OFFSET = 0.42;

/**
 * The warm gold a room lights something up in when the visitor walks up to
 * it — an artwork frame's border in a curated room (ArtworkFrame.tsx), the
 * Contact Desk's letter, and every one of the About room's content blocks.
 *
 * One constant rather than a hex per file because "walking up to a thing
 * makes it glow" is meant to read as the same signal everywhere in the
 * museum: a visitor learns it once in the first room and it keeps meaning
 * the same thing in the last. Deliberately not applied to an admin-uploaded
 * .glb prop — those are scenery, not something to walk up to, and glowing
 * decor would teach the signal wrong.
 *
 * The value is the gold curated rooms have always used for an active frame,
 * lifted out of ArtworkFrame.tsx rather than picked fresh, so adopting it in
 * the About room changed that room and nothing else.
 */
export const INTERACT_GLOW_COLOR = "#c8a96e";

// Hard cap on a frame's rendered width (ArtworkFrame.tsx scales height down
// to match, preserving the real aspect ratio rather than distorting it) and
// the minimum gap kept between two neighboring frames' edges. Together these
// bound how wide any single frame can ever get, which CORNER_MARGIN and
// framePlacement.ts's per-slot `maxWidth` both build on — without a cap, a
// panoramic artwork's natural width is unbounded and will happily overlap
// its neighbors or wrap into a corner, however much margin is reserved.
export const MAX_FRAME_WIDTH = 3.3;
export const FRAME_GAP = 0.5;

// Perimeter margin at each corner so no frame — not just an average one —
// ever wraps around the edge. Must be at least half of MAX_FRAME_WIDTH plus
// the gap: a frame's *center* can land right at the edge of its wall
// segment (see framePlacement.ts), so its half-width has to fit entirely
// within this margin without reaching the adjacent wall.
export const CORNER_MARGIN = MAX_FRAME_WIDTH / 2 + FRAME_GAP;

// First-person camera / movement tuning.
export const EYE_HEIGHT = 1.7;
export const MOVE_SPEED = 4.5; // units/sec
// [Space] (desktop) / the mobile jump button — a simple parabolic arc, not a
// physics engine: an upward initial velocity plus constant downward
// acceleration, clamped back to 0 the instant it would go below the floor.
// Peak height = JUMP_VELOCITY² / (2 × JUMP_GRAVITY) ≈ 0.8 units — a quick,
// arcade-like bounce (there's nothing to actually jump over in the museum,
// this is purely a fun traversal flourish) rather than a realistic leap.
export const JUMP_VELOCITY = 4.2; // units/sec, initial upward speed
export const JUMP_GRAVITY = 11; // units/sec², downward acceleration
// How far the camera is kept from any wall — prevents clipping through.
export const PLAYER_RADIUS = 0.5;
// [E]-interaction hysteresis — how close counts as "near enough to view",
// with a wider exit gap than entry so the prompt doesn't flicker right at
// the boundary distance. Originally PlayerControls.tsx-local (artwork
// frames only); exported here so AboutRoomContents.tsx's certificate
// proximity check (a separate tracker — About room carries zero
// MuseumRoomArtwork entries, see roomConstants.ts's ABOUT preset comment)
// uses the exact same "how close is close enough" feel instead of a
// second, potentially-drifting tuning value.
export const INTERACT_PROXIMITY_ENTER = 2.5;
export const INTERACT_PROXIMITY_EXIT = 3.2;
// How far the camera pitches up/down from level before clamping — keeps a
// touch drag from flipping the view upside down.
export const MAX_PITCH = Math.PI / 2 - 0.05;
// Radians of yaw/pitch per pixel of touch-drag (see TouchControls.tsx).
export const TOUCH_LOOK_SENSITIVITY = 0.0035;
// After an Escape-triggered pointer-unlock, Chrome enforces a short cooldown
// before it'll grant another pointer lock request. drei's PointerLockControls
// re-requests a lock on the very next click regardless (see PlayerControls.tsx),
// so without this, clicking again inside that window logs a spurious "Unable
// to use Pointer Lock API" console error even though nothing's actually wrong.
export const POINTER_LOCK_COOLDOWN_MS = 1300;
// Joystick knob travel, in CSS pixels, before its vector reads as fully
// deflected (±1) — see TouchControls.tsx.
export const JOYSTICK_RADIUS = 46;
// The right-side look joystick (landscape mode only, TouchControls.tsx)
// feeds lookRef the same "pixels of equivalent drag" unit TOUCH_LOOK_
// SENSITIVITY above already expects, so both controls turn the camera at
// the same felt rate — this is how many of those units a fully-deflected
// stick pushes per millisecond held. At the original 1.1 this worked out
// to roughly 210°/sec at full deflection — fast enough that the stick felt
// twitchy and hard to land on a precise angle ("magulo, mahirap galawin");
// ~0.55 keeps a full spin-around to well under 2 seconds while staying
// controllable for small adjustments.
// How fast the right-hand look joystick turns the camera — expressed as a
// multiple of the screen, not an absolute pixel rate.
//
// This replaced a fixed "pixels of equivalent drag per millisecond" value,
// which turned the camera by a different fraction of the view on every
// screen size and had no principled answer to "how fast should it be?"
// beyond guessing a number and re-guessing when it felt wrong (it was
// tuned down twice and still read as too twitchy). Anchoring it to the
// screen answers that: at full deflection, holding the stick for one
// second turns the camera by exactly this many full-screen drags. 1.0
// means "the stick moves the view at the same rate my thumb does when I
// drag across the screen", and it feels the same on a small phone as on a
// tablet, which a fixed pixel rate never can.
export const LOOK_JOYSTICK_SCREENS_PER_SEC = 1.0;
// Same unit again, this time per degree of device tilt per event (see
// TouchControls.tsx's gyroscope handling) — device orientation events fire
// much less often than a touchmove drag, so this is deliberately a larger
// per-unit push than a single pixel of drag would be.
export const GYRO_LOOK_SENSITIVITY = 2.2;

// Fallback aspect ratio (width/height) used for a frame's placement math
// before its texture has loaded, and permanently if loading fails — see
// lib/museum/loadDownscaledTexture.ts.
export const FALLBACK_ASPECT = 4 / 3;
export const FRAME_HEIGHT = 2.2; // fixed plane height; width derives from aspect

// Wall/floor/ceiling color fallbacks — used whenever the admin hasn't
// customized them (RoomsTab.tsx) and mirror MuseumRoom's Prisma defaults,
// so a brand-new room and a never-passed prop render identically.
export const DEFAULT_WALL_COLOR = "#ece7db";
export const DEFAULT_FLOOR_COLOR = "#c9c0ad";
export const DEFAULT_CEILING_COLOR = "#f4f2ec";

// Assumed physical size (world units, i.e. meters) one wallTexture/
// floorTexture/ceilingTexture image tiles across — MuseumRoom.tsx repeats
// the texture at `surfaceWidth / TEXTURE_TILE_METERS` rather than stretching
// one image across an entire wall, so a concrete or wood photo reads as
// actual material instead of a smeared poster. Not admin-adjustable (yet) —
// picked to look reasonable for a typical seamless texture photo without
// needing a per-room "scale" control.
export const TEXTURE_TILE_METERS = 2;

// Fixed client-facing id for the auto-generated "About ScriptOverNovel" room (see
// page.tsx + MuseumScene.tsx) — deliberately decoupled from that room's
// real MuseumRoom database id (lib/museum/aboutRoom.ts), which every
// client-side comparison against currentRoomId would otherwise need to
// know about. Only the admin-only Museum Scene Editor route uses the real
// id (RoomsTab.tsx's Edit Scene link).
export const ABOUT_ROOM_ID = "museum-about-scriptovernovel";

// How long the rooms a visitor isn't near wait, *after the entry room's own
// assets have finished*, before fetching their wall/floor/ceiling textures.
// Measured from that rather than from mount: a flat delay from mount expires
// while the entry room is still downloading on a phone, so the wave it lets
// through competes for the same handful of connections instead of waiting for
// them. Also longer than EntryLoadGate's own settle, so the overlay lifts
// before this adds anything to what that gate is measuring. See
// MuseumScene.tsx's farTexturesReady.
export const FAR_TEXTURE_DELAY_MS = 600;

// Backstop for the above, measured from mount. Covers the two cases where
// waiting on the loader never resolves: a museum whose rooms are all plain
// colours (nothing ever registers with THREE.DefaultLoadingManager, so it
// never goes from busy to idle) and a request that stalls and keeps the
// manager busy indefinitely. Neither should leave the far rooms flat forever.
export const FAR_TEXTURE_CEILING_MS = 10000;

/**
 * Hard ceiling on a scene object's collision radius, in metres.
 *
 * The radius is normally measured from an uploaded model's bounding box, and
 * a .glb exported in the wrong units (or carrying one stray far-off vertex, or
 * an empty node whose Box3 comes back infinite) can measure absurdly large —
 * a real upload reported a collision diameter of 9.6e+42 m. Left unchecked
 * that both breaks the editor's readout and, worse, drops an invisible wall
 * over the whole museum. Nothing legitimate needs a footprint wider than a
 * room, so measurements are clamped to this on the way in.
 */
export const MAX_COLLIDER_RADIUS = 12;
export const MIN_COLLIDER_RADIUS = 0.1;

/** Clamps a measured/stored collider radius into something usable, mapping
 *  NaN and ±Infinity onto `fallback` rather than letting them through.
 *
 *  Both bounds are **metres**, so this belongs on a world-space radius — pass
 *  it `nativeRadius * scale`, never a raw model-unit measurement. See
 *  colliderWorldRadius below, which is what callers should reach for. */
export function sanitizeColliderRadius(value: number | null | undefined, fallback = 0.5): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_COLLIDER_RADIUS, Math.max(MIN_COLLIDER_RADIUS, value));
}

/** Floor on the drawn/blocked circle. Slightly above MIN_COLLIDER_RADIUS,
 *  which is where the editor's slider bottoms out — a ring thinner than this
 *  is invisible in the preview and a footprint smaller than it is not worth
 *  testing against. */
export const MIN_COLLIDER_WORLD_RADIUS = 0.15;

/**
 * A prop's collision circle in world metres: its footprint radius in the
 * model's *own* units, resized along with the prop, then clamped.
 *
 * The clamp has to happen here, on the metre value, rather than on the
 * measurement going in. A .glb carries no unit, so a centimetre-authored
 * model measures its own footprint in the thousands and is drawn at a scale
 * of ~0.0004 to fit the room (see the Scene Editor's modelUnitScale).
 * Clamping the measurement first pinned that 1,694-unit radius to 12 and then
 * multiplied it down to 4mm, so the ring collapsed to its floor while the
 * model rendered two metres wide — the ring and the object it stands for
 * disagreeing by four orders of magnitude. Multiplying first and clamping
 * after keeps a bad model from walling off the museum without punishing a
 * good one that simply wasn't authored in metres.
 */
export function colliderWorldRadius(
  nativeRadius: number | null | undefined,
  scale: number
): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const native = nativeRadius != null && Number.isFinite(nativeRadius) ? nativeRadius : null;
  return Math.max(
    MIN_COLLIDER_WORLD_RADIUS,
    sanitizeColliderRadius(native == null ? null : native * s)
  );
}

/**
 * How far a collision circle may sit from its prop's own origin, in metres.
 *
 * The same ceiling the radius uses, for the same reason: an offset is
 * normally measured from the model's bounding box, so a .glb carrying one
 * stray far-off vertex reports a centre just as absurd as its radius. A
 * footprint further from its prop than the width of a room is never what an
 * admin meant, and would block a patch of floor with nothing standing on it.
 */
export const MAX_COLLIDER_OFFSET = MAX_COLLIDER_RADIUS;

/**
 * A prop's collision-circle offset in world metres, along one axis: the
 * stored offset in the model's *own* units, resized along with the prop,
 * then clamped — the same multiply-then-clamp order colliderWorldRadius
 * documents at length, and for the same centimetre-authored models.
 *
 * The offset lives in the prop's own rotated frame, so callers placing it in
 * world space must rotate the pair by the prop's `rotationY` (see
 * MuseumScene's customObstacles). Inside the editor's preview the ring is a
 * child of the object's own rotated group, so it needs no rotation of its
 * own.
 */
export function colliderWorldOffset(
  nativeOffset: number | null | undefined,
  scale: number
): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (nativeOffset == null || !Number.isFinite(nativeOffset)) return 0;
  const world = nativeOffset * s;
  if (!Number.isFinite(world)) return 0;
  return Math.min(MAX_COLLIDER_OFFSET, Math.max(-MAX_COLLIDER_OFFSET, world));
}

/**
 * How tall a collision footprint may stand, in metres.
 *
 * The ceiling is the room's own (ROOM_HEIGHT) — a column taller than the room
 * is indistinguishable from the full-height default, so there is nothing above
 * it worth offering. The floor is low enough to describe a doorstep and still
 * be visible as a band in the editor's preview.
 */
export const MIN_COLLIDER_HEIGHT = 0.2;
export const MAX_COLLIDER_HEIGHT = ROOM_HEIGHT;

/**
 * A prop's collision-column height in world metres, or **null for "full
 * height"** — the floor-to-ceiling column every solid prop was before this
 * was configurable, and what a never-configured row still means.
 *
 * Same multiply-then-clamp order as colliderWorldRadius/colliderWorldOffset,
 * and for the same centimetre-authored models: the stored value is in the
 * model's own units, so it is scaled with the prop first and only then bounded
 * in metres. A stored value that isn't a finite number is treated as unset
 * rather than as zero — a zero-height column would silently make a prop
 * walk-through while its Solid toggle still read "on".
 */
/**
 * How far the collision column is lifted off the prop's own base, in world
 * metres.
 *
 * Bounded by the room's own ceiling for the same reason MAX_COLLIDER_HEIGHT
 * is: a column lifted past it blocks nothing a visitor can reach, which is
 * indistinguishable from the prop not being solid — and an admin who did that
 * by accident would have no way to tell what went wrong.
 *
 * Same multiply-then-clamp order as the three helpers above, for the same
 * centimetre-authored models. Never null: "not lifted" is 0, a real position,
 * unlike a height where null genuinely means "no column, use the full-height
 * default".
 */
export function colliderWorldBaseY(
  nativeBaseY: number | null | undefined,
  scale: number
): number {
  if (nativeBaseY == null || !Number.isFinite(nativeBaseY)) return 0;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const world = nativeBaseY * s;
  if (!Number.isFinite(world)) return 0;
  return Math.min(MAX_COLLIDER_BASE_Y, Math.max(0, world));
}

export const MAX_COLLIDER_BASE_Y = ROOM_HEIGHT;

export function colliderWorldHeight(
  nativeHeight: number | null | undefined,
  scale: number
): number | null {
  if (nativeHeight == null || !Number.isFinite(nativeHeight)) return null;
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const world = nativeHeight * s;
  if (!Number.isFinite(world)) return null;
  return Math.min(MAX_COLLIDER_HEIGHT, Math.max(MIN_COLLIDER_HEIGHT, world));
}
