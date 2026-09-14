"use client";

// app/(admin)/admin/artworks/museum-editor/[roomId]/MuseumEditorClient.tsx
//
// Museum Scene Editor — Docs/MuseumSceneEditor_Spec.md. Owns all state/
// fetching; the actual Three.js view lives in MuseumEditorScene.tsx, loaded
// via next/dynamic({ ssr: false }) here so three/@react-three/* never
// reach the server bundle — same pattern as the public museum's
// MuseumSceneLoader.tsx.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  Move,
  RotateCw,
  Save,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  Plus,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Sun,
  Moon,
  Type,
  Columns2,
  RectangleHorizontal,
  AlignLeft,
  AlignCenter,
  Share2,
} from "lucide-react";
import toast from "@/lib/toast";
import { AnimatePresence } from "framer-motion";
import { Share360Modal } from "@/app/(public)/gallery/museum/components/Share360Modal";
import type { Share360Fn } from "@/app/(public)/gallery/museum/components/Room360Capture";
import { roomShareUrl, type Panorama360Result } from "@/lib/museum/panorama360";
import { useLeaveBlocker } from "@/components/admin/AdminLeaveGuard";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { toggleStaged } from "@/lib/admin/toggleToast";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { FreedomWallNotePublic, MuseumRoomType, MuseumAboutData } from "@/types";
import {
  getWallDefinitions,
  getDividerWallDefinitions,
  wallPointAt,
  wallFreeCoord,
  snapToDividerFace,
  computeFramePlacements,
  FRAME_CENTER_Y,
  type WallDefinition,
} from "@/app/(public)/gallery/museum/components/framePlacement";
import { computePodiumPlacements } from "@/app/(public)/gallery/museum/components/podiumPlacement";
import { computeCabinetPlacements } from "@/app/(public)/gallery/museum/components/cabinetPlacement";
import { computeStandeePlacements } from "@/app/(public)/gallery/museum/components/standeePlacement";
import {
  ARCADE_CONFIG_KIND,
  DEFAULT_CABINET_SCREEN_DEPTH,
  DEFAULT_CABINET_SCREEN_HEIGHT,
  parseArcadeConfig,
  serializeArcadeConfig,
  normalizeArcadeMode,
  type ArcadeConfig,
  type ArcadeDisplayMode,
} from "@/lib/museum/arcadeConfig";
import { DIFFICULTY_LABELS } from "@/lib/minigames/types";
import { GAME_REGISTRY } from "@/lib/minigames/registry";
import { resolveNoteWallSegment } from "@/lib/museum/freedomWallNotePlacement";
import {
  getRoomSize,
  colliderWorldRadius,
  colliderWorldOffset,
  colliderWorldHeight,
  MAX_COLLIDER_RADIUS,
  MAX_COLLIDER_OFFSET,
  MIN_COLLIDER_RADIUS,
  MIN_COLLIDER_HEIGHT,
  MAX_COLLIDER_HEIGHT,
  MAX_COLLIDER_BASE_Y,
  colliderWorldBaseY,
} from "@/app/(public)/gallery/museum/components/roomConstants";
import type { ModelFit } from "@/app/(public)/gallery/museum/components/CustomSceneObject";
import { uploadModelViaSignedUrl } from "@/lib/supabase/browser-storage";
import { playSoundEffect } from "@/lib/sound/engine";
import {
  ABOUT_PHOTO_KIND,
  ABOUT_PLAQUE_KIND,
  ABOUT_CERTS_KIND,
  ABOUT_CARD_KIND,
  ABOUT_GIGS_KIND,
  ABOUT_BLOCK_KINDS,
  ABOUT_CONTACT_KIND,
  CONTACT_DESK_LABEL,
  DEFAULT_CONTACT_DESK_CONFIG,
  parseContactDeskConfig,
  serializeContactDeskConfig,
  type ContactDeskConfig,
  ABOUT_CLOCK_KIND,
  WALL_CLOCK_LABEL,
  DEFAULT_WALL_CLOCK_CONFIG,
  CLOCK_GLOW_MIN,
  CLOCK_GLOW_MAX,
  MAX_CLOCK_LABEL,
  parseWallClockConfig,
  serializeWallClockConfig,
  type WallClockConfig,
  ABOUT_BLOCK_LABEL,
  WALL_ROT_Y,
  rotYToWall,
  DEFAULT_PLAQUE_CONFIG,
  DEFAULT_TEXT_CONFIG,
  DEFAULT_CERTS_LABEL_CONFIG,
  PLAQUE_FONT_OPTIONS,
  parsePlaqueConfig,
  parseTextConfig,
  parseAboutLabelConfig,
  defaultAboutLabelConfig,
  parseCertPlacements,
  resolveCertPlacement,
  isDefaultCertPlacement,
  mergeSceneObjectConfig,
  MAX_WALL_CERTS,
  CERT_NUDGE_MIN,
  CERT_NUDGE_MAX,
  CERT_ITEM_SCALE_MIN,
  CERT_ITEM_SCALE_MAX,
  type AboutWall,
  type AboutBlockKind,
  type PlaqueConfig,
  type TextObjectConfig,
  type AboutLabelConfig,
  type CertPlacement,
  type CertPlacementMap,
} from "@/lib/museum/aboutRoomBlocks";
import {
  FREEDOM_WALL_BANNER_KIND,
  DEFAULT_BANNER_COLORS,
  parseBannerColors,
  PLAQUE_FONT_SIZE_MIN,
  PLAQUE_FONT_SIZE_MAX,
  type BannerColors,
} from "@/lib/museum/freedomWallBanner";
import { TextureField, Toggle } from "@/app/(admin)/admin/artworks/museum-ui";
import {
  STORY_PODIUM_MODEL_KIND,
  DEFAULT_PODIUM_BOOK_HEIGHT,
  parsePodiumModelConfig,
  serializePodiumModelConfig,
} from "@/lib/museum/storyPodiumModel";
import {
  COSPLAY_STANDEE_MODEL_KIND,
  DEFAULT_STANDEE_CUTOUT_HEIGHT,
  MIN_CUTOUT_HEIGHT,
  MAX_CUTOUT_HEIGHT,
  MIN_BACKDROP_SIZE,
  MAX_BACKDROP_SIZE,
  MIN_BACKDROP_EDGE,
  MAX_BACKDROP_EDGE,
  MIN_BULB_SIZE,
  MAX_BULB_SIZE,
  MIN_BULB_SPACING,
  MAX_BULB_SPACING,
  MIN_LIGHTS_INTENSITY,
  MAX_LIGHTS_INTENSITY,
  MIN_LIGHTS_SPEED,
  MAX_LIGHTS_SPEED,
  MIN_FLOOD_COUNT,
  MAX_FLOOD_COUNT,
  MIN_FLOOD_BEAM_HEIGHT,
  MAX_FLOOD_BEAM_HEIGHT,
  MIN_FLOOD_BEAM_SPREAD,
  MAX_FLOOD_BEAM_SPREAD,
  LIGHTS_ANIMATIONS,
  LIGHTS_STYLES,
  LIGHTS_STYLE_LABELS,
  parseCosplayStandeeConfig,
  serializeCosplayStandeeConfig,
  type CosplayStandeeConfig,
} from "@/lib/museum/cosplayStandee";
import {
  BANNER_KIND,
  BANNER_LABEL,
  BANNER_DEFAULT_Y,
  BANNER_FONT_SIZE_MIN,
  BANNER_FONT_SIZE_MAX,
  BANNER_MIN_WIDTH,
  BANNER_MAX_WIDTH,
  BANNER_MIN_HEIGHT,
  BANNER_MAX_HEIGHT,
  BANNER_MAX_CHARS,
  BANNER_EYEBROW_MAX_CHARS,
  DEFAULT_BANNER_CONFIG,
  parseSceneBannerConfig,
  serializeSceneBannerConfig,
  type SceneBannerConfig,
} from "@/lib/museum/sceneBanner";
import {
  ROOM_BANNER_KIND,
  ROOM_BANNER_LABEL,
  defaultRoomBannerStyle,
  parseRoomBannerStyle,
  serializeRoomBannerStyle,
  MIN_BANNER_FONT_SCALE,
  MAX_BANNER_FONT_SCALE,
  MIN_BANNER_EDGE,
  MAX_BANNER_EDGE,
  MIN_BANNER_GLASS_OPACITY,
  MAX_BANNER_GLASS_OPACITY,
  MIN_BANNER_SHIMMER_SPEED,
  MAX_BANNER_SHIMMER_SPEED,
  MIN_BANNER_SHIMMER_STRENGTH,
  MAX_BANNER_SHIMMER_STRENGTH,
  MIN_BANNER_BRIGHTNESS,
  MAX_BANNER_BRIGHTNESS,
  type BannerRoomType,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import {
  DIVIDER_KIND,
  DIVIDER_LABEL,
  DEFAULT_DIVIDER_CONFIG,
  DIVIDER_MIN_WIDTH,
  DIVIDER_MAX_WIDTH,
  DIVIDER_MIN_HEIGHT,
  DIVIDER_MAX_HEIGHT,
  DIVIDER_MIN_THICKNESS,
  DIVIDER_MAX_THICKNESS,
  parseWallDividerConfig,
  serializeWallDividerConfig,
  type WallDividerConfig,
} from "@/lib/museum/wallDivider";

const MuseumEditorScene = dynamic(
  () => import("./MuseumEditorScene").then((m) => m.MuseumEditorScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full font-body text-sm text-ink-400 dark:text-ink-300">
        Loading 3D preview…
      </div>
    ),
  }
);

export type SceneMode = "translate" | "rotate";

export interface SceneObject {
  id: string;
  kind: string; // "standee" | "custom" | "about-photo" | "about-plaque" | "about-certs"
  // Admin-chosen display name for a "custom" .glb prop — shown in the
  // object list and confirm dialogs in place of the generic "Decorative
  // Object". Null for every non-custom kind and for props left unnamed.
  label: string | null;
  modelUrl: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  // Uniform scale multiplier — only used for kind "custom" (a .glb prop);
  // 1 = the model's own exported size. The side panel exposes a slider for
  // it exactly like an artwork frame's Size control.
  scale: number;
  // kind "custom" only: block visitors from walking through this prop in
  // the public museum (PlayerControls' `obstacles`). `colliderRadius` is
  // the circular footprint in the model's own units before `scale`; null =
  // auto-fit from the model's bounding box. Both ignored unless `solid`.
  solid: boolean;
  colliderRadius: number | null;
  /** Where that circle sits relative to the model's own origin — same model
   *  units as `colliderRadius`, in the prop's own rotated frame. 0/0 is the
   *  origin, which is where every footprint sat before these existed. A .glb
   *  whose geometry was exported off to one side of its origin is the reason
   *  they do: no radius can move a circle, only grow it. */
  colliderOffsetX: number;
  colliderOffsetZ: number;
  /** How tall that circle stands, measured up from the prop's own base, in
   *  the same model units. Null = a floor-to-ceiling column, which is what
   *  every solid prop was before this existed — and still the default, since
   *  most props are things you walk *around*. A height is what lets a hanging
   *  lamp or an archway be solid where it hangs and clear underneath. */
  colliderHeight: number | null;
  /** How far that column is lifted off the prop's own base, in the same model
   *  units. 0 = standing on the base, which is what a height-limited collider
   *  always did. Only meaningful alongside a `colliderHeight`: with no height
   *  there is no column to lift, only the floor-to-ceiling default. This is
   *  what lets an archway's crossbeam or a shelf be solid where it is and
   *  open underneath — shrinking the height alone only ever made a shorter
   *  obstacle still rooted to the floor. */
  colliderBaseY: number;
  /** "Hide from Museum" — kept out of the public museum while staying in
   *  the room, with its model, wording and placement untouched. Nothing to
   *  do with `hiddenIds`, this editor's own eye toggle, which only declutters
   *  the preview and is never saved. */
  hidden: boolean;
}

export interface ArtworkEntry {
  id: string; // MuseumRoomArtwork join-row id
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  artwork: { id: string; title: string; imageUrl: string };
}

/** What the 3D view actually renders for one artwork — custom position
 * falls back to the same auto-computed even-spacing placement production
 * uses (see computeFramePlacements), so an untouched frame starts exactly
 * where a visitor already sees it. */
export interface EditableArtworkItem {
  id: string;
  title: string;
  imageUrl: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
  hasCustomPosition: boolean;
}

/** One podium row as it arrives from page.tsx — the Stories Room only. */
export interface StoryEntry {
  id: string;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  story: { id: string; title: string; type: string; coverImageUrl: string };
}

/** What the 3D view renders for one podium — custom position falls back to
 * the same auto grid production uses (see computePodiumPlacements), so an
 * untouched podium starts exactly where a visitor already sees it. The
 * floor-standing counterpart to EditableArtworkItem above; note there's no
 * wall to snap to, so X and Z are both free. */
export interface EditablePodiumItem {
  id: string;
  title: string;
  type: string;
  coverImageUrl: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
  hasCustomPosition: boolean;
}

/** One standee row as it arrives from page.tsx — the Cosplay Room only. */
export interface CosplayEntry {
  id: string;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  /** This standee's own billboard-lights switch. Per-standee, unlike every
   *  other cosplay-room setting — see MuseumRoomCosplay.lightsEnabled. */
  lightsEnabled: boolean;
  cosplay: {
    id: string;
    title: string;
    character: string | null;
    series: string | null;
    standeeImageUrl: string;
    backdropImageUrl: string | null;
    // Plaque lines — the standee draws them, so the editor has to carry them
    // or its preview would label a standee differently from the real room.
    // See CosplayStandee.tsx's plaque block comment.
    year: number | null;
    event: string | null;
    cosplayer: string | null;
    photographer: string | null;
  };
}

/** What the 3D view renders for one standee — the Cosplay counterpart to
 *  EditablePodiumItem. One item is the whole pair (the standee and the photo
 *  hung behind it), because one placement moves both. */
export interface EditableStandeeItem {
  id: string;
  title: string;
  character: string | null;
  series: string | null;
  standeeImageUrl: string;
  backdropImageUrl: string | null;
  year: number | null;
  event: string | null;
  cosplayer: string | null;
  photographer: string | null;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
  hasCustomPosition: boolean;
  lightsEnabled: boolean;
}

/** One cabinet row as it arrives from page.tsx — the Arcade Room only. */
export interface MiniGameEntry {
  id: string;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  displayMode: string | null;
  game: {
    type: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    artwork: { title: string; imageUrl: string } | null;
  };
}

/** What the 3D view renders for one cabinet — the arcade counterpart to
 *  EditablePodiumItem, with a display mode added. */
export interface EditableCabinetItem {
  id: string;
  title: string;
  imageUrl: string | null;
  subtitle: string;
  mode: ArcadeDisplayMode;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
  scale: number;
  hasCustomPosition: boolean;
}

interface RoomShell {
  id: string;
  name: string;
  /** For Share 360°'s "Copy room link" — see lib/museum/panorama360.ts's
   *  roomShareUrl. */
  slug: string;
  roomType: MuseumRoomType;
  /** Whether this is the room a visitor respawns into. Only the wall clock
   *  cares: it is re-provisioned for this room and the About room, so
   *  "Remove" means "reset to default" there and a real removal anywhere
   *  else (see lib/museum/wallClock.ts). */
  isEntryRoom: boolean;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
  artworks: ArtworkEntry[];
  /** Only ever non-empty on the Stories Room. */
  stories?: StoryEntry[];
  /** Only ever non-empty on the Arcade Room. */
  miniGames?: MiniGameEntry[];
  /** Only ever non-empty on the Cosplay Room. */
  cosplays?: CosplayEntry[];
}

const KIND_LABEL: Record<string, string> = {
  custom: "Decorative Object",
  text:   "Text Label",
  [DIVIDER_KIND]: DIVIDER_LABEL,
  [BANNER_KIND]: BANNER_LABEL,
  [FREEDOM_WALL_BANNER_KIND]: "Freedom Wall Plaque",
  [ABOUT_PHOTO_KIND]: ABOUT_BLOCK_LABEL[ABOUT_PHOTO_KIND],
  [ABOUT_PLAQUE_KIND]: ABOUT_BLOCK_LABEL[ABOUT_PLAQUE_KIND],
  [ABOUT_CERTS_KIND]: ABOUT_BLOCK_LABEL[ABOUT_CERTS_KIND],
  [ABOUT_CARD_KIND]: ABOUT_BLOCK_LABEL[ABOUT_CARD_KIND],
  [ABOUT_GIGS_KIND]: ABOUT_BLOCK_LABEL[ABOUT_GIGS_KIND],
  [ABOUT_CONTACT_KIND]: CONTACT_DESK_LABEL,
  [ABOUT_CLOCK_KIND]: WALL_CLOCK_LABEL,
};
/** Display name for a scene object — an admin-set custom name (custom .glb
 *  props only) wins over the generic per-kind label. */
function sceneObjectLabel(o: { kind: string; label?: string | null }): string {
  return o.label?.trim() || KIND_LABEL[o.kind] || o.kind;
}
// Longest custom name we store — keeps the object list and dialogs from
// blowing out; enforced again server-side.
const MAX_SCENE_LABEL = 80;
/** The 3 About-room blocks aren't decorative objects an admin uploaded —
 * "removing" one is really just resetting it to its designed position
 * (see lib/museum/aboutRoomBlocks.ts; the scene-objects GET
 * re-provisions any missing one at 0,0,0 on next load), never actually
 * removing something from the room the way it does for a custom prop. */
function isAboutBlockKind(kind: string): boolean {
  return (ABOUT_BLOCK_KINDS as readonly string[]).includes(kind);
}
/** About blocks with an editable heading banner (AboutLabelConfig JSON in
 *  modelUrl) — Certs, Calling Card, Timeline & Gigs. */
function isAboutLabelKind(kind: string): boolean {
  return kind === ABOUT_CERTS_KIND || kind === ABOUT_CARD_KIND || kind === ABOUT_GIGS_KIND;
}
// Unlike the About blocks, the Freedom Wall plaque IS genuinely removable —
// an admin who doesn't want one showing can delete it like any decorative
// object (Recently Removed keeps a quick Restore for the rest of the
// session). If it's still gone on the next full load, the scene-objects GET
// re-provisions a fresh default one (see freedomWallRoom.ts's
// ensureFreedomWallBanner) so the room is never permanently stuck without a
// title display by accident.
function isResetOnlyKind(kind: string, clockIsProvisioned: boolean): boolean {
  // The Contact Desk and the wall clock are provisioned rather than uploaded
  // (see ensureAboutContactDesk / ensureWallClock), so the scene-objects GET
  // puts a fresh one back on the next load — "remove" can only ever mean
  // "put it back where it started".
  //
  // The clock is the one exception, because it is the one fixture that isn't
  // tied to a single room: it is re-provisioned for the About room and for
  // whichever room a visitor respawns into, so in a room that has since lost
  // the respawn point nothing puts it back and Remove genuinely removes it.
  if (kind === ABOUT_CLOCK_KIND) return clockIsProvisioned;
  return isAboutBlockKind(kind) || kind === ABOUT_CONTACT_KIND;
}
/** Kinds placed the free way (drag/turn/Size slider) that still aren't
 *  admin-uploaded props — they carry no Name field, since their own config
 *  panel names them. */
function isAboutFixtureKind(kind: string): boolean {
  return kind === ABOUT_CONTACT_KIND || kind === ABOUT_CLOCK_KIND;
}
/**
 * Fixtures — provisioned by code rather than uploaded by an admin, and put
 * back by that same code whenever they go missing. Removing one therefore
 * never removed it, which is why these and only these get "Hide from
 * Museum": it is the only way to actually not have a Contact Desk, or a
 * Certificates Strip in a room whose artist has no certificates.
 *
 * A `custom` .glb prop or a text label is left out on purpose. Nothing
 * re-provisions those, so Remove already means what it says for them, and a
 * second near-synonym in the same panel would only muddy which one is which.
 */
function isHideableKind(kind: string): boolean {
  return (
    isAboutBlockKind(kind) ||
    isAboutFixtureKind(kind) ||
    kind === FREEDOM_WALL_BANNER_KIND
  );
}
function isTextKind(kind: string): boolean {
  return kind === "text";
}
/** A freestanding partition wall (lib/museum/wallDivider.ts) — placed and
 *  turned like a decorative prop, but sized by its own Width/Height/Thickness
 *  sliders rather than a uniform Size multiplier, and solid by default. */
function isDividerKind(kind: string): boolean {
  return kind === DIVIDER_KIND;
}
// The plaque's content always tracks the active FreedomWallEvent — renaming
// it in Freedom Wall admin tab is the only way to change what it says. Its
// own side panel here only ever edits colors, never text/font/size, so it
// gets a dedicated check rather than joining isTextKind's Text Label panel.
/**
 * Confirmation for a slider that writes straight to its config row as you drag
 * it (the Room Banner and Cosplay Room panels), spread onto the `<input>`.
 *
 * Those two panels are the ones with no Save button behind them: every other
 * slider here edits the editor's own buffer, where the toolbar's dirty state
 * and Save are the confirmation, and a toast per slider would be both noisy and
 * a lie about what has been persisted. These genuinely had none — the value
 * moved, the 3D preview moved, and nothing ever said the room had kept it.
 *
 * Fired on release rather than on change, because these save on every drag
 * step: one toast for the gesture, not forty. The sound rides along for free —
 * lib/toast plays toast.success on every success toast (see lib/sound), which
 * is why this is a plain toast call and not a second playSoundEffect.
 */
function sliderCommit(message: string) {
  const announce = () => toast.success(message);
  return {
    // Pointer events cover mouse, pen and touch in one handler. `cancel` fires
    // instead of `up` when the gesture is interrupted (a system gesture, a
    // scroll taking over) — the value is already saved by then either way, so
    // both deserve the same confirmation.
    onPointerUp: announce,
    onPointerCancel: announce,
    // A range input is fully keyboard-operable, and none of the above fires for
    // an admin nudging it with the arrow keys.
    onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (SLIDER_KEYS.has(e.key)) announce();
    },
  };
}
const SLIDER_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown",
]);

/** What each room actually calls the labels this styles, so the panel names
 *  the thing the admin is looking at rather than "banners" in the abstract. */
const ROOM_BANNER_BLURB: Record<BannerRoomType, string> = {
  STORIES: "The plaque under every pedestal — the story's title and its type.",
  ARCADE: "Every cabinet's marquee and every poster's caption strip.",
  SERVICES: "The price tag under every product frame.",
  ABOUT:
    "The finish on this room's headings. Each heading keeps its own wording, size, font and colour — select the block to change those.",
  COSPLAY: "The label at every standee's foot — name, series, event and credits.",
};

function isBannerKind(kind: string): boolean {
  return kind === FREEDOM_WALL_BANNER_KIND;
}
/** An admin-placed titled plaque (lib/museum/sceneBanner.ts). Distinct from
 *  isBannerKind above despite sharing a renderer: that one is the Freedom
 *  Wall's fixture, whose wording comes from the active event and is therefore
 *  *not* editable here, while this one's whole point is that the admin types
 *  it. Two panels, because they offer different fields. */
function isSceneBannerKind(kind: string): boolean {
  return kind === BANNER_KIND;
}
const WALL_SIDE_LABEL: Record<WallDefinition["id"], string> = {
  north: "North",
  south: "South",
  east: "East",
  west: "West",
  // Never shown on its own — a divider zone is named after the panel it
  // belongs to instead (see wallLabel below), since a room can hold several.
  divider: "Divider",
};
/** "North", or "North (Left of Door)" when this wall's own doorway split
 * it into two flanking placement zones — see framePlacement.ts's
 * doorwayFlankZones. */
function wallLabel(wall: WallDefinition, dividerNames?: Map<string, string>): string {
  if (wall.id === "divider") {
    const name = (wall.dividerId && dividerNames?.get(wall.dividerId)) || DIVIDER_LABEL;
    return `${name} · ${wall.face === "back" ? "Back" : "Front"}`;
  }
  const base = WALL_SIDE_LABEL[wall.id];
  if (!wall.segment) return base;
  return `${base} (${wall.segment === "left" ? "Left" : "Right"} of Door)`;
}
function sameWall(a: WallDefinition, b: WallDefinition): boolean {
  // A divider's two faces share an id and carry no segment, so those two
  // fields alone would report the front of one panel as the back of another.
  return a.id === b.id && a.segment === b.segment && a.dividerId === b.dividerId && a.face === b.face;
}
const SCALE_MIN = 0.5;
const SCALE_MAX = 2.5;
// Wider range than an artwork frame's — an uploaded .glb can be exported at
// almost any size, so a decorative prop often needs to shrink or grow well
// past the ±2.5× a frame ever does before it fits the room.
const MODEL_SCALE_MIN = 0.1;
const MODEL_SCALE_MAX = 5;

// --- Model units ---------------------------------------------------------
// The museum is metres: a room is 20m across and 5m tall (roomConstants.ts).
// A .glb carries no unit declaration, only numbers, and plenty of them are
// authored in centimetres — anything routed through FBX (most Sketchfab
// downloads) usually is. Such a model arrives a hundred times too big:
// a stained-glass window measuring 3389 x 5626 units is a 3.4km x 5.6km
// object dropped into a 20m room. Nothing is broken and nothing errors —
// the admin simply sees an empty room, because they are standing inside a
// wall of it, and the Size slider's 0.1x floor cannot get anywhere near the
// ~0.0004 needed to fix it.
//
// So a model whose largest dimension lands outside the plausible range below
// is treated as being in another unit, and the editor works in multiples of
// the scale that brings it to MODEL_FIT_TARGET instead of multiples of its
// exported size. A normally-authored model measures inside the range, gets a
// unit scale of exactly 1, and behaves precisely as it always has.
/**
 * Largest dimension, in metres, a prop can have and still be believed.
 *
 * Deliberately far past anything usable — three times the width of a room —
 * because the cost of the two mistakes isn't symmetric. Failing to catch a
 * badly-scaled model leaves the admin with an invisible prop and a puzzle,
 * which is the bug being fixed and is at least recoverable by hand. Catching
 * a legitimate one resizes something an admin was happy with, which is a
 * change nobody asked for. So this line asks "could this possibly be
 * intentional?" rather than "is this a sensible size?" — a 16m backdrop is
 * odd but it fits in a room and is plainly visible, so it is left alone; a
 * 5,626m one cannot be anything but a unit mismatch.
 */
const MODEL_SANE_MAX_SPAN = 60;
/** ...and the small end, on the same principle. A 1cm prop is eccentric but
 *  possible; a 0.1mm one is centimetres-read-as-metres in the other
 *  direction (a model authored in kilometres, or scaled down in the editor
 *  it came from). */
const MODEL_SANE_MIN_SPAN = 0.01;
/** What an out-of-range model's largest dimension is scaled to — roughly a
 *  door's height, big enough to find in the room and adjust from. */
const MODEL_FIT_TARGET = 2;

/**
 * The scale at which one unit of this model reads as one metre — 1 when the
 * model already measures like metres, and the fit-to-target scale when it
 * plainly doesn't. Returns 1 while the model is still loading (span 0), so
 * nothing is guessed before it has been measured.
 */
function modelUnitScale(nativeSpan: number | undefined): number {
  if (!nativeSpan || !Number.isFinite(nativeSpan) || nativeSpan <= 0) return 1;
  if (nativeSpan <= MODEL_SANE_MAX_SPAN && nativeSpan >= MODEL_SANE_MIN_SPAN) return 1;
  return MODEL_FIT_TARGET / nativeSpan;
}
const PAGE_SIZE_OPTIONS = [5, 10] as const;
const MAX_MODEL_SIZE = 100 * 1024 * 1024; // 100 MB — uploaded directly to Supabase Storage, see uploadModelViaSignedUrl

type Selection =
  | { type: "scene"; id: string }
  | { type: "artwork"; id: string }
  | { type: "podium"; id: string }
  | { type: "cabinet"; id: string }
  | { type: "standee"; id: string }
  | { type: "note"; id: string }
  | null;

const NOTE_SCALE_MIN = 0.5;
const NOTE_SCALE_MAX = 2.5;
// Same palette keys/dots as FreedomWallTab.tsx's COLOR_DOT — duplicated
// rather than shared since that file is a whole separate admin panel with
// its own imports, and this is the only spot here that needs it.
const NOTE_COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-300",
  pink:   "bg-pink-300",
  blue:   "bg-sky-300",
  green:  "bg-emerald-300",
  purple: "bg-violet-300",
  orange: "bg-orange-300",
};

interface HistorySnapshot {
  sceneObjects: SceneObject[];
  artworks: ArtworkEntry[];
  stories: StoryEntry[];
  miniGames: MiniGameEntry[];
  cosplays: CosplayEntry[];
  freedomWallNotes: FreedomWallNotePublic[];
}

// A doorway wall now splits into two flanking zones (see framePlacement.ts's
// doorwayFlankZones) that share the same id AND rotationY, so angle alone
// can no longer tell them apart — first narrow to walls facing the item's
// own rotationY, then disambiguate by which zone's free-axis range the
// item's current position actually falls in (or, for a stale/out-of-range
// position, whichever zone's range is nearest).
function nearestWall(
  walls: WallDefinition[],
  item: { positionX: number; positionZ: number; rotationY: number }
): WallDefinition {
  const facing = walls.filter((w) => {
    const diff = Math.abs(Math.atan2(Math.sin(item.rotationY - w.rotationY), Math.cos(item.rotationY - w.rotationY)));
    return diff < 0.1;
  });
  const pool = facing.length > 0 ? facing : walls;
  const rangeDistance = (w: WallDefinition) => {
    // Projected onto the wall's own axis rather than read off X or Z — a
    // divider face can stand at any angle, so neither world axis is "the
    // free one" for it (see framePlacement.ts's wallFreeCoord).
    const free = wallFreeCoord(w, item.positionX, item.positionZ);
    if (free >= w.freeMin && free <= w.freeMax) return 0;
    return Math.min(Math.abs(free - w.freeMin), Math.abs(free - w.freeMax));
  };
  return pool.reduce((closest, w) => (rangeDistance(w) < rangeDistance(closest) ? w : closest), pool[0]);
}

/** Where the Collision Height slider starts for a prop whose model hasn't
 *  reported its own reach yet (a .glb still loading). Roughly waist height in
 *  metres — low enough that the admin can see the change immediately, and
 *  obviously a starting point rather than a considered value. */
const FALLBACK_COLLIDER_HEIGHT = 1;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// A color swatch paired with a manually-typeable hex field — the swatch
// alone (a bare <input type="color">) never lets an admin paste/type an
// exact hex they already have on hand. Keeps its own draft state so a
// half-typed value (e.g. "#0") isn't stomped mid-keystroke by the last
// committed color; only a syntactically valid #rrggbb ever reaches
// onChange, and losing focus on anything else snaps the field back to the
// last valid value instead of leaving it stuck.
function HexColorField({
  value,
  onChange,
  onBeginEdit,
}: {
  value: string;
  onChange: (hex: string) => void;
  /** Fired once when a drag/edit starts, so the undo stack snapshots the
   *  pre-edit state exactly once rather than per keystroke or per drag frame. */
  onBeginEdit: () => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit(raw: string) {
    const v = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (HEX_COLOR_RE.test(v)) {
      onChange(v.toLowerCase());
    } else {
      setDraft(value);
    }
  }

  return (
    // Its own wrapper, not a fragment.
    //
    // As a fragment the swatch and the hex box were two *separate* children of
    // whatever row used it — and nearly every row here is
    // `flex items-center justify-between`, which then spread all three items
    // (label, swatch, box) across the full width instead of two. Two call
    // sites had added a grouping div of their own and the other twelve had
    // not, so the swatches sat at two different x positions down the panel —
    // most visibly in the Cosplay Room, where a grouped "Panel Frame" sits
    // directly above a bare "Panel Edge".
    //
    // Grouping here rather than at each call site means a row can never get
    // this wrong again, and the group's width is fixed (32px swatch + 8px gap
    // + 80px box), so every swatch lines up in a column no matter how long its
    // label is. `shrink-0` keeps it that way next to a long label.
    <div className="flex items-center gap-2 shrink-0">
      <input
        type="color"
        value={value}
        onPointerDown={onBeginEdit}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer bg-transparent shrink-0"
      />
      <input
        type="text"
        value={draft}
        onFocus={onBeginEdit}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(draft);
            e.currentTarget.blur();
          }
        }}
        spellCheck={false}
        maxLength={7}
        className="admin-input rounded-md px-2 py-1 text-[11px] tabular-nums font-body w-20 shrink-0"
      />
    </div>
  );
}

export function MuseumEditorClient({
  room,
  hasNorthOpening,
  hasSouthOpening,
  aboutData,
  freedomWallNotes: initialFreedomWallNotes = [],
  freedomWallEventTitle = null,
}: {
  room: RoomShell;
  hasNorthOpening: boolean;
  hasSouthOpening: boolean;
  /** Only set for the About room — see page.tsx. */
  aboutData: MuseumAboutData | null;
  /** Only set for the Freedom Wall room — active event's non-archived notes,
   * each individually selectable/draggable/resizable exactly like an
   * artwork frame (see EditableStickyNote in MuseumEditorScene.tsx). */
  freedomWallNotes?: FreedomWallNotePublic[];
  /** The active event's title — the banner's blank-text fallback preview
   *  (see lib/museum/freedomWallBanner.ts). */
  freedomWallEventTitle?: string | null;
}) {
  const [sceneObjects, setSceneObjects] = useState<SceneObject[] | null>(null);
  const [artworks, setArtworks] = useState<ArtworkEntry[]>(room.artworks);
  const [stories, setStories] = useState<StoryEntry[]>(room.stories ?? []);
  const [miniGames, setMiniGames] = useState<MiniGameEntry[]>(room.miniGames ?? []);
  const [cosplays, setCosplays] = useState<CosplayEntry[]>(room.cosplays ?? []);
  const [freedomWallNotes, setFreedomWallNotes] = useState<FreedomWallNotePublic[]>(initialFreedomWallNotes);
  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<SceneMode>("translate");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<SceneObject | null>(null);
  function openDeleteConfirm(object: SceneObject) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(object);
  }
  const [deleting, setDeleting] = useState(false);
  // Sticky-note delete confirmation — same soft-delete-to-Trash flow as
  // FreedomWallTab.tsx's own per-note delete, reachable here too so an admin
  // repositioning notes doesn't have to leave the Scene Editor to remove one.
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<FreedomWallNotePublic | null>(null);
  function openDeleteNoteConfirm(note: FreedomWallNotePublic) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteNoteTarget(note);
  }
  const [deletingNote, setDeletingNote] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [removingArtworkId, setRemovingArtworkId] = useState<string | null>(null);
  // Editor-only "hide" — never persisted, never touches the live museum
  // (see the request: a workspace-declutter tool, not a visibility flag).
  // Cleared automatically the moment a hidden item would otherwise be
  // orphaned (removed/restored elsewhere) via the filters below.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Recently soft-deleted objects this session — offers a quick
  // "Restore" without leaving for the Trash module. Cleared on unmount
  // (a fresh page load re-fetches from the server, which no longer
  // includes them, same as Trash's own "soft delete" semantics).
  const [recentlyDeleted, setRecentlyDeleted] = useState<SceneObject[]>([]);
  const [artworkPage, setArtworkPage] = useState(1);
  const [artworkPageSize, setArtworkPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(5);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // The toolbar's "Add ▾" menu (Text / Banner / Divider / Object).
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // "Replace" — swap the .glb under the selected prop, keeping its placement.
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  // Optional name typed in the upload modal, stored on the new object's
  // `label` so it shows in the list instead of the generic "Decorative
  // Object". Cleared whenever the modal opens or closes.
  const [newObjectName, setNewObjectName] = useState("");
  // Auto-measured footprint radius (model units) per custom scene object,
  // reported by MuseumEditorScene once each .glb loads — the "auto-fit"
  // default for the Solid collider. Not persisted; recomputed every open.
  const [measuredRadii, setMeasuredRadii] = useState<Record<string, number>>({});
  // Largest dimension (model units, unclamped) per custom object, from the
  // same measurement — what tells a model authored in metres from one
  // authored in centimetres. See modelUnitScale.
  const [measuredSpans, setMeasuredSpans] = useState<Record<string, number>>({});
  // The circle that actually wraps each model — centre + half-width, model
  // units — from the same measurement. What "Fit to model" writes, and what
  // switching Solid on uses for a prop that has no stored footprint yet.
  const [measuredFits, setMeasuredFits] = useState<Record<string, ModelFit>>({});
  const handleMeasureSceneObject = useCallback((id: string, r: number, span: number, fit: ModelFit) => {
    setMeasuredRadii((prev) => (Math.abs((prev[id] ?? -1) - r) < 0.001 ? prev : { ...prev, [id]: r }));
    setMeasuredSpans((prev) => (prev[id] === span ? prev : { ...prev, [id]: span }));
    setMeasuredFits((prev) => {
      const cur = prev[id];
      if (
        cur &&
        Math.abs(cur.radius - fit.radius) < 0.001 &&
        Math.abs(cur.offsetX - fit.offsetX) < 0.001 &&
        Math.abs(cur.offsetZ - fit.offsetZ) < 0.001
      ) {
        return prev;
      }
      return { ...prev, [id]: fit };
    });
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const podiumModelInputRef = useRef<HTMLInputElement>(null);
  const cabinetModelInputRef = useRef<HTMLInputElement>(null);
  const standeeModelInputRef = useRef<HTMLInputElement>(null);
  // Unsaved-changes guard: shown when the user tries to navigate away
  // with dirty=true — mirrors the existing "Unsaved changes" hint text
  // but as a blocking modal rather than a silent label.
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const pendingNavRef = useRef<string | null>(null);
  const router = useRouter();

  const [undoStack, setUndoStack] = useState<HistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);

  // Plaque display config — local state kept in sync with the selected
  // about-plaque SceneObject's modelUrl JSON. Initialised from the existing
  // stored value (or defaults) whenever a plaque block is selected.
  const [plaqueConfig, setPlaqueConfig] = useState<Required<PlaqueConfig>>(DEFAULT_PLAQUE_CONFIG);
  // The plaque has a lot of controls — split into tabs so the 3D preview
  // stays visible while an admin scrolls this panel.
  const [plaqueTab, setPlaqueTab] = useState<"glass" | "text" | "skills">("glass");
  const [contactConfig, setContactConfig] = useState<Required<ContactDeskConfig>>(
    DEFAULT_CONTACT_DESK_CONFIG
  );
  const contactModelInputRef = useRef<HTMLInputElement>(null);
  // Wall clock config — same pattern again (lib/museum/aboutRoomBlocks.ts's
  // WallClockConfig).
  const [clockConfig, setClockConfig] = useState<Required<WallClockConfig>>(
    DEFAULT_WALL_CLOCK_CONFIG
  );

  // Text-label config — same pattern as plaqueConfig; synced whenever a
  // "text" kind SceneObject is selected.
  const [textConfig, setTextConfig] = useState<Required<TextObjectConfig>>(DEFAULT_TEXT_CONFIG);
  // The selected divider wall's size/surface config — same "mirror the
  // selected object's JSON into local state, write it back on every edit"
  // pattern textConfig above uses.
  const [dividerConfig, setDividerConfig] = useState<Required<WallDividerConfig>>(DEFAULT_DIVIDER_CONFIG);
  const [sceneBannerConfig, setSceneBannerConfig] =
    useState<Required<SceneBannerConfig>>(DEFAULT_BANNER_CONFIG);

  // About-block label config (Certs heading / Calling Card title) — same
  // pattern; synced whenever an ABOUT_CERTS_KIND / ABOUT_CARD_KIND block is
  // selected. Seeded with that kind's own defaults.
  const [aboutLabelConfig, setAboutLabelConfig] =
    useState<Required<AboutLabelConfig>>(DEFAULT_CERTS_LABEL_CONFIG);

  // Per-certificate nudges on the Certificates Strip — same mirror-the-JSON
  // pattern once more, sharing the strip's modelUrl with the label config
  // above (see mergeSceneObjectConfig). `certPlacementTarget` is which
  // certificate the sliders below are pointed at: "all" leaves them driving
  // the strip as a whole, which is the existing Wall / Hang Width / Hang
  // Height / Resize block and the only control most rooms ever need.
  const [certPlacements, setCertPlacements] = useState<CertPlacementMap>({});
  const [certPlacementTarget, setCertPlacementTarget] = useState<string>("all");

  // Freedom Wall plaque style — same pattern as plaqueConfig/textConfig;
  // synced whenever the plaque (FREEDOM_WALL_BANNER_KIND) is selected. Holds
  // colors plus the title's font/size, but never the text itself — the
  // plaque's content is always the active event's title, not admin-typed.
  const [bannerColors, setBannerColors] = useState<Required<BannerColors>>(DEFAULT_BANNER_COLORS);

  // Scene dark mode preview — toggles the 3D scene's own dark/light
  // rendering (MuseumRoom + AboutRoomContents) so the admin can see how the
  // room looks in both themes without changing the site-wide CSS theme.
  const [sceneDarkMode, setSceneDarkMode] = useState(false);
  // Share 360° — the same bridge the public museum's button uses
  // (Room360Capture.tsx, mounted inside MuseumEditorScene's Canvas), so an
  // admin can post a room *as it looks right now*, unsaved edits included:
  // the capture reads the live scene graph, not the database.
  const share360Ref = useRef<Share360Fn | null>(null);
  const [share360, setShare360] = useState<Panorama360Result | null>(null);
  const [rendering360, setRendering360] = useState(false);
  const handleShare360 = useCallback(async () => {
    if (rendering360 || !share360Ref.current) return;
    setRendering360(true);
    const toastId = toast.loading("Rendering 360°…");
    try {
      const result = await share360Ref.current();
      if (result) setShare360(result);
    } catch {
      toast.error("Couldn't render the 360° photo — try again");
    } finally {
      toast.dismiss(toastId);
      setRendering360(false);
    }
  }, [rendering360]);

  // Global brightness — fetched from the museum config on mount, saved back
  // on slider commit (mouseup/touchend). These are the same
  // museumBrightnessLight / museumBrightnessDark fields the public museum
  // uses, so what you see here is exactly what visitors see.
  const [localBrightnessLight, setLocalBrightnessLight] = useState(50);
  const [localBrightnessDark, setLocalBrightnessDark] = useState(50);

  useEffect(() => {
    fetch("/api/digital-museum")
      .then((r) => r.json())
      .then((data: { museumBrightnessLight?: number; museumBrightnessDark?: number }) => {
        if (typeof data.museumBrightnessLight === "number") setLocalBrightnessLight(Math.min(100, Math.max(0, data.museumBrightnessLight)));
        if (typeof data.museumBrightnessDark  === "number") setLocalBrightnessDark(Math.min(100, Math.max(0, data.museumBrightnessDark)));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBrightness(patch: { brightnessLight?: number; brightnessDark?: number }) {
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(patch.brightnessLight !== undefined && { museumBrightnessLight: patch.brightnessLight }),
          ...(patch.brightnessDark  !== undefined && { museumBrightnessDark:  patch.brightnessDark  }),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Brightness saved");
    } catch {
      toast.error("Failed to save brightness");
    }
  }

  useLockBodyScroll(
    Boolean(deleteConfirm) || Boolean(deleteNoteTarget) || uploadModalOpen || replaceModalOpen || leaveConfirmOpen
  );

  // Whether a removed wall clock would come back on the next load — true in
  // the two rooms it is provisioned for (see lib/museum/wallClock.ts), which
  // is what decides whether its Remove button is really a Reset.
  const clockIsProvisioned = room.roomType === "ABOUT" || room.isEntryRoom;

  const { width, depth } = getRoomSize(room.roomType);
  const walls = useMemo(
    () => getWallDefinitions(width, depth, hasNorthOpening, hasSouthOpening),
    [width, depth, hasNorthOpening, hasSouthOpening]
  );
  // Grouped by wall id, each group rendered as its own row (see the wall
  // picker below) — a plain 2-column grid over the flat `walls` list put
  // a doorway's "Left of Door"/"Right of Door" pair in the same row only
  // by coincidence of parity: with both north and south split (6 zones
  // total), north's pair lands in row 1 as intended, but the array order
  // (north-left, north-right, east, south-left, south-right, west) pushes
  // south's pair across a row boundary — south-left ends one row, south-
  // right starts the next. Grouping first guarantees siblings always
  // share a row regardless of how many zones anything else has.
  const wallGroups = useMemo(() => {
    const groups: WallDefinition[][] = [];
    for (const wall of walls) {
      const group = groups.find((g) => g[0].id === wall.id);
      if (group) group.push(wall);
      else groups.push([wall]);
    }
    return groups;
  }, [walls]);

  // Every divider currently in the room, in the order they were added —
  // numbered so the wall picker can tell one panel from another ("Divider
  // Wall 2 · Back") without asking an admin to name them first.
  const dividerObjects = useMemo(
    () => (sceneObjects ?? []).filter((o) => isDividerKind(o.kind)),
    [sceneObjects]
  );
  // Only used to stagger where the next Add Banner drops (see
  // addBannerObject) — banners aren't hangable surfaces the way dividers are,
  // so nothing else needs to enumerate them.
  const bannerObjects = useMemo(
    () => (sceneObjects ?? []).filter((o) => isSceneBannerKind(o.kind)),
    [sceneObjects]
  );
  const dividerNames = useMemo(() => {
    const names = new Map<string, string>();
    dividerObjects.forEach((o, i) => {
      names.set(o.id, o.label?.trim() || `${DIVIDER_LABEL} ${i + 1}`);
    });
    return names;
  }, [dividerObjects]);

  // Artworks can hang on a divider's two faces as well as the room's own
  // walls — that is the whole point of putting one in a gallery. Recomputed
  // from the dividers' live placements, so moving or resizing a panel
  // immediately re-aims the buttons at where it now stands.
  //
  // Sticky notes deliberately keep the plain `walls` list: a note stores
  // which wall it is pinned to as a north/south/east/west value
  // (FreedomWallNote.wall), and there is no such value for a divider.
  const artworkWalls = useMemo(() => {
    const dividerWalls = getDividerWallDefinitions(
      dividerObjects.map((o) => {
        const cfg = parseWallDividerConfig(o.modelUrl);
        return {
          id: o.id,
          positionX: o.positionX,
          positionZ: o.positionZ,
          rotationY: o.rotationY,
          width: cfg.width,
          thickness: cfg.thickness,
        };
      })
    );
    return [...walls, ...dividerWalls];
  }, [walls, dividerObjects]);

  /** Which divider face — if any — a placed artwork is hanging on. Thin
   *  wrapper over the shared matcher so this file talks in artwork rows; the
   *  museum applies the same one while rendering (see MuseumScene), which is
   *  what keeps the editor's preview and the real room in agreement. */
  const dividerFaceFor = useCallback(
    (item: { positionX: number; positionZ: number; rotationY: number }) =>
      snapToDividerFace(artworkWalls, {
        x: item.positionX,
        z: item.positionZ,
        rotationY: item.rotationY,
      }),
    [artworkWalls]
  );

  // Keep art hung on a divider *on* that divider.
  //
  // The museum already corrects this while rendering, so the room a visitor
  // walks into is right either way. Writing it back here is what makes the
  // editor's own numbers agree with what it draws — otherwise the side panel
  // would go on reporting the stale point, and the next drag of the frame
  // would start from a position it isn't actually at.
  useEffect(() => {
    if (artworks.length === 0) return;
    let changed = false;
    const next = artworks.map((a) => {
      if (a.positionX == null || a.positionZ == null || a.rotationY == null) return a;
      const snapped = dividerFaceFor({
        positionX: a.positionX,
        positionZ: a.positionZ,
        rotationY: a.rotationY,
      });
      if (!snapped) return a;
      // Sub-millimetre drift is float noise, not a move — reacting to it would
      // rewrite state on every render and never settle.
      if (Math.abs(snapped.x - a.positionX) < 1e-3 && Math.abs(snapped.z - a.positionZ) < 1e-3) {
        return a;
      }
      changed = true;
      return { ...a, positionX: snapped.x, positionZ: snapped.z, rotationY: snapped.rotationY };
    });
    if (changed) setArtworks(next);
    // Deliberately not depending on `artworks`: this writes to them, and the
    // no-op guard above is what stops it looping. It needs to run when a
    // divider moves or resizes, which is exactly what artworkWalls tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artworkWalls]);

  // Same grouping as wallGroups above, but each divider's front/back pair
  // shares a row rather than every divider zone landing in one — grouping by
  // id alone would put four faces of two panels on a single line.
  const artworkWallGroups = useMemo(() => {
    const groups: WallDefinition[][] = [];
    for (const wall of artworkWalls) {
      const key = wall.id === "divider" ? `divider:${wall.dividerId}` : wall.id;
      const group = groups.find(
        (g) => (g[0].id === "divider" ? `divider:${g[0].dividerId}` : g[0].id) === key
      );
      if (group) group.push(wall);
      else groups.push([wall]);
    }
    return groups;
  }, [artworkWalls]);

  // Same layout every visitor's browser computes — an untouched frame's
  // starting point in this editor is exactly where it already hangs live,
  // not some separate "editor default".
  const autoPlacements = useMemo(
    () => computeFramePlacements(artworks.length, width, depth, hasNorthOpening, hasSouthOpening),
    [artworks.length, width, depth, hasNorthOpening, hasSouthOpening]
  );

  const artworkItems: EditableArtworkItem[] = useMemo(
    () =>
      artworks.map((entry, i) => {
        const hasCustomPosition =
          entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null;
        const auto = autoPlacements[i];
        return {
          id: entry.id,
          title: entry.artwork.title,
          imageUrl: entry.artwork.imageUrl,
          positionX: hasCustomPosition ? entry.positionX! : auto?.position[0] ?? 0,
          positionY: hasCustomPosition ? entry.positionY! : auto?.position[1] ?? FRAME_CENTER_Y,
          positionZ: hasCustomPosition ? entry.positionZ! : auto?.position[2] ?? 0,
          rotationY: hasCustomPosition ? entry.rotationY! : auto?.rotationY ?? 0,
          scale: entry.scale ?? 1,
          hasCustomPosition,
        };
      }),
    [artworks, autoPlacements]
  );

  // Podiums — the Stories Room's floor-standing contents. Same
  // "override else fall back to the auto layout" shape as artworkItems
  // above, just against a floor grid instead of a wall walk.
  const autoPodiumPlacements = useMemo(
    () => computePodiumPlacements(stories.length, width, depth),
    [stories.length, width, depth]
  );

  const podiumItems: EditablePodiumItem[] = useMemo(
    () =>
      stories.map((entry, i) => {
        const hasCustomPosition =
          entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null;
        const auto = autoPodiumPlacements[i];
        return {
          id: entry.id,
          title: entry.story.title,
          type: entry.story.type,
          coverImageUrl: entry.story.coverImageUrl,
          positionX: hasCustomPosition ? entry.positionX! : auto?.position[0] ?? 0,
          positionY: hasCustomPosition ? entry.positionY! : auto?.position[1] ?? 0,
          positionZ: hasCustomPosition ? entry.positionZ! : auto?.position[2] ?? 0,
          rotationY: hasCustomPosition ? entry.rotationY! : auto?.rotationY ?? 0,
          scale: entry.scale ?? 1,
          hasCustomPosition,
        };
      }),
    [stories, autoPodiumPlacements]
  );

  // The Stories Room's optional pedestal .glb (see storyPodiumModel.ts).
  // Configuration, not a placement — it's never in the objects list or the
  // 3D preview, it just changes what every podium's base is built from.
  const podiumModelObject = useMemo(
    () => (sceneObjects ?? []).find((o) => o.kind === STORY_PODIUM_MODEL_KIND) ?? null,
    [sceneObjects]
  );
  const podiumModelConfig = useMemo(
    () => parsePodiumModelConfig(podiumModelObject?.modelUrl),
    [podiumModelObject]
  );

  const visiblePodiumItems = useMemo(
    () => podiumItems.filter((p) => !hiddenIds.has(p.id)),
    [podiumItems, hiddenIds]
  );

  // Arcade cabinets — the Arcade Room's floor-standing contents. Same
  // "override else fall back to the auto grid" shape as podiums above.
  const arcadeConfigObject = useMemo(
    () => (sceneObjects ?? []).find((o) => o.kind === ARCADE_CONFIG_KIND) ?? null,
    [sceneObjects]
  );
  const arcadeConfig = useMemo(
    () => parseArcadeConfig(arcadeConfigObject?.modelUrl),
    [arcadeConfigObject]
  );
  const arcadeDefaultMode: ArcadeDisplayMode = arcadeConfig.defaultMode;
  const autoCabinetPlacements = useMemo(
    () => computeCabinetPlacements(miniGames.length, width, depth),
    [miniGames.length, width, depth]
  );
  const cabinetItems: EditableCabinetItem[] = useMemo(
    () =>
      miniGames.map((entry, i) => {
        const hasCustomPosition =
          entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null;
        const auto = autoCabinetPlacements[i];
        return {
          id: entry.id,
          title: GAME_REGISTRY[entry.game.type as keyof typeof GAME_REGISTRY]?.name ?? entry.game.type,
          imageUrl: entry.game.artwork?.imageUrl ?? null,
          subtitle: DIFFICULTY_LABELS[entry.game.difficulty],
          mode: normalizeArcadeMode(entry.displayMode) ?? arcadeDefaultMode,
          positionX: hasCustomPosition ? entry.positionX! : auto?.position[0] ?? 0,
          positionY: hasCustomPosition ? entry.positionY! : auto?.position[1] ?? 0,
          positionZ: hasCustomPosition ? entry.positionZ! : auto?.position[2] ?? 0,
          rotationY: hasCustomPosition ? entry.rotationY! : auto?.rotationY ?? 0,
          scale: entry.scale ?? 1,
          hasCustomPosition,
        };
      }),
    [miniGames, autoCabinetPlacements, arcadeDefaultMode]
  );
  const visibleCabinetItems = useMemo(
    () => cabinetItems.filter((c) => !hiddenIds.has(c.id)),
    [cabinetItems, hiddenIds]
  );

  // Cosplay standees — the Cosplay Room's contents. Same "override else fall
  // back to the auto layout" shape as podiums above, against the perimeter walk
  // (standeePlacement.ts) rather than a floor grid, so it needs the room's real
  // doorway flags the way the artwork frames do.
  const standeeConfigObject = useMemo(
    () => (sceneObjects ?? []).find((o) => o.kind === COSPLAY_STANDEE_MODEL_KIND) ?? null,
    [sceneObjects]
  );
  const standeeConfig = useMemo(
    () => parseCosplayStandeeConfig(standeeConfigObject?.modelUrl),
    [standeeConfigObject]
  );

  // The room-wide plaque style (lib/museum/roomBanner.ts) — one row per room,
  // read by every label that room draws. Absent for a room type that has no
  // plaque, which is what hides the whole section below.
  const roomBannerObject = useMemo(
    () => (sceneObjects ?? []).find((o) => o.kind === ROOM_BANNER_KIND) ?? null,
    [sceneObjects]
  );
  const roomBannerStyle = useMemo(
    () =>
      parseRoomBannerStyle(
        roomBannerObject?.modelUrl,
        defaultRoomBannerStyle(room.roomType as BannerRoomType)
      ),
    [roomBannerObject, room.roomType]
  );
  const autoStandeePlacements = useMemo(
    () => computeStandeePlacements(cosplays.length, width, depth, hasNorthOpening, hasSouthOpening),
    [cosplays.length, width, depth, hasNorthOpening, hasSouthOpening]
  );
  const standeeItems: EditableStandeeItem[] = useMemo(
    () =>
      cosplays.map((entry, i) => {
        const hasCustomPosition =
          entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null;
        const auto = autoStandeePlacements[i];
        return {
          id: entry.id,
          title: entry.cosplay.title,
          character: entry.cosplay.character,
          series: entry.cosplay.series,
          standeeImageUrl: entry.cosplay.standeeImageUrl,
          backdropImageUrl: entry.cosplay.backdropImageUrl,
          year: entry.cosplay.year,
          event: entry.cosplay.event,
          cosplayer: entry.cosplay.cosplayer,
          photographer: entry.cosplay.photographer,
          positionX: hasCustomPosition ? entry.positionX! : auto?.position[0] ?? 0,
          positionY: hasCustomPosition ? entry.positionY! : auto?.position[1] ?? 0,
          positionZ: hasCustomPosition ? entry.positionZ! : auto?.position[2] ?? 0,
          rotationY: hasCustomPosition ? entry.rotationY! : auto?.rotationY ?? 0,
          scale: entry.scale ?? 1,
          hasCustomPosition,
          lightsEnabled: entry.lightsEnabled,
        };
      }),
    [cosplays, autoStandeePlacements]
  );
  const visibleStandeeItems = useMemo(
    () => standeeItems.filter((c) => !hiddenIds.has(c.id)),
    [standeeItems, hiddenIds]
  );

  const visibleSceneObjects = useMemo(
    () => (sceneObjects ?? []).filter((o) => !hiddenIds.has(o.id)),
    [sceneObjects, hiddenIds]
  );
  const visibleArtworkItems = useMemo(
    () => artworkItems.filter((a) => !hiddenIds.has(a.id)),
    [artworkItems, hiddenIds]
  );

  const totalArtworkPages = Math.max(1, Math.ceil(artworkItems.length / artworkPageSize));
  useEffect(() => {
    setArtworkPage((p) => Math.min(p, totalArtworkPages));
  }, [totalArtworkPages]);
  const pagedArtworkItems = artworkItems.slice(
    (artworkPage - 1) * artworkPageSize,
    artworkPage * artworkPageSize
  );

  const fetchSceneObjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`);
      if (!res.ok) throw new Error();
      const data: SceneObject[] = await res.json();
      setSceneObjects(data);
    } catch {
      toast.error("Failed to load scene objects");
    }
  }, [room.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`);
        if (!res.ok) throw new Error();
        const data: SceneObject[] = await res.json();
        if (!cancelled) setSceneObjects(data);
      } catch {
        if (!cancelled) toast.error("Failed to load scene objects");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room.id]);

  // --- Undo / Redo ---------------------------------------------------
  // Snapshots the *current* state before a mutation is applied — call this
  // right before every drag/wall-switch/resize/delete/restore/reorder, not
  // after. Only ever covers this editing session's local state (position/
  // scale/list order), not anything already Saved to the server — undoing
  // past a Save would need re-issuing the old PATCH, which this doesn't do,
  // same "explicit Save is the only thing that's truly durable" model the
  // rest of this editor already follows.
  const snapshot = useCallback(() => {
    setUndoStack((prev) => [...prev, { sceneObjects: sceneObjects ?? [], artworks, stories, miniGames, cosplays, freedomWallNotes }]);
    setRedoStack([]);
  }, [sceneObjects, artworks, stories, miniGames, cosplays, freedomWallNotes]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, { sceneObjects: sceneObjects ?? [], artworks, stories, miniGames, cosplays, freedomWallNotes }]);
      setSceneObjects(last.sceneObjects);
      setArtworks(last.artworks);
      setStories(last.stories);
      setMiniGames(last.miniGames);
      setCosplays(last.cosplays);
      setFreedomWallNotes(last.freedomWallNotes);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, [sceneObjects, artworks, stories, miniGames, cosplays, freedomWallNotes]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u, { sceneObjects: sceneObjects ?? [], artworks, stories, miniGames, cosplays, freedomWallNotes }]);
      setSceneObjects(last.sceneObjects);
      setArtworks(last.artworks);
      setStories(last.stories);
      setMiniGames(last.miniGames);
      setCosplays(last.cosplays);
      setFreedomWallNotes(last.freedomWallNotes);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, [sceneObjects, artworks, stories, miniGames, cosplays, freedomWallNotes]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Block tab/window close when there are unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // ...and the two exits it never sees, both client-side route changes with no
  // page unload: Sign Out, and clicking through to another module. Unsaved
  // room edits are lost either way — unlike a backup, nothing here keeps
  // running once this component unmounts — so both are worth asking about.
  useLeaveBlocker({
    onSignOut: dirty
      ? "This room has changes you haven't saved yet. Signing out now discards them.\n\nSign out anyway?"
      : null,
    onNavigate: dirty
      ? "This room has changes you haven't saved yet. Leaving the Scene Editor now discards them.\n\nLeave anyway?"
      : null,
  });

  // Sync plaqueConfig local state whenever the selected scene object
  // changes to/from an about-plaque block — keeps the sliders accurate
  // without re-deriving on every render. Derived inline from `selection`
  // + `sceneObjects` so this effect can live before the post-guard
  // `selectedSceneObject` const without causing a TDZ error.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (obj?.kind !== ABOUT_PLAQUE_KIND) return;
    setPlaqueConfig(parsePlaqueConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single PlaqueConfig field and write the serialised
  // JSON back into the SceneObject's modelUrl so handleSave picks it up.
  function updatePlaqueConfig<K extends keyof PlaqueConfig>(key: K, value: Required<PlaqueConfig>[K]) {
    setPlaqueConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.kind === ABOUT_PLAQUE_KIND
            ? { ...o, modelUrl: JSON.stringify(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Sync textConfig whenever the selected scene object changes to a text
  // label. The Freedom Wall plaque (FREEDOM_WALL_BANNER_KIND) has its own
  // dedicated panel/state (bannerColors below) — it never touches this one.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || !isTextKind(obj.kind)) return;
    setTextConfig(parseTextConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single TextObjectConfig field — writes JSON back to
  // the selected text-kind SceneObject's modelUrl so handleSave picks it up.
  function updateTextConfig<K extends keyof TextObjectConfig>(key: K, value: Required<TextObjectConfig>[K]) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setTextConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && isTextKind(o.kind)
            ? { ...o, modelUrl: JSON.stringify(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Sync dividerConfig whenever the selection changes to a divider wall —
  // same pattern as textConfig above.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || !isDividerKind(obj.kind)) return;
    setDividerConfig(parseWallDividerConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single WallDividerConfig field — writes the JSON back to
  // the selected divider's modelUrl so handleSave picks it up, and so the 3D
  // preview resizes/retextures the panel live.
  function updateDividerConfig<K extends keyof WallDividerConfig>(
    key: K,
    value: Required<WallDividerConfig>[K]
  ) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setDividerConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && isDividerKind(o.kind)
            ? { ...o, modelUrl: serializeWallDividerConfig(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Sync sceneBannerConfig whenever the selection changes to a banner — same
  // pattern as dividerConfig above.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || !isSceneBannerKind(obj.kind)) return;
    setSceneBannerConfig(parseSceneBannerConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single SceneBannerConfig field — writes the JSON back to
  // the selected banner's modelUrl so handleSave picks it up, and so the 3D
  // preview re-letters and re-colours the plaque live.
  function updateSceneBannerConfig<K extends keyof SceneBannerConfig>(
    key: K,
    value: Required<SceneBannerConfig>[K]
  ) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setSceneBannerConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && isSceneBannerKind(o.kind)
            ? { ...o, modelUrl: serializeSceneBannerConfig(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Sync aboutLabelConfig whenever the selected scene object changes to a
  // heading-banner About block (Certs / Calling Card / Timeline & Gigs) —
  // same pattern as textConfig above, seeded with that kind's own defaults.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || !isAboutLabelKind(obj.kind)) return;
    setAboutLabelConfig(
      parseAboutLabelConfig(obj.modelUrl, defaultAboutLabelConfig(obj.kind as AboutBlockKind))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single AboutLabelConfig field — writes JSON back to the
  // selected block's modelUrl so handleSave picks it up. Merged into whatever
  // that column already holds rather than replacing it, because on the certs
  // block it also holds the per-certificate placements below; a plain
  // stringify of the label alone would wipe them on the next heading edit.
  function updateAboutLabelConfig<K extends keyof AboutLabelConfig>(key: K, value: Required<AboutLabelConfig>[K]) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setAboutLabelConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && isAboutLabelKind(o.kind)
            ? { ...o, modelUrl: mergeSceneObjectConfig(o.modelUrl, next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Sync the per-certificate placements whenever the Certificates Strip is
  // selected, and point the picker back at "all" so selecting the block always
  // opens on the together-controls rather than on whichever single certificate
  // was last tweaked.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || obj.kind !== ABOUT_CERTS_KIND) return;
    setCertPlacements(parseCertPlacements(obj.modelUrl));
    setCertPlacementTarget("all");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  /** Update one field of one certificate's placement. An override that lands
   *  back on its defaults is dropped from the map rather than stored as
   *  zeroes, so "has this one been moved?" stays a question the stored JSON
   *  can answer — which is what the picker's dot and the strip's "Reset all"
   *  both read. */
  function updateCertPlacement<K extends keyof CertPlacement>(
    certId: string,
    key: K,
    value: CertPlacement[K]
  ) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setCertPlacements((prev) => {
      const current = resolveCertPlacement(prev, certId);
      const updated = { ...current, [key]: value };
      const next = { ...prev };
      if (isDefaultCertPlacement(updated)) delete next[certId];
      else next[certId] = updated;
      writeCertPlacements(selectedId, next);
      return next;
    });
  }

  /** Put one certificate — or every one of them — back on the even spread. */
  function resetCertPlacement(certId: string | "all") {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setCertPlacements((prev) => {
      const next = certId === "all" ? {} : { ...prev };
      if (certId !== "all") delete next[certId];
      writeCertPlacements(selectedId, next);
      return next;
    });
  }

  /** The one write path for both of the above: mirror the map into the certs
   *  block's modelUrl (merged, so its heading survives) and mark the editor
   *  dirty. Splitting it out keeps the two callers from drifting on which
   *  half of that shared column they preserve. */
  function writeCertPlacements(selectedId: string, placements: CertPlacementMap) {
    setSceneObjects((objs) =>
      (objs ?? []).map((o) =>
        o.id === selectedId && o.kind === ABOUT_CERTS_KIND
          ? { ...o, modelUrl: mergeSceneObjectConfig(o.modelUrl, { certPlacements: placements }) }
          : o
      )
    );
    setDirty(true);
  }

  // Contact Desk config — same pattern again, for the About room's one
  // interactive prop (lib/museum/aboutRoomBlocks.ts's ContactDeskConfig).
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || obj.kind !== ABOUT_CONTACT_KIND) return;
    setContactConfig(parseContactDeskConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  function updateContactConfig<K extends keyof ContactDeskConfig>(
    key: K,
    value: Required<ContactDeskConfig>[K]
  ) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setContactConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && o.kind === ABOUT_CONTACT_KIND
            ? { ...o, modelUrl: serializeContactDeskConfig(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Wall clock config — the same pattern once more.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || obj.kind !== ABOUT_CLOCK_KIND) return;
    setClockConfig(parseWallClockConfig(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  function updateClockConfig<K extends keyof WallClockConfig>(
    key: K,
    value: Required<WallClockConfig>[K]
  ) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setClockConfig((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && o.kind === ABOUT_CLOCK_KIND
            ? { ...o, modelUrl: serializeWallClockConfig(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  /** Uploads a .glb and makes it the Contact Desk. Same signed upload as the
   *  podium / cabinet models above — see handleUploadModel's comment. */
  async function handleUploadContactModel(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      // Stores the *compressed* copy's URL, not the signing route's — the
      // upload helper runs every .glb through /api/upload/model/optimize and
      // the result lives at a different path. Same for every upload below.
      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);
      updateContactConfig("url", modelUrl);
      toast.success("Contact Desk model set — remember to Save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Sync bannerColors whenever the selected scene object changes to the
  // Freedom Wall plaque — same pattern as textConfig above.
  useEffect(() => {
    if (selection?.type !== "scene") return;
    const obj = (sceneObjects ?? []).find((o) => o.id === selection.id);
    if (!obj || !isBannerKind(obj.kind)) return;
    setBannerColors(parseBannerColors(obj.modelUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.type === "scene" ? selection.id : null]);

  // Helper: update a single BannerColors field — writes JSON back to the
  // selected plaque SceneObject's modelUrl so handleSave picks it up.
  function updateBannerColors<K extends keyof BannerColors>(key: K, value: Required<BannerColors>[K]) {
    if (selection?.type !== "scene") return;
    const selectedId = selection.id;
    setBannerColors((prev) => {
      const next = { ...prev, [key]: value };
      setSceneObjects((objs) =>
        (objs ?? []).map((o) =>
          o.id === selectedId && isBannerKind(o.kind)
            ? { ...o, modelUrl: JSON.stringify(next) }
            : o
        )
      );
      setDirty(true);
      return next;
    });
  }

  // Helper: set which wall an About block is mounted on. Encoded as
  // rotationY in the SceneObject (see aboutRoomBlocks.ts).
  function setAboutBlockWall(id: string, wall: AboutWall) {
    snapshot();
    setSceneObjects((prev) =>
      (prev ?? []).map((o) =>
        // Wall selection lives in rotationY (see aboutRoomBlocks.ts). X/Z are
        // reset to 0 — an About block's along-wall/depth placement is always
        // wall-derived, so any legacy nudge offset is cleared here.
        o.id !== id ? o : { ...o, rotationY: WALL_ROT_Y[wall], positionX: 0, positionZ: 0 }
      )
    );
    setDirty(true);
  }

  function updateSceneObjectLocal(id: string, patch: Partial<SceneObject>) {
    setSceneObjects((prev) => (prev ? prev.map((o) => (o.id === id ? { ...o, ...patch } : o)) : prev));
    setDirty(true);
  }

  // Rescale a model that turns out not to be in metres, once, the first time
  // it is measured (see modelUnitScale). Without this an admin who uploads a
  // centimetre-authored .glb — most Sketchfab downloads — gets an apparently
  // empty room and no indication why: the prop is there, kilometres wide,
  // with the camera somewhere inside it.
  //
  // Only for a prop still sitting at the untouched default scale of 1. An
  // admin who has already sized something has made a decision, and a
  // measurement arriving late (a re-render, a revisit) must never overrule
  // it. `autoFitted` additionally makes this once-per-object per session, so
  // an admin who deliberately drags the slider back to 1 isn't fought.
  const autoFitted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!sceneObjects) return;
    for (const o of sceneObjects) {
      if (o.kind !== "custom" || o.scale !== 1 || autoFitted.current.has(o.id)) continue;
      const fit = modelUnitScale(measuredSpans[o.id]);
      if (fit === 1) continue;
      autoFitted.current.add(o.id);
      updateSceneObjectLocal(o.id, { scale: fit });
      toast.success(
        `“${sceneObjectLabel(o)}” was exported in another unit — resized to fit the room. Adjust with Size, then Save.`
      );
    }
    // updateSceneObjectLocal is a stable-enough local closure over setState
    // only; re-running this on every render would defeat the guards above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneObjects, measuredSpans]);

  function updateArtworkPosition(
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) {
    setArtworks((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, positionX: patch.positionX, positionY: patch.positionY, positionZ: patch.positionZ, rotationY: patch.rotationY }
          : a
      )
    );
    setDirty(true);
  }

  // `currentPositionY` is the item's Y at the moment of the click (its
  // existing custom height, or the auto-computed FRAME_CENTER_Y if it
  // never had one) — switching walls only ever needs to change which
  // wall it's flush against, not reset how high it's hung.
  function setArtworkWall(id: string, wall: WallDefinition, currentPositionY: number) {
    snapshot();
    const center = (wall.freeMin + wall.freeMax) / 2;
    const { x, z } = wallPointAt(wall, center);
    updateArtworkPosition(id, { positionX: x, positionY: currentPositionY, positionZ: z, rotationY: wall.rotationY });
  }

  function setArtworkScale(id: string, scale: number) {
    setArtworks((prev) => prev.map((a) => (a.id === id ? { ...a, scale } : a)));
    setDirty(true);
  }

  function resetArtworkPosition(id: string) {
    snapshot();
    setArtworks((prev) =>
      prev.map((a) => (a.id === id ? { ...a, positionX: null, positionY: null, positionZ: null, rotationY: null } : a))
    );
    setDirty(true);
  }

  // Podiums — same "drag updates local state, Save PATCHes it" model as
  // artworks above. The one difference is what a placement means: a podium
  // has no wall to snap to, so X and Z are both free and rotationY is a
  // free spin rather than a wall-derived value.
  function updatePodiumPosition(
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) {
    setStories((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: patch.positionX, positionY: patch.positionY, positionZ: patch.positionZ, rotationY: patch.rotationY }
          : entry
      )
    );
    setDirty(true);
  }

  function setPodiumScale(id: string, scale: number) {
    setStories((prev) => prev.map((entry) => (entry.id === id ? { ...entry, scale } : entry)));
    setDirty(true);
  }

  /** Clears the override so this podium falls back to podiumPlacement.ts's
   *  grid slot. Never removes the podium — membership is mirrored from the
   *  published library, not chosen here (see lib/museum/storiesRoom.ts). */
  function resetPodiumPosition(id: string) {
    snapshot();
    setStories((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: null, positionY: null, positionZ: null, rotationY: null }
          : entry
      )
    );
    setDirty(true);
  }

  // Arcade cabinets — same model as podiums above (drag updates local state,
  // Save PATCHes it), plus a per-game display-mode override.
  function updateCabinetPosition(
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) {
    setMiniGames((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: patch.positionX, positionY: patch.positionY, positionZ: patch.positionZ, rotationY: patch.rotationY }
          : entry
      )
    );
    setDirty(true);
  }

  function setCabinetScale(id: string, scale: number) {
    setMiniGames((prev) => prev.map((entry) => (entry.id === id ? { ...entry, scale } : entry)));
    setDirty(true);
  }

  function setCabinetMode(id: string, mode: ArcadeDisplayMode | null) {
    snapshot();
    setMiniGames((prev) => prev.map((entry) => (entry.id === id ? { ...entry, displayMode: mode } : entry)));
    setDirty(true);
  }

  /** Clears the placement override so this cabinet falls back to
   *  cabinetPlacement.ts's grid slot. Never removes it — membership is
   *  mirrored from the playable mini games (lib/museum/arcadeRoom.ts). */
  function resetCabinetPosition(id: string) {
    snapshot();
    setMiniGames((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: null, positionY: null, positionZ: null, rotationY: null }
          : entry
      )
    );
    setDirty(true);
  }

  // Cosplay standees — same model as podiums above. One placement is the pair:
  // the standee and the photo behind it move together, which is why there is no
  // separate backdrop drag (see MuseumRoomCosplay in prisma/schema.prisma).
  function updateStandeePosition(
    id: string,
    patch: { positionX: number; positionY: number; positionZ: number; rotationY: number }
  ) {
    setCosplays((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: patch.positionX, positionY: patch.positionY, positionZ: patch.positionZ, rotationY: patch.rotationY }
          : entry
      )
    );
    setDirty(true);
  }

  function setStandeeScale(id: string, scale: number) {
    setCosplays((prev) => prev.map((entry) => (entry.id === id ? { ...entry, scale } : entry)));
    setDirty(true);
  }

  /** Flips one standee's billboard-lights switch — the one cosplay-room
   *  setting that lives per-standee rather than room-wide (see
   *  MuseumRoomCosplay.lightsEnabled). */
  function setStandeeLights(id: string, lightsEnabled: boolean) {
    setCosplays((prev) => prev.map((entry) => (entry.id === id ? { ...entry, lightsEnabled } : entry)));
    setDirty(true);
  }

  /** "Light every standee" / "Turn off every standee's lights" — the bulk
   *  version of the per-standee switch above, for an admin who wants the
   *  whole room lit (or wants to start over) without clicking each one. */
  function setAllStandeeLights(lightsEnabled: boolean) {
    snapshot();
    setCosplays((prev) => prev.map((entry) => ({ ...entry, lightsEnabled })));
    setDirty(true);
  }

  /** Clears the placement override so this standee falls back to
   *  standeePlacement.ts's wall slot. Never removes it — membership is mirrored
   *  from the published Cosplays (lib/museum/cosplayRoom.ts). */
  function resetStandeePosition(id: string) {
    snapshot();
    setCosplays((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, positionX: null, positionY: null, positionZ: null, rotationY: null }
          : entry
      )
    );
    setDirty(true);
  }

  // Sticky notes — same "drag updates local state, Save PATCHes it" model
  // as artworks above, just without an auto/custom distinction (a note's
  // position was random from the start, so there's no "auto layout" to
  // reset back to — see FreedomWallRoomContents.tsx's worldXYToNotePercent
  // for the world↔percent conversion this drag data is already in).
  function updateNotePosition(id: string, patch: { positionX: number; positionY: number }) {
    setFreedomWallNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    setDirty(true);
  }

  function setNoteScale(id: string, scale: number) {
    setFreedomWallNotes((prev) => prev.map((n) => (n.id === id ? { ...n, scale } : n)));
    setDirty(true);
  }

  // Which wall a note is pinned to — same "keep the current height, snap to
  // the new wall's center" behavior as setArtworkWall above, generalized
  // with resolveNoteWallSegment's halves convention (0-100 split evenly
  // across however many segments — 1, or 2 when a doorway flanks that side)
  // so the picked wall/segment round-trips correctly through the single
  // stored positionX.
  function setNoteWall(id: string, wall: WallDefinition, currentPositionY: number) {
    snapshot();
    const sameId = walls.filter((w) => w.id === wall.id);
    const idx = sameId.findIndex((w) => w.segment === wall.segment);
    const positionX = sameId.length <= 1 ? 50 : (idx === 0 ? 25 : 75);
    setFreedomWallNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, wall: wall.id, positionX, positionY: currentPositionY } : n))
    );
    setDirty(true);
  }

  // Face a custom scene object (an uploaded .glb or a standee) toward a
  // cardinal direction — the button form of the rotate gizmo. Free-dragging
  // the rotate ring rarely lands square to a wall, so N/E/S/W snap it to
  // the exact angle. Same rotationY encoding as About blocks (WALL_ROT_Y).
  function setSceneObjectFacing(id: string, wall: AboutWall) {
    snapshot();
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => (o.id === id ? { ...o, rotationY: WALL_ROT_Y[wall] } : o))
    );
    setDirty(true);
  }

  // Spin a custom scene object by a fixed step, wrapped to (−π, π] so the
  // stored value stays small and keeps landing back on the N/E/S/W angles.
  const ROTATE_STEP = Math.PI / 12; // 15°, matches MuseumEditorScene's rotationSnap
  function rotateSceneObject(id: string, delta: number) {
    snapshot();
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => {
        if (o.id !== id) return o;
        const raw = o.rotationY + delta;
        return { ...o, rotationY: Math.atan2(Math.sin(raw), Math.cos(raw)) };
      })
    );
    setDirty(true);
  }

  async function moveArtwork(id: string, direction: "up" | "down") {
    const index = artworks.findIndex((a) => a.id === id);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= artworks.length) return;
    snapshot();
    const previous = artworks;
    const reordered = [...artworks];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setArtworks(reordered);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${room.id}/artworks/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((a, i) => ({ id: a.id, displayOrder: i })) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setArtworks(previous);
      toast.error("Failed to reorder");
    }
  }

  async function removeArtworkFromRoom(entry: ArtworkEntry) {
    setRemovingArtworkId(entry.id);
    snapshot();
    const previous = artworks;
    setArtworks((prev) => prev.filter((a) => a.id !== entry.id));
    if (selection?.type === "artwork" && selection.id === entry.id) setSelection(null);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${room.id}/artworks?artworkId=${entry.artwork.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(`"${entry.artwork.title}" removed from room`);
    } catch {
      setArtworks(previous);
      toast.error("Failed to remove artwork");
    } finally {
      setRemovingArtworkId(null);
    }
  }

  // Soft-deletes a sticky note straight from the Scene Editor — same
  // DELETE endpoint FreedomWallTab.tsx's own per-note delete uses, so it
  // lands in Trash → Freedom Wall exactly the same way (viewable, restorable,
  // or permanently deletable there). Not undo-able via Ctrl+Z like a drag —
  // it's already gone from the server the moment this resolves.
  async function deleteNote(note: FreedomWallNotePublic) {
    setDeletingNote(true);
    try {
      const res = await fetch(`/api/admin/freedom-wall/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFreedomWallNotes((prev) => prev.filter((n) => n.id !== note.id));
      if (selection?.type === "note" && selection.id === note.id) setSelection(null);
      setDeleteNoteTarget(null);
      toast.success("Note moved to Trash");
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setDeletingNote(false);
    }
  }

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Saves every scene object and artwork currently in local state, not
  // just whichever one happens to be selected — this used to PATCH only
  // `selection`, which silently discarded any other edit made earlier in
  // the same session the moment the admin selected a different object
  // before clicking Save (e.g. set Artwork A's wall, then Artwork B's,
  // then Save while B was selected — A's change never reached the
  // database, but the single global `dirty` flag still cleared as if it
  // had). PATCHing everything is a little more redundant network traffic
  // than tracking per-item dirty state would be, but a room's object/
  // artwork count is small (the custom-object cap alone is 10) and
  // "nothing gets silently lost" is worth far more here than the savings.
  async function handleSave() {
    setSaving(true);
    try {
      const sceneSaves = (sceneObjects ?? []).map((obj) => {
        // About blocks are placed like an artwork frame: rotationY = wall,
        // positionX = along-wall ("Hang Width"), positionY = hang height,
        // scale = "Resize". positionZ (the wall-perpendicular axis) is never
        // meaningful — force it to 0 so any legacy nudge offset is cleaned up.
        const isAbout = (ABOUT_BLOCK_KINDS as readonly string[]).includes(obj.kind);
        const body: Record<string, unknown> = {
          positionX: obj.positionX,
          positionY: obj.positionY,
          positionZ: isAbout ? 0 : obj.positionZ,
          rotationY: obj.rotationY,
          // Every kind carries it: "Hide from Museum" is offered on the
          // fixtures, but there is no kind it would be wrong to store for,
          // and leaving it out per-kind is how a flag quietly stops saving.
          hidden: obj.hidden,
        };
        // The Contact Desk and the wall clock are placed absolutely like a
        // decorative prop, but unlike one they carry a Size slider of their
        // own, so their scale has to ride along too.
        if (isAbout || isAboutFixtureKind(obj.kind)) body.scale = obj.scale;
        // About blocks persist modelUrl (plaque JSON config). Text labels
        // persist modelUrl too (TextObjectConfig JSON — content/font/size/
        // color). The Freedom Wall plaque persists its own modelUrl
        // (BannerColors JSON — background/edge/text color only).
        // The Contact Desk stores its own config JSON there too (.glb URL,
        // texture, and the panel/prompt wording), and the wall clock stores
        // its format/colour config the same way.
        if (
          (ABOUT_BLOCK_KINDS as readonly string[]).includes(obj.kind) ||
          isTextKind(obj.kind) ||
          // A divider's size, colour, texture and Solid flag all live in that
          // same JSON blob (lib/museum/wallDivider.ts) — without this every
          // one of those edits would be dropped on Save.
          isDividerKind(obj.kind) ||
          // Same for a banner: its wording, colours, font and size are all in
          // its modelUrl JSON (lib/museum/sceneBanner.ts).
          isSceneBannerKind(obj.kind) ||
          isBannerKind(obj.kind) ||
          isAboutFixtureKind(obj.kind)
        ) {
          body.modelUrl = obj.modelUrl ?? null;
        }
        // Only "custom" .glb props carry a meaningful scale (the Size
        // slider) and label (the Name field); every other kind ignores
        // both columns server-side anyway.
        if (obj.kind === "custom") {
          body.scale = obj.scale;
          body.label = obj.label?.trim() ? obj.label.trim() : null;
          body.solid = obj.solid;
          body.colliderRadius = obj.colliderRadius;
          body.colliderOffsetX = obj.colliderOffsetX;
          body.colliderOffsetZ = obj.colliderOffsetZ;
          body.colliderHeight = obj.colliderHeight;
          body.colliderBaseY = obj.colliderBaseY;
        }
        return fetch(`/api/digital-museum/scene-objects/${obj.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      });
      const artworkSaves = artworks.map((a) =>
        fetch(`/api/digital-museum/room-artworks/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: a.positionX,
            positionY: a.positionY,
            positionZ: a.positionZ,
            rotationY: a.rotationY,
            scale: a.scale,
          }),
        })
      );
      const podiumSaves = stories.map((entry) =>
        fetch(`/api/digital-museum/room-stories/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: entry.positionX,
            positionY: entry.positionY,
            positionZ: entry.positionZ,
            rotationY: entry.rotationY,
            scale: entry.scale,
          }),
        })
      );
      const minigameSaves = miniGames.map((entry) =>
        fetch(`/api/digital-museum/room-minigames/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: entry.positionX,
            positionY: entry.positionY,
            positionZ: entry.positionZ,
            rotationY: entry.rotationY,
            scale: entry.scale,
            displayMode: entry.displayMode ?? null,
          }),
        })
      );
      const standeeSaves = cosplays.map((entry) =>
        fetch(`/api/digital-museum/room-cosplays/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: entry.positionX,
            positionY: entry.positionY,
            positionZ: entry.positionZ,
            rotationY: entry.rotationY,
            scale: entry.scale,
            lightsEnabled: entry.lightsEnabled,
          }),
        })
      );
      const noteSaves = freedomWallNotes.map((n) =>
        fetch(`/api/admin/freedom-wall/notes/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: n.positionX,
            positionY: n.positionY,
            scale: n.scale,
            // Which of the room's 4 walls the note is pinned to — the Wall
            // picker updates this in local state; without it here a wall
            // switch reverted on the next load.
            wall: n.wall,
          }),
        })
      );
      const results = await Promise.all([...sceneSaves, ...artworkSaves, ...podiumSaves, ...minigameSaves, ...standeeSaves, ...noteSaves]);
      const failed = results.find((res) => !res.ok);
      if (failed) {
        // A 409 means this tab is still holding an object that has since been
        // removed from the room — most likely in another tab, which then got
        // a freshly provisioned fixture in its place (see the scene-objects
        // PATCH route). Worth repeating the server's wording verbatim, since
        // the fix is to reload rather than to press Save again.
        const conflict =
          failed.status === 409
            ? ((await failed.json().catch(() => ({}))) as { error?: string }).error
            : null;
        throw new Error(conflict ?? "");
      }
      toast.success("Scene saved");
      setDirty(false);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : null;
      toast.error(message ?? "Failed to save — some changes may not have been applied");
    } finally {
      setSaving(false);
    }
  }

  // Duplicate a custom decorative object — offset a little on X from the
  // original so the copy is immediately visible and grabbable rather
  // than landing exactly on top of its source and looking like nothing
  // happened.
  async function handleDuplicateSceneObject(object: SceneObject) {
    if (
      (object.kind !== "custom" &&
        object.kind !== "text" &&
        !isDividerKind(object.kind) &&
        !isSceneBannerKind(object.kind)) ||
      !object.modelUrl
    ) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: object.kind,
          modelUrl: object.modelUrl,
          label: object.label?.trim() ? `${object.label.trim()} copy`.slice(0, MAX_SCENE_LABEL) : undefined,
          positionX: object.positionX + 0.75,
          positionY: object.positionY,
          positionZ: object.positionZ,
          rotationY: object.rotationY,
          scale: object.scale,
          solid: object.solid,
          colliderRadius: object.colliderRadius,
          colliderOffsetX: object.colliderOffsetX,
          colliderOffsetZ: object.colliderOffsetZ,
          colliderHeight: object.colliderHeight,
          colliderBaseY: object.colliderBaseY,
        }),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(created.error || "Failed to duplicate object");
      snapshot();
      setSceneObjects((prev) => [...(prev ?? []), created]);
      setSelection({ type: "scene", id: created.id });
      setMode("translate");
      toast.success(
        object.kind === "text"
          ? "Text label duplicated — drag it into place, then Save"
          : isDividerKind(object.kind)
            ? "Divider duplicated — drag it into place, then Save"
            : isSceneBannerKind(object.kind)
              ? "Banner duplicated — drag it into place, then Save"
              : "Object duplicated — drag it into place, then Save"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate object");
    } finally {
      setDuplicating(false);
    }
  }

  /**
   * Art hung on a divider that's about to stop existing.
   *
   * Removing the panel out from under a frame left it floating in the middle
   * of the room facing nothing — the placement is a bare room-local point, so
   * nothing about it stopped meaning something when its wall went away. These
   * frames get their override cleared instead, which drops them back into the
   * room's automatic perimeter layout: evenly spaced along whichever of
   * north/south/east/west (or a doorway's flanks) has room, exactly where they
   * hung before anyone put a divider in.
   *
   * Written to the server rather than staged, because the delete it belongs to
   * is: leaving the reset behind the Save button would mean an admin who
   * deleted a panel and walked away had orphaned art in the live museum.
   */
  async function releaseArtworkOnDivider(dividerId: string) {
    const stranded = artworks.filter(
      (a) =>
        a.positionX != null &&
        a.positionZ != null &&
        a.rotationY != null &&
        dividerFaceFor({
          positionX: a.positionX,
          positionZ: a.positionZ,
          rotationY: a.rotationY,
        })?.wall.dividerId === dividerId
    );
    if (stranded.length === 0) return;
    setArtworks((prev) =>
      prev.map((a) =>
        stranded.some((s) => s.id === a.id)
          ? { ...a, positionX: null, positionY: null, positionZ: null, rotationY: null }
          : a
      )
    );
    await Promise.all(
      stranded.map((a) =>
        fetch(`/api/digital-museum/room-artworks/${a.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            positionX: null,
            positionY: null,
            positionZ: null,
            rotationY: null,
            // Size is the admin's own choice and has nothing to do with which
            // wall the piece hung on, so it survives the move.
            scale: a.scale,
          }),
        })
      )
    ).catch(() => {
      // The panel is already gone either way; a failed reset only means these
      // frames still carry their old placement, which the next Save rewrites.
    });
    toast.success(
      stranded.length === 1
        ? "1 artwork returned to the room's walls"
        : `${stranded.length} artworks returned to the room's walls`
    );
  }

  async function handleDeleteSceneObject(object: SceneObject) {
    setDeleting(true);
    snapshot();
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${object.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      // Before the panel leaves local state — dividerFaceFor is derived from
      // it, so afterwards there would be no face left to match against.
      if (isDividerKind(object.kind)) await releaseArtworkOnDivider(object.id);
      setSceneObjects((prev) => (prev ? prev.filter((o) => o.id !== object.id) : prev));
      setRecentlyDeleted((prev) => [...prev, object]);
      setSelection(null);
      setDeleteConfirm(null);
      setDirty(false);
      toast.success(
        isResetOnlyKind(object.kind, clockIsProvisioned)
          ? `${sceneObjectLabel(object)} reset to default position`
          : `${sceneObjectLabel(object)} removed from room`
      );
    } catch {
      toast.error(isResetOnlyKind(object.kind, clockIsProvisioned) ? "Failed to reset position" : "Failed to remove object");
    } finally {
      setDeleting(false);
    }
  }

  async function restoreSceneObject(object: SceneObject) {
    snapshot();
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${object.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore: true }),
      });
      if (!res.ok) throw new Error();
      setRecentlyDeleted((prev) => prev.filter((o) => o.id !== object.id));
      await fetchSceneObjects();
      toast.success(`${sceneObjectLabel(object)} restored`);
    } catch {
      toast.error("Failed to restore object");
    }
  }

  /** Writes a new podium-model config onto the room's singleton config row.
   *  Saved immediately rather than waiting for the Save button: this isn't a
   *  placement being staged, it's a room setting, and the 3D preview needs
   *  the new pedestal to appear straight away. */
  async function savePodiumModelConfig(
    next: {
      url?: string | null;
      bookHeight?: number;
      textureUrl?: string | null;
    },
    /** Confirmation to show on success. Omitted where a toast would be
     *  noise (the Book Height slider fires a save per drag step) or where
     *  the caller already shows its own (the .glb upload). */
    successMessage?: string
  ) {
    if (!podiumModelObject) return;
    const merged = { ...podiumModelConfig, ...next };
    const modelUrl = serializePodiumModelConfig(merged);
    // Optimistic — a failed PATCH restores the previous value below.
    const previous = podiumModelObject.modelUrl;
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => (o.id === podiumModelObject.id ? { ...o, modelUrl } : o))
    );
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${podiumModelObject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl }),
      });
      if (!res.ok) throw new Error();
      if (successMessage) toast.success(successMessage);
    } catch {
      setSceneObjects((prev) =>
        (prev ?? []).map((o) => (o.id === podiumModelObject.id ? { ...o, modelUrl: previous } : o))
      );
      toast.error("Failed to save podium model");
    }
  }

  /** Patches the Arcade Room's room-wide settings — the default display mode
   *  (Cabinets vs Posters) and the cabinet body every game stands on — on its
   *  singleton config row. Saved immediately, same reasoning as
   *  savePodiumModelConfig above: it's a room setting, and the 3D preview
   *  needs it to take effect straight away. */
  async function saveArcadeConfig(next: Partial<ArcadeConfig>, successMessage: string) {
    if (!arcadeConfigObject) return;
    const modelUrl = serializeArcadeConfig({ ...arcadeConfig, ...next });
    const previous = arcadeConfigObject.modelUrl;
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => (o.id === arcadeConfigObject.id ? { ...o, modelUrl } : o))
    );
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${arcadeConfigObject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl }),
      });
      if (!res.ok) throw new Error();
      toast.success(successMessage);
    } catch {
      setSceneObjects((prev) =>
        (prev ?? []).map((o) => (o.id === arcadeConfigObject.id ? { ...o, modelUrl: previous } : o))
      );
      toast.error("Failed to save the Arcade Room settings");
    }
  }

  /** Patches the Cosplay Room's room-wide settings — the standee body every
   *  cosplay's print stands on, and the backdrop panel its second photo hangs on
   *  — on its singleton config row. Saved immediately, same reasoning as
   *  savePodiumModelConfig/saveArcadeConfig above: it's a room setting, and the
   *  3D preview needs it to take effect straight away. */
  async function saveStandeeConfig(
    next: Partial<CosplayStandeeConfig>,
    /** Omitted where a toast would be noise — the size sliders fire a save per
     *  drag step. */
    successMessage?: string
  ) {
    if (!standeeConfigObject) return;
    const modelUrl = serializeCosplayStandeeConfig({ ...standeeConfig, ...next });
    const previous = standeeConfigObject.modelUrl;
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => (o.id === standeeConfigObject.id ? { ...o, modelUrl } : o))
    );
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${standeeConfigObject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl }),
      });
      if (!res.ok) throw new Error();
      if (successMessage) toast.success(successMessage);
    } catch {
      setSceneObjects((prev) =>
        (prev ?? []).map((o) => (o.id === standeeConfigObject.id ? { ...o, modelUrl: previous } : o))
      );
      toast.error("Failed to save the Cosplay Room settings");
    }
  }

  /** Writes one or more banner-style fields to the room's single Room Banner
   *  row. Saved immediately for the same reason saveStandeeConfig is: it's a
   *  room setting, and the 3D preview needs it to take effect straight away. */
  async function saveRoomBannerStyle(
    next: Partial<RoomBannerStyle>,
    /** Omitted where a toast would be noise — the sliders fire a save per
     *  drag step. */
    successMessage?: string
  ) {
    if (!roomBannerObject) return;
    const modelUrl = serializeRoomBannerStyle({ ...roomBannerStyle, ...next });
    const previous = roomBannerObject.modelUrl;
    setSceneObjects((prev) =>
      (prev ?? []).map((o) => (o.id === roomBannerObject.id ? { ...o, modelUrl } : o))
    );
    try {
      const res = await fetch(`/api/digital-museum/scene-objects/${roomBannerObject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl }),
      });
      if (!res.ok) throw new Error();
      if (successMessage) toast.success(successMessage);
    } catch {
      setSceneObjects((prev) =>
        (prev ?? []).map((o) => (o.id === roomBannerObject.id ? { ...o, modelUrl: previous } : o))
      );
      toast.error("Failed to save the banner style");
    }
  }

  /** Uploads a .glb and makes it this room's standee body. The Cosplay
   *  counterpart to handleUploadPodiumModel, down to the same signed-upload
   *  path. */
  async function handleUploadStandeeModel(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);
      await saveStandeeConfig(
        { url: modelUrl },
        "Standee model set — every standee in this room now uses it"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Uploads a .glb and makes it this room's cabinet. The Arcade counterpart
   *  to handleUploadPodiumModel above, down to the same signed-upload path. */
  async function handleUploadCabinetModel(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);
      await saveArcadeConfig(
        { cabinetModelUrl: modelUrl },
        "Cabinet model set — every cabinet in this room now uses it"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  /** Uploads a .glb and makes it this room's pedestal. Same two-step signed
   *  upload as handleUploadModel below — see its comment for why. */
  async function handleUploadPodiumModel(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);
      await savePodiumModelConfig({ url: modelUrl });
      toast.success("Podium model set — every podium in this room now uses it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadModel(file: File) {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      // Two steps, not a single POST-the-file-here call — a 100MB file
      // would be rejected by Vercel's serverless function body-size cap
      // (~4.5MB) long before it reached our own validation. This gets a
      // one-time signed URL from our server, then uploads the actual
      // bytes straight from the browser to Supabase Storage — see
      // lib/supabase/storage.ts's createModelUploadUrl doc comment.
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);

      snapshot();
      const name = newObjectName.trim().slice(0, MAX_SCENE_LABEL);
      const createRes = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl, label: name || undefined }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || "Failed to add object");

      setSceneObjects((prev) => [...(prev ?? []), created]);
      setSelection({ type: "scene", id: created.id });
      setMode("translate");
      setUploadModalOpen(false);
      setNewObjectName("");
      toast.success(`${name || "Decorative object"} added — drag it into place, then Save`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Close "Add ▾" on an outside click or Escape — same pattern as
  // AdminGoToMenu's dropdown. Bound only while the menu is open so the editor
  // isn't carrying two document listeners through every drag of every object.
  useEffect(() => {
    if (!addMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [addMenuOpen]);

  /**
   * Swap the .glb under an already-placed prop, keeping everything else.
   *
   * The alternative was delete-and-re-add, which throws away exactly the work
   * that is expensive: where the prop stands, how it is turned, its size, its
   * name, and a collision footprint someone measured by hand. Replacing a
   * model is a common edit — a better export of the same asset, a different
   * statue on the same plinth — and none of that placement should have to be
   * redone for it.
   *
   * The uploaded URL is written straight to the row rather than staged: the
   * bytes are already in Storage by this point, so a staged-but-unsaved
   * modelUrl would leave the editor showing a model the museum doesn't have,
   * and an abandoned edit would leave an orphan file with nothing pointing at
   * it. `scale` and the collider are deliberately untouched — a replacement is
   * assumed to be roughly the thing it replaces, and silently resizing it
   * would undo a fit the admin had already made.
   */
  async function handleReplaceModel(file: File) {
    const target = selectedSceneObject;
    if (!target || target.kind !== "custom") return;
    if (!file.name.toLowerCase().endsWith(".glb")) {
      toast.error("Only .glb files are supported");
      return;
    }
    if (file.size > MAX_MODEL_SIZE) {
      toast.error("File too large — 100MB max");
      return;
    }
    setUploading(true);
    try {
      // Same two-step signed upload as handleUploadModel — see its comment for
      // why a 100MB file can never be POSTed through this app's own routes.
      const signRes = await fetch("/api/upload/model/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      const modelUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);

      const res = await fetch(`/api/digital-museum/scene-objects/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl }),
      });
      if (!res.ok) throw new Error("Failed to replace the model");

      snapshot();
      setSceneObjects((prev) =>
        (prev ?? []).map((o) => (o.id === target.id ? { ...o, modelUrl } : o))
      );
      // Cleared so the new model re-measures — the old one's bounding box is
      // what "Fit to model" and the auto collider radius read, and keeping it
      // would size the new prop's footprint to the shape of the old one.
      const forget = <T,>(prev: Record<string, T>) => {
        const next = { ...prev };
        delete next[target.id];
        return next;
      };
      setMeasuredRadii(forget);
      setMeasuredSpans(forget);
      setMeasuredFits(forget);
      setReplaceModalOpen(false);
      toast.success(`${sceneObjectLabel(target)} replaced — its position and size are unchanged`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Replace failed");
    } finally {
      setUploading(false);
    }
  }

  // Add a fresh text-label object — creates it on the server (gets an id),
  // adds it to local state, and selects it so the admin can immediately
  // type their text in the side panel. Same "place at center, then drag"
  // pattern as Add Object for decorative props.
  async function addTextObject() {
    try {
      const createRes = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // positionY = FRAME_CENTER_Y so the new label spawns at eye level
        // rather than on the floor (the API defaults to 0 when omitted).
        body: JSON.stringify({ kind: "text", positionY: FRAME_CENTER_Y }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || "Failed to add text");
      snapshot();
      setSceneObjects((prev) => [...(prev ?? []), created]);
      setSelection({ type: "scene", id: created.id });
      setMode("translate");
      toast.success("Text label added — edit the content in the panel, then Save");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add text");
    }
  }

  // Add a fresh divider wall — same instant "create on the server, select it,
  // tune it in the panel" flow as Add Text above. Spawns at the room's centre
  // standing on the floor (positionY 0), because a wall stands on the floor;
  // the admin then drags it where the room needs splitting.
  async function addDividerObject() {
    try {
      // Staggered rather than dropped on the room's exact centre like every
      // other Add. Two dividers are the same code-drawn slab at the same
      // default size, so a second one landing on the first is not "two panels
      // overlapping" — it is pixel-for-pixel invisible, and the editor looks
      // like the Add silently failed. (Reported from the Collections room:
      // several dividers created, one showing.) Each new panel steps back
      // along Z by a bit over its own thickness, clamped inside the room so a
      // long run of them can't march out through a wall.
      const step = DEFAULT_DIVIDER_CONFIG.thickness + 1;
      const spawnZ = Math.max(
        -depth / 2 + 1,
        Math.min(depth / 2 - 1, dividerObjects.length * step - (depth / 2 - 1))
      );
      const createRes = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: DIVIDER_KIND, positionZ: spawnZ }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || "Failed to add divider");
      snapshot();
      setSceneObjects((prev) => [...(prev ?? []), created]);
      setSelection({ type: "scene", id: created.id });
      setMode("translate");
      toast.success("Divider added — drag it into place, size it in the panel, then Save");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add divider");
    }
  }

  // Add a fresh banner — same instant "create on the server, select it, type
  // the wording in the panel" flow as Add Text and Add Divider above. Spawns
  // at BANNER_DEFAULT_Y (above eye level) rather than on the floor, because a
  // banner is signage: dropped at Y 0 the admin's first job would always be
  // dragging it up off the ground.
  async function addBannerObject() {
    try {
      // Staggered along Z for the same reason dividers are (see
      // addDividerObject): two fresh banners are the identical code-drawn
      // plaque at the identical default size, so a second one landing on the
      // first is invisible rather than merely overlapping, and the Add reads
      // as having silently failed.
      const step = 1.2;
      const spawnZ = Math.max(
        -depth / 2 + 1,
        Math.min(depth / 2 - 1, bannerObjects.length * step - (depth / 2 - 1))
      );
      const createRes = await fetch(`/api/digital-museum/rooms/${room.id}/scene-objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: BANNER_KIND, positionY: BANNER_DEFAULT_Y, positionZ: spawnZ }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created.error || "Failed to add banner");
      snapshot();
      setSceneObjects((prev) => [...(prev ?? []), created]);
      setSelection({ type: "scene", id: created.id });
      setMode("translate");
      toast.success("Banner added — type the text and pick its colours in the panel, then Save");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add banner");
    }
  }

  if (sceneObjects === null) {
    return (
      <div className="admin-card border rounded-2xl p-8 text-center">
        <p className="font-body text-sm text-ink-400 dark:text-ink-300">Loading…</p>
      </div>
    );
  }

  const customObjects = sceneObjects.filter((o) => o.kind === "custom");
  const textObjects   = sceneObjects.filter((o) => o.kind === "text");
  // Free-placed room fixtures — the About room's Contact Desk, and the wall
  // clock (About room and respawn room alike; see lib/museum/wallClock.ts).
  // Listed rather than left to be found by clicking around the 3D view: a
  // clock hung high on a wall is easy to miss from the camera's starting
  // angle, and there's no other way into its settings.
  const fixtureObjects = sceneObjects.filter((o) => isAboutFixtureKind(o.kind));
  const selectedSceneObject = selection?.type === "scene" ? sceneObjects.find((o) => o.id === selection.id) ?? null : null;
  const selectedArtwork = selection?.type === "artwork" ? artworks.find((a) => a.id === selection.id) ?? null : null;
  const selectedArtworkItem =
    selection?.type === "artwork" ? artworkItems.find((a) => a.id === selection.id) ?? null : null;
  const selectedWall = selectedArtworkItem ? nearestWall(artworkWalls, selectedArtworkItem) : null;
  const selectedPodiumItem =
    selection?.type === "podium" ? podiumItems.find((p) => p.id === selection.id) ?? null : null;
  const selectedCabinetItem =
    selection?.type === "cabinet" ? cabinetItems.find((c) => c.id === selection.id) ?? null : null;
  const selectedCabinetEntry =
    selectedCabinetItem ? miniGames.find((e) => e.id === selectedCabinetItem.id) ?? null : null;
  const selectedStandeeItem =
    selection?.type === "standee" ? standeeItems.find((c) => c.id === selection.id) ?? null : null;
  const selectedNote = selection?.type === "note" ? freedomWallNotes.find((n) => n.id === selection.id) ?? null : null;
  // Which wall/segment the selected note is actually pinned to right now —
  // drives the Wall picker's highlighted button, same "resolve, don't guess"
  // approach nearestWall takes for artworks, just exact here since a note's
  // wall is stored outright rather than inferred from rotation.
  const selectedNoteWall = selectedNote
    ? resolveNoteWallSegment(selectedNote, { depth, hasNorthOpening, hasSouthOpening }).seg
    : null;

  // The certificates actually hung on the wall — the same slice the strip
  // itself draws, so the picker can never offer one that isn't up there. The
  // rest of the artist's list stays on /about.
  const wallCertificates = (aboutData?.certificates ?? []).slice(0, MAX_WALL_CERTS);
  const movedCertCount = wallCertificates.filter((c) => certPlacements[c.id]).length;
  // Null while the picker is on "All together": that is the strip's own
  // controls, which are already on screen above.
  const selectedCertPlacement =
    certPlacementTarget === "all" ? null : resolveCertPlacement(certPlacements, certPlacementTarget);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
      {/* `fixed`, so its grid slot is moot — it takes the whole viewport
          while open and renders nothing at all otherwise. */}
      <AnimatePresence>
        {share360 && (
          <Share360Modal
            key="editor-share-360"
            variant="admin"
            result={share360}
            roomName={room.name}
            shareUrl={roomShareUrl(room.slug)}
            onClose={() => setShare360(null)}
          />
        )}
      </AnimatePresence>
      {/* Toolbar — Undo/Redo apply across the whole session, not just the
          current selection, so they sit above the 3D view rather than
          inside either object's own control card. The Dark/Light button
          toggles the *scene's own* dark mode (not the admin page theme)
          so admins can preview how the room looks in both modes. */}
      <div className="lg:col-span-2 admin-card border rounded-2xl p-1.5 sm:p-2 flex flex-wrap items-center gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl/Cmd+Z)"
          aria-label="Undo"
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl font-jakarta text-xs font-medium text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {/* Label drops below sm — the arrow is unambiguous, and two worded
              buttons were a third of the row on a phone. aria-label above
              keeps the button named for screen readers either way. */}
          <Undo2 size={14} /> <span className="hidden sm:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl/Cmd+Shift+Z)"
          aria-label="Redo"
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl font-jakarta text-xs font-medium text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Redo2 size={14} /> <span className="hidden sm:inline">Redo</span>
        </button>
        {/* Grows to push the preview controls right on desktop; on mobile the
            toolbar wraps instead, so the spacer would just add a dead gap. */}
        <div className="hidden sm:block flex-1" />
        {/* Unsaved-changes indicator in toolbar for visibility */}
        {dirty && !saving && (
          <span className="font-body text-[11px] text-amber-500 dark:text-amber-400 px-2">
            ● Unsaved
          </span>
        )}
        {/* Scene dark mode preview toggle — affects only the 3D scene's
            own rendering, not the admin page's CSS theme. Uses explicit
            (non-dark:-prefixed) colors so it stays visible regardless of
            which page theme the admin has active. */}
        {/* Share 360° — renders the room as it currently stands (unsaved
            edits included) into a Facebook-ready 360° JPEG. Lives with the
            preview controls rather than Save because it never touches the
            database; it is a way to *look at* the room, like Dark/Light. */}
        <button
          type="button"
          onClick={handleShare360}
          disabled={rendering360}
          title="Share this room as a 360° photo"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full font-jakarta text-xs font-medium transition-all duration-200 border select-none shrink-0 bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-sm disabled:opacity-60 disabled:cursor-wait"
        >
          <Share2 size={12} className="shrink-0" />
          {rendering360 ? "Rendering…" : "Share 360°"}
        </button>
        {/* Light / Dark mode toggle */}
        <button
          type="button"
          onClick={() => setSceneDarkMode((v) => !v)}
          title={sceneDarkMode ? "Preview scene in light mode" : "Preview scene in dark mode"}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full font-jakarta text-xs font-medium transition-all duration-200 border select-none shrink-0",
            sceneDarkMode
              ? "bg-[#1c1917] text-amber-300 border-amber-400/30 hover:border-amber-400/60 shadow-[0_0_8px_rgba(251,191,36,0.15)]"
              : "bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-sm"
          )}
        >
          {/* Label kept at every width, unlike Undo/Redo above: this button
              reports which mode you are *in*, and a lone sun/moon leaves that
              to be inferred from an icon that also looks like a control. */}
          {sceneDarkMode
            ? <><Moon size={12} className="shrink-0" /> Dark</>
            : <><Sun size={12} className="shrink-0" /> Light</>
          }
        </button>

        {/* Global brightness slider — adjusts the current mode's brightness live
            in the 3D scene and saves to the API on commit. Applies to ALL rooms
            (same museumBrightnessLight / museumBrightnessDark the public museum reads). */}
        {/* Its own full-width row on mobile, natural size at sm+. It used to
            be `flex-1 min-w-0`, meaning a zero flex-basis: a basis-0 item
            never asks the wrapping row for space, so instead of wrapping it
            was squeezed to nothing and its slider + "19%" spilled out under
            the Add button. `basis-full` makes it wrap onto a line of its own,
            where the slider gets the whole width — the one control here that
            is genuinely better wider — and `order-last` keeps the buttons
            together on the first row above it. */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 sm:px-1 basis-full order-last sm:basis-auto sm:order-none sm:flex-none">
          {sceneDarkMode
            ? <Moon size={11} className="shrink-0 text-indigo-400" />
            : <Sun  size={11} className="shrink-0 text-amber-500" />
          }
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={sceneDarkMode ? localBrightnessDark : localBrightnessLight}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (sceneDarkMode) setLocalBrightnessDark(val);
              else setLocalBrightnessLight(val);
            }}
            onMouseUp={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              if (sceneDarkMode) saveBrightness({ brightnessDark: val });
              else saveBrightness({ brightnessLight: val });
            }}
            onTouchEnd={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              if (sceneDarkMode) saveBrightness({ brightnessDark: val });
              else saveBrightness({ brightnessLight: val });
            }}
            className={cn("flex-1 min-w-0 sm:flex-none sm:w-28 touch-none", sceneDarkMode ? "accent-indigo-400" : "accent-amber-500")}
            title="Global room brightness — applies to all rooms"
          />
          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300 shrink-0">
            {sceneDarkMode ? localBrightnessDark : localBrightnessLight}%
          </span>
        </div>

        {/* One "Add ▾" instead of four side-by-side buttons. Four of them
            filled most of a toolbar that also carries the mode switch, the
            light/dark toggle and the brightness slider, and on a narrow
            screen they pushed the rest of it off the row entirely.

            Ordered cheapest-to-commit first: Text and Banner are typed in
            place, a Divider is dragged into shape, and Add Object opens an
            upload dialog — so the list runs from "click and start typing" to
            "go and find a .glb". */}
        <div ref={addMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAddMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl font-jakarta text-xs font-medium text-sepia hover:bg-sepia/10 transition-colors"
          >
            <Plus size={14} /> Add
            <ChevronDown size={13} className={cn("transition-transform", addMenuOpen && "rotate-180")} />
          </button>
          {addMenuOpen && (
            <div
              role="menu"
              // Anchored to the button's *right* edge, not its left. "Add" is
              // the last control in the toolbar and sits hard against the
              // card's right side after the flex-1 spacer, so a left-anchored
              // menu opened straight off the edge of the screen — on desktop
              // as well as mobile. Opening leftward keeps it inside the card
              // at every width, and the max-width stops it overflowing the
              // viewport on a narrow phone where the toolbar has wrapped.
              className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-lg z-40 overflow-hidden"
            >
              {([
                {
                  key: "text",
                  label: "Add Text",
                  hint: "Words on a wall, no backing",
                  icon: Type,
                  tone: "text-violet-600 dark:text-violet-400",
                  run: addTextObject,
                },
                {
                  key: "banner",
                  label: "Add Banner",
                  hint: "A titled plaque you colour",
                  icon: RectangleHorizontal,
                  tone: "text-amber-600 dark:text-amber-400",
                  run: addBannerObject,
                },
                {
                  key: "divider",
                  label: "Add Divider",
                  hint: "A wall visitors can't pass",
                  icon: Columns2,
                  tone: "text-teal-600 dark:text-teal-400",
                  run: addDividerObject,
                },
                {
                  key: "object",
                  label: "Add Object",
                  hint: "Upload a .glb prop",
                  icon: Upload,
                  tone: "text-sepia",
                  run: () => { setNewObjectName(""); setUploadModalOpen(true); },
                },
              ] as const).map(({ key, label, hint, icon: Icon, tone, run }) => (
                <button
                  key={key}
                  type="button"
                  role="menuitem"
                  onClick={() => { setAddMenuOpen(false); run(); }}
                  className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <Icon size={14} className={cn("mt-0.5 shrink-0", tone)} />
                  <span className="min-w-0">
                    <span className="block font-jakarta text-xs font-medium text-ink dark:text-cream">
                      {label}
                    </span>
                    <span className="block font-body text-[10px] text-ink-400 dark:text-ink-300">
                      {hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3D preview — fixed orbit camera, not a walkthrough (see the spec).
          Height drops on mobile (h-[50vh] vs h-[65vh]) so the side panel
          below still fits on screen without excessive scrolling. */}
      <div className="admin-card border rounded-2xl overflow-hidden h-[50vh] sm:h-[65vh]">
        <MuseumEditorScene
          room={room}
          share360Ref={share360Ref}
          hasNorthOpening={hasNorthOpening}
          hasSouthOpening={hasSouthOpening}
          sceneObjects={visibleSceneObjects}
          selectedSceneObjectId={selection?.type === "scene" ? selection.id : null}
          mode={mode}
          onSelectSceneObject={(id) => {
            setSelection({ type: "scene", id });
            setMode("translate");
          }}
          onChangeSceneObject={updateSceneObjectLocal}
          onMeasureSceneObject={handleMeasureSceneObject}
          onInteractionStart={snapshot}
          artworkItems={visibleArtworkItems}
          selectedArtworkId={selection?.type === "artwork" ? selection.id : null}
          onSelectArtwork={(id) => setSelection({ type: "artwork", id })}
          onChangeArtworkPosition={updateArtworkPosition}
          podiumItems={visiblePodiumItems}
          selectedPodiumId={selection?.type === "podium" ? selection.id : null}
          onSelectPodium={(id) => setSelection({ type: "podium", id })}
          onChangePodiumPosition={updatePodiumPosition}
          podiumModelUrl={podiumModelConfig.url}
          podiumBookHeight={podiumModelConfig.bookHeight}
          podiumTextureUrl={podiumModelConfig.textureUrl}
          cabinetItems={visibleCabinetItems}
          selectedCabinetId={selection?.type === "cabinet" ? selection.id : null}
          onSelectCabinet={(id) => setSelection({ type: "cabinet", id })}
          onChangeCabinetPosition={updateCabinetPosition}
          cabinetModelUrl={arcadeConfig.cabinetModelUrl}
          cabinetTextureUrl={arcadeConfig.cabinetTextureUrl}
          cabinetScreenHeight={arcadeConfig.screenHeight}
          cabinetScreenDepth={arcadeConfig.screenDepth}
          standeeItems={visibleStandeeItems}
          selectedStandeeId={selection?.type === "standee" ? selection.id : null}
          onSelectStandee={(id) => setSelection({ type: "standee", id })}
          onChangeStandeePosition={updateStandeePosition}
          standeeModelUrl={standeeConfig.url}
          standeeTextureUrl={standeeConfig.textureUrl}
          standeeCutoutHeight={standeeConfig.cutoutHeight}
          standeeBackdropEnabled={standeeConfig.backdropEnabled}
          standeeBackdropWidth={standeeConfig.backdropWidth}
          standeeBackdropHeight={standeeConfig.backdropHeight}
          standeeBackdropFrameColor={standeeConfig.backdropFrameColor}
          standeeBackdropEdgeColor={standeeConfig.backdropEdgeColor}
          standeeBackdropEdgeThickness={standeeConfig.backdropEdgeThickness}
          roomBanner={roomBannerStyle}
          standeeLights={{
            style: standeeConfig.lightsStyle,
            color: standeeConfig.lightsColor,
            intensity: standeeConfig.lightsIntensity,
            bulbSize: standeeConfig.lightsBulbSize,
            spacing: standeeConfig.lightsSpacing,
            animation: standeeConfig.lightsAnimation,
            speed: standeeConfig.lightsSpeed,
            floodCount: standeeConfig.floodCount,
            floodBeamHeight: standeeConfig.floodBeamHeight,
            floodBeamSpread: standeeConfig.floodBeamSpread,
          }}
          aboutData={aboutData}
          freedomWallNotes={freedomWallNotes}
          selectedNoteId={selection?.type === "note" ? selection.id : null}
          onSelectNote={(id) => setSelection({ type: "note", id })}
          onChangeNotePosition={updateNotePosition}
          freedomWallEventTitle={freedomWallEventTitle}
          darkMode={sceneDarkMode}
          brightness={sceneDarkMode ? localBrightnessDark : localBrightnessLight}
        />
      </div>

      {/* Control panel — capped to the 3D preview's own height on desktop and
          scrolled inside itself, instead of running as long as its contents
          and dragging the page down with it.

          The preview beside it is a fixed 65vh while this column grew with
          every object, frame and control card in the room, so a room with a
          few props was already taller than the screen: scrolling down to
          reach the Wall picker or Save scrolled the room being edited clean
          out of view, which is the one thing an editor must never do. Both
          columns are the same height now, so the page barely scrolls at all
          and the preview stays put while this side moves.

          Deliberately not `position: sticky` on the preview, which is the
          usual reflex: the admin shell's <main> carries `overflow-auto` while
          its height is never constrained (see AdminBackToTop's note — the
          window is what scrolls), so it counts as a scroll container that
          never scrolls, and a sticky child inside it has nothing to stick to.

          lg: only. Below that the grid is a single column with this panel
          *under* the preview, where an inner scrollbar would be a trap
          rather than a convenience. */}
      <div className="space-y-4 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1.5">
        {/* Decorative objects section */}
        {customObjects.length > 0 && (
          <SceneObjectSection
            title="Decorative Objects"
            objects={customObjects}
            selection={selection}
            hiddenIds={hiddenIds}
            onSelect={(id) => {
              setSelection({ type: "scene", id });
              setMode("translate");
            }}
            onToggleHidden={toggleHidden}
          />
        )}

        {/* Room fixtures — the About room's Contact Desk and wall clock */}
        {fixtureObjects.length > 0 && (
          <SceneObjectSection
            title="Room Fixtures"
            objects={fixtureObjects}
            selection={selection}
            hiddenIds={hiddenIds}
            onSelect={(id) => {
              setSelection({ type: "scene", id });
              setMode("translate");
            }}
            onToggleHidden={toggleHidden}
          />
        )}

        {/* Text labels section */}
        {textObjects.length > 0 && (
          <SceneObjectSection
            title="Text Labels"
            objects={textObjects}
            selection={selection}
            hiddenIds={hiddenIds}
            onSelect={(id) => {
              setSelection({ type: "scene", id });
              setMode("translate");
            }}
            onToggleHidden={toggleHidden}
          />
        )}

        {/* Divider walls — listed like any other placed object so a panel
            dragged behind something else can still be found and selected. */}
        {dividerObjects.length > 0 && (
          <SceneObjectSection
            title="Dividers"
            objects={dividerObjects}
            selection={selection}
            hiddenIds={hiddenIds}
            onSelect={(id) => {
              setSelection({ type: "scene", id });
              setMode("translate");
            }}
            onToggleHidden={toggleHidden}
          />
        )}

        {/* Recently removed — quick restore, no trip to Trash needed */}
        {recentlyDeleted.length > 0 && (
          <div className="admin-card border border-dashed border-black/10 dark:border-white/10 rounded-2xl p-4">
            <h4 className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
              Recently Removed
            </h4>
            <div className="space-y-1.5">
              {recentlyDeleted.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5">
                  <span className="font-body text-xs text-ink-400 dark:text-ink-300">{sceneObjectLabel(o)}</span>
                  <button
                    type="button"
                    onClick={() => restoreSceneObject(o)}
                    className="inline-flex items-center gap-1 font-jakarta text-[11px] font-medium text-sepia hover:underline"
                  >
                    <RotateCcw size={11} /> Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scene object controls (a custom decorative object or About-room block) */}
        {selectedSceneObject && (
          <>
            {/* About blocks have no move/rotate gizmo at all — they're placed
                by the Wall picker + Hang Height slider below, like an artwork
                frame. The Move/Rotate toolbar is only for decorative props. */}
            {!isAboutBlockKind(selectedSceneObject.kind) && (
              <ModeToolbar mode={mode} onModeChange={setMode} allowRotate />
            )}
            <div className="admin-card border rounded-2xl p-4 space-y-3">

              {isAboutBlockKind(selectedSceneObject.kind) ? (
                /* About-room block controls:
                   1. Wall picker (N/S/E/W) — which wall to mount on.
                   2. Hang Width / Hang Height / Resize — placed like an
                      artwork frame, no free 3D drag.
                   3. Plaque-only: Brightness, Logo Scale, per-field font+size.
                   4. Certs / Calling Card: editable heading banner. */
                <>
                  {/* --- Wall picker ---------------------------------------- */}
                  <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Wall
                  </p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["north", "south", "east", "west"] as AboutWall[]).map((wall) => {
                      const isCurrentWall = rotYToWall(selectedSceneObject.rotationY) === wall;
                      return (
                        <button
                          key={wall}
                          type="button"
                          onClick={() => setAboutBlockWall(selectedSceneObject.id, wall)}
                          className={cn(
                            "px-2 py-2 rounded-xl font-jakarta text-xs font-medium transition-colors border capitalize",
                            isCurrentWall
                              ? "bg-sepia/10 text-sepia border-sepia/20"
                              : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                          )}
                        >
                          {wall.charAt(0).toUpperCase() + wall.slice(1)}
                        </button>
                      );
                    })}
                  </div>

                  {/* --- Hang Width (slide along the wall) ---------------- */}
                  <div className="mt-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Hang Width
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {selectedSceneObject.positionX >= 0 ? "+" : ""}
                        {selectedSceneObject.positionX.toFixed(2)}m
                      </span>
                    </div>
                    <input
                      type="range" min={-4} max={4} step={0.05}
                      value={selectedSceneObject.positionX}
                      onPointerDown={snapshot}
                      onChange={(e) =>
                        updateSceneObjectLocal(selectedSceneObject.id, {
                          positionX: Number(e.target.value),
                          positionZ: 0,
                        })
                      }
                      className="w-full touch-none"
                    />
                  </div>

                  {/* --- Hang Height (vertical offset) ------------------- */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Hang Height
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {selectedSceneObject.positionY >= 0 ? "+" : ""}
                        {selectedSceneObject.positionY.toFixed(2)}m
                      </span>
                    </div>
                    <input
                      type="range" min={-1.5} max={1.5} step={0.05}
                      value={selectedSceneObject.positionY}
                      onPointerDown={snapshot}
                      onChange={(e) =>
                        updateSceneObjectLocal(selectedSceneObject.id, {
                          positionY: Number(e.target.value),
                          positionZ: 0,
                        })
                      }
                      className="w-full touch-none"
                    />
                  </div>

                  {/* --- Resize (uniform scale) ------------------------- */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Resize
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {Math.round(selectedSceneObject.scale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range" min={0.6} max={1.6} step={0.02}
                      value={selectedSceneObject.scale}
                      onPointerDown={snapshot}
                      onChange={(e) =>
                        updateSceneObjectLocal(selectedSceneObject.id, { scale: Number(e.target.value) })
                      }
                      className="w-full touch-none"
                    />
                  </div>

                  {/* --- Plaque-only display controls (tabbed so the 3D
                        preview stays visible while scrolling) --------------- */}
                  {selectedSceneObject.kind === ABOUT_PLAQUE_KIND && (
                    <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-4">
                      <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Plaque Display
                      </p>

                      <div className="flex items-center gap-1.5">
                        {([
                          { key: "glass" as const,  label: "Glass" },
                          { key: "text" as const,   label: "Text" },
                          { key: "skills" as const, label: "Skills" },
                        ]).map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPlaqueTab(key)}
                            className={cn(
                              "flex-1 px-2 py-1.5 rounded-lg font-jakarta text-xs font-medium transition-colors border",
                              plaqueTab === key
                                ? "bg-sepia/10 text-sepia border-sepia/20"
                                : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {plaqueTab === "glass" && (
                      <div className="space-y-4">

                      {/* Shimmer — the light travelling across the glass. It
                          needs no turning on; this is only how fast it
                          crosses, and 0 holds the panel still. */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300">Glass Shimmer</label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {plaqueConfig.plaqueShimmerSpeed === 0
                              ? "Off"
                              : `${plaqueConfig.plaqueShimmerSpeed.toFixed(1)}×`}
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={3} step={0.1}
                          value={plaqueConfig.plaqueShimmerSpeed}
                          onPointerDown={snapshot}
                          onChange={(e) => updatePlaqueConfig("plaqueShimmerSpeed", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                          A band of light sweeping the backing panel. 0 turns the motion off.
                        </p>
                      </div>

                      {/* How hot the band burns, separate from how fast it
                          travels — a sweep can be the right pace and still be
                          too bright for a pale plaque. */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300">Shimmer Brightness</label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {plaqueConfig.plaqueShimmerStrength === 0
                              ? "Off"
                              : `${Math.round(plaqueConfig.plaqueShimmerStrength * 100)}%`}
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={plaqueConfig.plaqueShimmerStrength}
                          onPointerDown={snapshot}
                          onChange={(e) => updatePlaqueConfig("plaqueShimmerStrength", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                          How white the sweep burns. 0 hides it without changing the speed.
                        </p>
                      </div>

                      {/* Brightness */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300">Glass Brightness</label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {Math.round(plaqueConfig.brightness * 100)}%
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={2} step={0.05}
                          value={plaqueConfig.brightness}
                          onPointerDown={snapshot}
                          onChange={(e) => updatePlaqueConfig("brightness", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                      </div>

                      {/* Darkness — tints the glass toward near-black */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300">Glass Darkness</label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {Math.round(plaqueConfig.darkness * 100)}%
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={plaqueConfig.darkness}
                          onPointerDown={snapshot}
                          onChange={(e) => updatePlaqueConfig("darkness", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                          Tints the plaque (and the logo plate) toward black.
                        </p>
                      </div>

                      {/* Logo Scale */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300">Logo Size</label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {Math.round(plaqueConfig.logoScale * 100)}%
                          </span>
                        </div>
                        <input
                          type="range" min={0.25} max={3} step={0.05}
                          value={plaqueConfig.logoScale}
                          onPointerDown={snapshot}
                          onChange={(e) => updatePlaqueConfig("logoScale", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                      </div>

                      </div>
                      )}

                      {plaqueTab === "text" && (
                      <div className="space-y-4">

                      {/* Per-field font size + family + colour */}
                      {(
                        [
                          { label: "Name",     sizeKey: "nameSize" as const,     familyKey: "nameFontFamily" as const,     colorKey: "nameColor" as const,     min: 0.12, max: 0.7,  step: 0.01 },
                          { label: "Headline", sizeKey: "headlineSize" as const,  familyKey: "headlineFontFamily" as const, colorKey: "headlineColor" as const, min: 0.1,  max: 0.5,  step: 0.01 },
                          { label: "Facts",    sizeKey: "factsSize" as const,     familyKey: "factsFontFamily" as const,    colorKey: "factsColor" as const,    min: 0.08, max: 0.35, step: 0.005 },
                          { label: "Bio",      sizeKey: "bioSize" as const,       familyKey: "bioFontFamily" as const,      colorKey: "bioColor" as const,      min: 0.08, max: 0.35, step: 0.005 },
                        ] as const
                      ).map(({ label, sizeKey, familyKey, colorKey, min, max, step }) => (
                        <div key={label} className="space-y-1.5">
                          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 font-medium">{label}</p>
                          {/* Font family picker */}
                          <select
                            value={plaqueConfig[familyKey]}
                            onChange={(e) => updatePlaqueConfig(familyKey, e.target.value)}
                            className="admin-input w-full rounded-lg px-2 py-1 text-[11px] font-body"
                          >
                            {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                              <option key={path} value={path}>{name}</option>
                            ))}
                          </select>
                          {/* Font size slider */}
                          <div className="flex items-center gap-2">
                            <input
                              type="range" min={min} max={max} step={step}
                              value={plaqueConfig[sizeKey]}
                              onPointerDown={snapshot}
                              onChange={(e) => updatePlaqueConfig(sizeKey, Number(e.target.value))}
                              className="flex-1 touch-none"
                            />
                            <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300 w-10 text-right">
                              {plaqueConfig[sizeKey].toFixed(3)}
                            </span>
                          </div>
                          {/* Font colour */}
                          <div className="flex items-center gap-3">
                            <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-12 shrink-0">Colour</span>
                            <HexColorField
                              value={plaqueConfig[colorKey]}
                              onBeginEdit={snapshot}
                              onChange={(hex) => updatePlaqueConfig(colorKey, hex)}
                            />
                          </div>
                        </div>
                      ))}

                      </div>
                      )}

                      {plaqueTab === "skills" && (
                      <div className="space-y-4">

                      {/* "Artist Skills" heading */}
                      <div className="space-y-1.5">
                        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 font-medium">Skills Heading</p>
                        <input
                          type="text"
                          value={plaqueConfig.skillsLabel}
                          onFocus={snapshot}
                          onChange={(e) => updatePlaqueConfig("skillsLabel", e.target.value)}
                          placeholder="Artist Skills (blank hides it)"
                          className="admin-input w-full px-3 py-1.5 rounded-lg text-xs"
                        />
                        <select
                          value={plaqueConfig.skillsLabelFontFamily}
                          onChange={(e) => { snapshot(); updatePlaqueConfig("skillsLabelFontFamily", e.target.value); }}
                          className="admin-input w-full rounded-lg px-2 py-1 text-[11px] font-body"
                        >
                          {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                            <option key={path} value={path}>{name}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0.08} max={0.4} step={0.005}
                            value={plaqueConfig.skillsLabelSize}
                            onPointerDown={snapshot}
                            onChange={(e) => updatePlaqueConfig("skillsLabelSize", Number(e.target.value))}
                            className="flex-1 touch-none"
                          />
                          <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300 w-10 text-right">
                            {plaqueConfig.skillsLabelSize.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-12 shrink-0">Colour</span>
                          <HexColorField
                            value={plaqueConfig.skillsLabelColor}
                            onBeginEdit={snapshot}
                            onChange={(hex) => updatePlaqueConfig("skillsLabelColor", hex)}
                          />
                        </div>
                      </div>

                      {/* Skill pills — every pill now reads the same style;
                          no more per-skill accent tint. */}
                      <div className="space-y-1.5 border-t border-black/5 dark:border-white/5 pt-3">
                        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 font-medium">Skill Pills</p>
                        <select
                          value={plaqueConfig.skillsPillFontFamily}
                          onChange={(e) => { snapshot(); updatePlaqueConfig("skillsPillFontFamily", e.target.value); }}
                          className="admin-input w-full rounded-lg px-2 py-1 text-[11px] font-body"
                        >
                          {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                            <option key={path} value={path}>{name}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0.35} max={2} step={0.05}
                            value={plaqueConfig.skillsPillFontSize}
                            onPointerDown={snapshot}
                            onChange={(e) => updatePlaqueConfig("skillsPillFontSize", Number(e.target.value))}
                            className="flex-1 touch-none"
                          />
                          <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300 w-10 text-right">
                            {Math.round(plaqueConfig.skillsPillFontSize * 100)}%
                          </span>
                        </div>
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          Shrinks further only if it wouldn&apos;t fit in 2 rows.
                        </p>
                        <div className="flex items-center gap-3">
                          <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-12 shrink-0">Text</span>
                          <HexColorField
                            value={plaqueConfig.skillsPillTextColor}
                            onBeginEdit={snapshot}
                            onChange={(hex) => updatePlaqueConfig("skillsPillTextColor", hex)}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-12 shrink-0">Pill</span>
                          <HexColorField
                            value={plaqueConfig.skillsPillColor}
                            onBeginEdit={snapshot}
                            onChange={(hex) => updatePlaqueConfig("skillsPillColor", hex)}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(
                            [
                              { key: "left" as const, icon: AlignLeft, label: "Left" },
                              { key: "center" as const, icon: AlignCenter, label: "Center" },
                            ]
                          ).map(({ key, icon: Icon, label }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => { snapshot(); updatePlaqueConfig("skillsAlign", key); }}
                              className={cn(
                                "flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg font-jakarta text-xs font-medium transition-colors border",
                                plaqueConfig.skillsAlign === key
                                  ? "bg-sepia/10 text-sepia border-sepia/20"
                                  : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                              )}
                            >
                              <Icon size={13} /> {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      </div>
                      )}
                    </div>
                  )}

                  {/* --- Certs / Calling Card / Gigs editable banner ------ */}
                  {isAboutLabelKind(selectedSceneObject.kind) && (
                    <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-3">
                      <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        {selectedSceneObject.kind === ABOUT_CARD_KIND
                          ? "Calling Card Title"
                          : selectedSceneObject.kind === ABOUT_GIGS_KIND
                            ? "Timeline & Gigs Title"
                            : "Certificates Banner"}
                      </p>
                      <div>
                        <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                          Text
                        </label>
                        <input
                          type="text"
                          value={aboutLabelConfig.text}
                          onFocus={snapshot}
                          onChange={(e) => updateAboutLabelConfig("text", e.target.value)}
                          placeholder="Heading…"
                          className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                          Font Style
                        </label>
                        <select
                          value={aboutLabelConfig.fontFamily}
                          onChange={(e) => { snapshot(); updateAboutLabelConfig("fontFamily", e.target.value); }}
                          className="admin-input w-full rounded-lg px-2 py-1.5 text-xs font-body"
                        >
                          {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                            <option key={path} value={path}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                            Font Size
                          </label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {aboutLabelConfig.fontSize.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range" min={0.06} max={0.4} step={0.005}
                          value={aboutLabelConfig.fontSize}
                          onPointerDown={snapshot}
                          onChange={(e) => updateAboutLabelConfig("fontSize", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-24 shrink-0">
                          Text Color
                        </label>
                        <HexColorField
                          value={aboutLabelConfig.textColor}
                          onBeginEdit={snapshot}
                          onChange={(hex) => updateAboutLabelConfig("textColor", hex)}
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-24 shrink-0">
                          Plate Color
                        </label>
                        <HexColorField
                          value={aboutLabelConfig.backgroundColor}
                          onBeginEdit={snapshot}
                          onChange={(hex) => updateAboutLabelConfig("backgroundColor", hex)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                            Plate Opacity
                          </label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {Math.round(aboutLabelConfig.backgroundOpacity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range" min={0} max={1} step={0.05}
                          value={aboutLabelConfig.backgroundOpacity}
                          onPointerDown={snapshot}
                          onChange={(e) => updateAboutLabelConfig("backgroundOpacity", Number(e.target.value))}
                          className="w-full touch-none"
                        />
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                          0% hides the plate behind the text.
                        </p>
                      </div>
                      {/* Gigs only — the caption strip under the map. The other
                          two label kinds have no description to size. */}
                      {selectedSceneObject.kind === ABOUT_GIGS_KIND && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                              Description Size
                            </label>
                            <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                              {Math.round(aboutLabelConfig.descriptionScale * 100)}%
                            </span>
                          </div>
                          <input
                            type="range" min={0.5} max={2} step={0.05}
                            value={aboutLabelConfig.descriptionScale}
                            onPointerDown={snapshot}
                            onChange={(e) =>
                              updateAboutLabelConfig("descriptionScale", Number(e.target.value))
                            }
                            className="w-full touch-none"
                          />
                          <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                            The next event&apos;s name, date and venue under the map — and the
                            plate behind them.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- One certificate at a time ----------------------- */}
                  {/* The controls above move and resize the whole strip; this
                      picks a single certificate out of it and nudges that one
                      alone. Both write the same block, so an admin can hang
                      one piece higher and still slide the row as a unit
                      afterwards — see aboutRoomBlocks' CertPlacement. */}
                  {selectedSceneObject.kind === ABOUT_CERTS_KIND && (
                    <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Each Certificate
                        </p>
                        {movedCertCount > 0 && (
                          <button
                            type="button"
                            onClick={() => { snapshot(); resetCertPlacement("all"); }}
                            className="inline-flex items-center gap-1 font-jakarta text-[11px] font-medium text-sepia hover:underline"
                          >
                            <RotateCcw size={11} /> Reset all ({movedCertCount})
                          </button>
                        )}
                      </div>

                      {wallCertificates.length === 0 ? (
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          No certificates yet — add them under About ScriptOverNovel, and each one
                          becomes movable here.
                        </p>
                      ) : (
                        <>
                          <AdminSelect
                            className="py-1.5 font-body text-xs"
                            value={certPlacementTarget}
                            onChange={(e) => setCertPlacementTarget(e.target.value)}
                          >
                            <option value="all">All together (the sliders above)</option>
                            {wallCertificates.map((cert, i) => (
                              <option key={cert.id} value={cert.id}>
                                {i + 1}. {cert.title}
                                {certPlacements[cert.id] ? " •" : ""}
                              </option>
                            ))}
                          </AdminSelect>

                          {selectedCertPlacement ? (
                            <>
                              {/* Slide along the wall — a delta from the even
                                  spread, so 0 is "back in line with the rest". */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                    Slide
                                  </label>
                                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                    {selectedCertPlacement.along >= 0 ? "+" : ""}
                                    {selectedCertPlacement.along.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={CERT_NUDGE_MIN} max={CERT_NUDGE_MAX} step={0.05}
                                  value={selectedCertPlacement.along}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateCertPlacement(certPlacementTarget, "along", Number(e.target.value))
                                  }
                                  className="w-full touch-none"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                    Raise
                                  </label>
                                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                    {selectedCertPlacement.height >= 0 ? "+" : ""}
                                    {selectedCertPlacement.height.toFixed(2)}m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={CERT_NUDGE_MIN} max={CERT_NUDGE_MAX} step={0.05}
                                  value={selectedCertPlacement.height}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateCertPlacement(certPlacementTarget, "height", Number(e.target.value))
                                  }
                                  className="w-full touch-none"
                                />
                              </div>

                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                    Size
                                  </label>
                                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                    {Math.round(selectedCertPlacement.scale * 100)}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={CERT_ITEM_SCALE_MIN} max={CERT_ITEM_SCALE_MAX} step={0.05}
                                  value={selectedCertPlacement.scale}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateCertPlacement(certPlacementTarget, "scale", Number(e.target.value))
                                  }
                                  className="w-full touch-none"
                                />
                                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                                  On top of the strip&apos;s own Resize, so this one reads bigger
                                  or smaller than its neighbours.
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={isDefaultCertPlacement(selectedCertPlacement)}
                                onClick={() => { snapshot(); resetCertPlacement(certPlacementTarget); }}
                                className="w-full px-3 py-2 rounded-xl font-jakarta text-xs font-medium border border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                              >
                                Back in line with the rest
                              </button>
                            </>
                          ) : (
                            <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                              Wall, Hang Width, Hang Height and Resize above move and scale
                              every certificate at once. Pick one to nudge it on its own.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : isSceneBannerKind(selectedSceneObject.kind) ? (
                /* Banner controls: the wording, the three colours, and the
                   title's font/size. Placement is the same drag/turn gizmo
                   every other free-placed object uses.

                   Distinct from the Freedom Wall Plaque panel further down
                   despite the two sharing a renderer: that plaque's wording
                   comes from whichever event is active and is deliberately
                   not editable here, so it offers colours only. */
                <div className="space-y-3">
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                    A titled sign. Drag it into place and turn it with the gizmo, then write it
                    here — it sizes itself to the text unless you set a width below.
                  </p>
                  {/* Only worth saying in a room that also has built-in labels:
                      there, two panels offer the same colours, glass and
                      shimmer, and this is the one that changes just this sign.
                      In every other room there is nothing to confuse it with. */}
                  {roomBannerObject && (
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                      Everything here styles <strong className="font-medium">this banner only</strong>.
                      The labels this room draws for you are the {ROOM_BANNER_LABEL} card,
                      further down.
                    </p>
                  )}

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                      Text
                    </label>
                    <input
                      type="text"
                      value={sceneBannerConfig.text}
                      maxLength={BANNER_MAX_CHARS}
                      onFocus={snapshot}
                      onChange={(e) => updateSceneBannerConfig("text", e.target.value)}
                      placeholder="Banner"
                      className="mt-1 w-full admin-input border rounded-xl px-3 py-2 font-body text-xs text-ink dark:text-cream placeholder:text-ink-400"
                    />
                  </div>

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                      Eyebrow <span className="normal-case tracking-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={sceneBannerConfig.eyebrow}
                      maxLength={BANNER_EYEBROW_MAX_CHARS}
                      onFocus={snapshot}
                      onChange={(e) => updateSceneBannerConfig("eyebrow", e.target.value)}
                      placeholder="Small line above the title"
                      className="mt-1 w-full admin-input border rounded-xl px-3 py-2 font-body text-xs text-ink dark:text-cream placeholder:text-ink-400"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      Leave it empty and the title centres on its own — the right look for a
                      one-word sign.
                    </p>
                  </div>

                  {/* Three colours, same trio the Freedom Wall plaque exposes,
                      so the two read as one object family in a shared room. */}
                  {(
                    [
                      { key: "backgroundColor" as const, label: "Panel" },
                      { key: "edgeColor" as const, label: "Edge" },
                      { key: "textColor" as const, label: "Text" },
                    ]
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-28 shrink-0">
                        {label}
                      </label>
                      <HexColorField
                        value={sceneBannerConfig[key]}
                        onBeginEdit={snapshot}
                        onChange={(hex) => updateSceneBannerConfig(key, hex)}
                      />
                    </div>
                  ))}

                  <div className="flex items-center gap-3">
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-28 shrink-0">
                      Font
                    </label>
                    <select
                      value={sceneBannerConfig.fontFamily}
                      onChange={(e) => {
                        snapshot();
                        updateSceneBannerConfig("fontFamily", e.target.value);
                      }}
                      className="flex-1 admin-input border rounded-xl px-3 py-2 font-body text-xs text-ink dark:text-cream"
                    >
                      {Object.entries(PLAQUE_FONT_OPTIONS).map(([label, path]) => (
                        <option key={path} value={path}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Text Size
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {sceneBannerConfig.fontSize.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={BANNER_FONT_SIZE_MIN}
                      max={BANNER_FONT_SIZE_MAX}
                      step={0.01}
                      value={sceneBannerConfig.fontSize}
                      onPointerDown={snapshot}
                      onChange={(e) => updateSceneBannerConfig("fontSize", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Height
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {sceneBannerConfig.height.toFixed(2)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={BANNER_MIN_HEIGHT}
                      max={BANNER_MAX_HEIGHT}
                      step={0.05}
                      value={sceneBannerConfig.height}
                      onPointerDown={snapshot}
                      onChange={(e) => updateSceneBannerConfig("height", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                  </div>

                  {/* Width is opt-in: null means "fit the text", which is what
                      a sign should do on its own. The override exists for the
                      case fitting can't serve — two banners that need to match
                      each other rather than their own wording. */}
                  <div className="pt-1 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                          Fixed Width
                        </p>
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          Off = the panel sizes itself to the text. Turn it on to make two banners
                          match each other.
                        </p>
                      </div>
                      <Toggle
                        checked={sceneBannerConfig.width !== null}
                        onChange={(v) => {
                          snapshot();
                          // Switching on starts from roughly what the auto fit
                          // was already giving, so the plaque doesn't jump.
                          updateSceneBannerConfig(
                            "width",
                            v
                              ? Math.min(
                                  BANNER_MAX_WIDTH,
                                  Math.max(
                                    BANNER_MIN_WIDTH,
                                    sceneBannerConfig.text.length * sceneBannerConfig.fontSize * 0.55 + 1.1
                                  )
                                )
                              : null
                          );
                        }}
                        label="Give this banner a fixed width"
                      />
                    </div>
                    {sceneBannerConfig.width !== null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                            Width
                          </label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {sceneBannerConfig.width.toFixed(2)}m
                          </span>
                        </div>
                        <input
                          type="range"
                          min={BANNER_MIN_WIDTH}
                          max={BANNER_MAX_WIDTH}
                          step={0.1}
                          value={sceneBannerConfig.width}
                          onPointerDown={snapshot}
                          onChange={(e) => updateSceneBannerConfig("width", Number(e.target.value))}
                          className="w-full touch-none accent-sepia"
                        />
                      </div>
                    )}
                  </div>

                  {/* --- Surface -------------------------------------------
                      The same finish the room's own labels wear (the Room
                      Label Style card), carried per banner: a sign an admin
                      placed for a reason should be able to be glass in a room
                      of painted price tags. Drawn by the same BannerPanel, so
                      the two can't drift. */}
                  <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                    <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Surface
                    </p>
                    <TextureField
                      label="Panel Texture"
                      value={sceneBannerConfig.textureUrl}
                      onChange={(url) => {
                        snapshot();
                        updateSceneBannerConfig("textureUrl", url);
                      }}
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                      Stretched across this banner. The Panel colour above still tints it, so set
                      that to white to show the image as uploaded.
                    </p>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Edge Width
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {sceneBannerConfig.edgeThickness === 0
                            ? "None"
                            : `${Math.round(sceneBannerConfig.edgeThickness * 100)}cm`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_BANNER_EDGE}
                        max={MAX_BANNER_EDGE}
                        step={0.005}
                        value={sceneBannerConfig.edgeThickness}
                        onPointerDown={snapshot}
                        onChange={(e) =>
                          updateSceneBannerConfig("edgeThickness", Number(e.target.value))
                        }
                        className="w-full touch-none accent-sepia"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Brightness
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {Math.round(sceneBannerConfig.brightness * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_BANNER_BRIGHTNESS}
                        max={MAX_BANNER_BRIGHTNESS}
                        step={0.05}
                        value={sceneBannerConfig.brightness}
                        onPointerDown={snapshot}
                        onChange={(e) =>
                          updateSceneBannerConfig("brightness", Number(e.target.value))
                        }
                        className="w-full touch-none accent-sepia"
                      />
                      <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                        Lifts the panel out of a dim corner. The lettering is left alone.
                      </p>
                    </div>
                  </div>

                  {/* --- Glassmorphism ------------------------------------- */}
                  <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                        Glassmorphism
                      </span>
                      <input
                        type="checkbox"
                        checked={sceneBannerConfig.glassEnabled}
                        onChange={(e) => {
                          snapshot();
                          updateSceneBannerConfig("glassEnabled", e.target.checked);
                        }}
                        className="accent-emerald-500 w-4 h-4"
                      />
                    </label>
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                      A frosted translucent panel instead of a solid painted one — drop the opacity
                      right down and the room shows through it.
                    </p>
                    {sceneBannerConfig.glassEnabled && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                              Glass Opacity
                            </label>
                            <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                              {Math.round(sceneBannerConfig.glassOpacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={MIN_BANNER_GLASS_OPACITY}
                            max={MAX_BANNER_GLASS_OPACITY}
                            step={0.01}
                            value={sceneBannerConfig.glassOpacity}
                            onPointerDown={snapshot}
                            onChange={(e) =>
                              updateSceneBannerConfig("glassOpacity", Number(e.target.value))
                            }
                            className="w-full touch-none accent-sepia"
                          />
                        </div>

                        <label className="flex items-center justify-between gap-2 cursor-pointer pt-1">
                          <span className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                            Shimmer
                          </span>
                          <input
                            type="checkbox"
                            checked={sceneBannerConfig.shimmerEnabled}
                            onChange={(e) => {
                              snapshot();
                              updateSceneBannerConfig("shimmerEnabled", e.target.checked);
                            }}
                            className="accent-emerald-500 w-4 h-4"
                          />
                        </label>
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          A band of light travelling across the glass.
                        </p>
                        {sceneBannerConfig.shimmerEnabled && (
                          <>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                  Shimmer Speed
                                </label>
                                <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                  {sceneBannerConfig.shimmerSpeed.toFixed(2)}/s
                                </span>
                              </div>
                              <input
                                type="range"
                                min={MIN_BANNER_SHIMMER_SPEED}
                                max={MAX_BANNER_SHIMMER_SPEED}
                                step={0.05}
                                value={sceneBannerConfig.shimmerSpeed}
                                onPointerDown={snapshot}
                                onChange={(e) =>
                                  updateSceneBannerConfig("shimmerSpeed", Number(e.target.value))
                                }
                                className="w-full touch-none accent-sepia"
                              />
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                  Shimmer Strength
                                </label>
                                <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                  {Math.round(sceneBannerConfig.shimmerStrength * 100)}%
                                </span>
                              </div>
                              <input
                                type="range"
                                min={MIN_BANNER_SHIMMER_STRENGTH}
                                max={MAX_BANNER_SHIMMER_STRENGTH}
                                step={0.05}
                                value={sceneBannerConfig.shimmerStrength}
                                onPointerDown={snapshot}
                                onChange={(e) =>
                                  updateSceneBannerConfig("shimmerStrength", Number(e.target.value))
                                }
                                className="w-full touch-none accent-sepia"
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : isDividerKind(selectedSceneObject.kind) ? (
                /* Divider wall controls: size, surface (plain colour or an
                   uploaded texture, optionally mirrored), and whether
                   visitors are blocked by it. Placement is the same drag/
                   turn gizmo every other free-placed object uses. */
                <div className="space-y-3">
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                    A movable wall. Drag it into place and turn it with the gizmo, then size it
                    here — artworks can hang on either face (pick it in a frame&apos;s Wall list).
                  </p>
                  {(
                    [
                      { key: "width" as const, label: "Width", min: DIVIDER_MIN_WIDTH, max: DIVIDER_MAX_WIDTH, step: 0.1 },
                      { key: "height" as const, label: "Height", min: DIVIDER_MIN_HEIGHT, max: DIVIDER_MAX_HEIGHT, step: 0.1 },
                      { key: "thickness" as const, label: "Thickness", min: DIVIDER_MIN_THICKNESS, max: DIVIDER_MAX_THICKNESS, step: 0.05 },
                    ]
                  ).map(({ key, label, min, max, step }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                          {label}
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {dividerConfig[key].toFixed(2)}m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={dividerConfig[key]}
                        onPointerDown={snapshot}
                        onChange={(e) => updateDividerConfig(key, Number(e.target.value))}
                        className="w-full touch-none accent-sepia"
                      />
                    </div>
                  ))}
                  <div className="flex items-center gap-3">
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-28 shrink-0">
                      Colour
                    </label>
                    <HexColorField
                      value={dividerConfig.color}
                      onBeginEdit={snapshot}
                      onChange={(hex) => updateDividerConfig("color", hex)}
                    />
                  </div>
                  {/* Surface texture — the same uploader a room's own wall
                      texture uses, so a divider can be finished in the very
                      material the room around it is. No upload = the plain
                      colour above, which is how a new divider starts. */}
                  <div className="pt-1 border-t border-black/5 dark:border-white/5">
                    <TextureField
                      label="Wall Texture"
                      value={dividerConfig.textureUrl}
                      onChange={(url) => {
                        snapshot();
                        updateDividerConfig("textureUrl", url);
                        toast.success(
                          url
                            ? "Divider texture applied — remember to Save"
                            : "Divider texture removed — remember to Save"
                        );
                      }}
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      Tiled every 2m, same as a room&apos;s wall texture. Leave it empty to use the
                      plain colour above.
                    </p>
                  </div>
                  {dividerConfig.textureUrl && (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                          Mirror Texture
                        </p>
                        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          Flips every other tile so the joins read as a reflection instead of a
                          visible seam.
                        </p>
                      </div>
                      <Toggle
                        checked={dividerConfig.mirrored}
                        onChange={(v) => {
                          snapshot();
                          updateDividerConfig("mirrored", v);
                          toast.success(
                            v
                              ? "Mirror Texture on — remember to Save"
                              : "Mirror Texture off — remember to Save"
                          );
                        }}
                        label="Mirror the divider's texture"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3 pt-1 border-t border-black/5 dark:border-white/5">
                    <div>
                      <p className="font-jakarta text-xs font-medium text-ink dark:text-cream">Solid</p>
                      <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                        Visitors are stopped by this wall instead of walking through it. Switch it
                        off to use the panel as a see-through backdrop.
                      </p>
                    </div>
                    <Toggle
                      checked={dividerConfig.solid}
                      onChange={(v) => {
                        snapshot();
                        updateDividerConfig("solid", v);
                        toggleStaged("Divider", v, {
                          on: "is solid",
                          off: "is walk-through",
                        });
                      }}
                      label="Block visitors with this divider"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums pt-1 border-t border-black/5 dark:border-white/5">
                    <div>X: {selectedSceneObject.positionX.toFixed(2)}</div>
                    <div>Y: {selectedSceneObject.positionY.toFixed(2)}</div>
                    <div>Z: {selectedSceneObject.positionZ.toFixed(2)}</div>
                    <div>{((selectedSceneObject.rotationY * 180) / Math.PI).toFixed(0)}°</div>
                  </div>
                </div>
              ) : isTextKind(selectedSceneObject.kind) ? (
                /* Text label controls: content, font size, font family, color */
                <div className="space-y-3">
                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Text Content
                    </label>
                    <textarea
                      rows={3}
                      value={textConfig.text}
                      onChange={(e) => updateTextConfig("text", e.target.value)}
                      placeholder="Enter text…"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Font Size
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {textConfig.fontSize.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min={0.05} max={0.8} step={0.01}
                      value={textConfig.fontSize}
                      onPointerDown={snapshot}
                      onChange={(e) => updateTextConfig("fontSize", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Max Width
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {textConfig.maxWidth.toFixed(1)}
                      </span>
                    </div>
                    <input
                      type="range" min={0.5} max={8} step={0.1}
                      value={textConfig.maxWidth}
                      onPointerDown={snapshot}
                      onChange={(e) => updateTextConfig("maxWidth", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                  </div>
                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Font Style
                    </label>
                    <select
                      value={textConfig.fontFamily}
                      onChange={(e) => updateTextConfig("fontFamily", e.target.value)}
                      className="admin-input w-full rounded-lg px-2 py-1.5 text-xs font-body"
                    >
                      {Object.entries(PLAQUE_FONT_OPTIONS).map(([label, path]) => (
                        <option key={path} value={path}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                      Color
                    </label>
                    <HexColorField
                      value={textConfig.color}
                      onBeginEdit={snapshot}
                      onChange={(hex) => updateTextConfig("color", hex)}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums pt-1 border-t border-black/5 dark:border-white/5">
                    <div>X: {selectedSceneObject.positionX.toFixed(2)}</div>
                    <div>Y: {selectedSceneObject.positionY.toFixed(2)}</div>
                    <div>Z: {selectedSceneObject.positionZ.toFixed(2)}</div>
                    <div>{((selectedSceneObject.rotationY * 180) / Math.PI).toFixed(0)}°</div>
                  </div>
                </div>
              ) : isBannerKind(selectedSceneObject.kind) ? (
                /* Freedom Wall plaque controls: colors + the title's font —
                   its text is always the active event's title (rename the
                   event in the Freedom Wall admin tab to change what it
                   says). */
                <div className="space-y-3">
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                    Showing: <strong className="text-ink dark:text-cream">{freedomWallEventTitle ?? "Freedom Wall"}</strong>
                    {" — "}rename the event in the Freedom Wall admin tab to change this text.
                  </p>
                  {(
                    [
                      { key: "backgroundColor" as const, label: "Background" },
                      { key: "edgeColor" as const, label: "Edge / Eyebrow" },
                      { key: "textColor" as const, label: "Text" },
                    ]
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest w-28 shrink-0">
                        {label}
                      </label>
                      <HexColorField
                        value={bannerColors[key]}
                        onBeginEdit={snapshot}
                        onChange={(hex) => updateBannerColors(key, hex)}
                      />
                    </div>
                  ))}
                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Font Style
                    </label>
                    <select
                      value={bannerColors.fontFamily}
                      onChange={(e) => {
                        snapshot();
                        updateBannerColors("fontFamily", e.target.value);
                      }}
                      className="admin-input w-full rounded-lg px-2 py-1.5 text-xs font-body"
                    >
                      {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                        <option key={path} value={path}>{name}</option>
                      ))}
                    </select>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                      Applies to the event title only — the &quot;FREEDOM WALL&quot; label above it stays fixed.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Font Size
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {bannerColors.fontSize.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range" min={PLAQUE_FONT_SIZE_MIN} max={PLAQUE_FONT_SIZE_MAX} step={0.01}
                      value={bannerColors.fontSize}
                      onPointerDown={snapshot}
                      onChange={(e) => updateBannerColors("fontSize", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2 font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums pt-1 border-t border-black/5 dark:border-white/5">
                    <div>X: {selectedSceneObject.positionX.toFixed(2)}</div>
                    <div>Y: {selectedSceneObject.positionY.toFixed(2)}</div>
                    <div>Z: {selectedSceneObject.positionZ.toFixed(2)}</div>
                    <div>{((selectedSceneObject.rotationY * 180) / Math.PI).toFixed(0)}°</div>
                  </div>
                </div>
              ) : (
                /* Custom decorative object: Name + Size slider + N/E/S/W facing + 15° nudge + X/Y/Z readout.
                   The Contact Desk and the wall clock share this branch — both
                   are placed the same free way — minus the Name field, which is
                   only persisted for custom props (their own config panels name
                   them instead). */
                <div className="space-y-3">
                  {!isAboutFixtureKind(selectedSceneObject.kind) && (
                  <div>
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1 block">
                      Name
                    </label>
                    <input
                      type="text"
                      value={selectedSceneObject.label ?? ""}
                      maxLength={MAX_SCENE_LABEL}
                      onFocus={snapshot}
                      onChange={(e) =>
                        updateSceneObjectLocal(selectedSceneObject.id, {
                          label: e.target.value.slice(0, MAX_SCENE_LABEL) || null,
                        })
                      }
                      placeholder="Decorative Object"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                  </div>
                  )}
                  {/* Size. The slider's range is in multiples of the model's
                      own unit scale rather than of its raw exported numbers,
                      so a centimetre-authored .glb is adjustable at all — at
                      a flat 0.1x floor its smallest possible size is still
                      hundreds of metres. For a model already authored in
                      metres the unit scale is exactly 1 and this is the same
                      0.1x–5x slider it has always been. */}
                  {(() => {
                    const unit = isAboutFixtureKind(selectedSceneObject.kind)
                      ? 1
                      : modelUnitScale(measuredSpans[selectedSceneObject.id]);
                    const span = measuredSpans[selectedSceneObject.id];
                    return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Size
                      </label>
                      <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                        {Math.round((selectedSceneObject.scale / unit) * 100)}%
                        {span ? ` · ${(span * selectedSceneObject.scale).toFixed(2)}m` : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MODEL_SCALE_MIN * unit}
                      max={MODEL_SCALE_MAX * unit}
                      step={0.05 * unit}
                      value={selectedSceneObject.scale}
                      onPointerDown={snapshot}
                      onChange={(e) => updateSceneObjectLocal(selectedSceneObject.id, { scale: Number(e.target.value) })}
                      className="w-full touch-none"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      {isAboutFixtureKind(selectedSceneObject.kind)
                        ? "100% is its designed size. The preview shows the size visitors will see."
                        : unit === 1
                          ? "Resizes the uploaded model — 100% is its exported size."
                          : "This model wasn't exported in metres, so it was resized to fit the room — 100% is that fitted size."}
                    </p>
                  </div>
                    );
                  })()}

                  {/* --- Facing: N/E/S/W snap + 15° nudge -------------------
                      The rotate gizmo still works; these just land the model
                      square without fighting the drag ring. */}
                  <div className="border-t border-black/5 dark:border-white/5 pt-3">
                    <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1.5">
                      Facing
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(["north", "east", "south", "west"] as AboutWall[]).map((wall) => {
                        const diff = Math.abs(
                          Math.atan2(
                            Math.sin(selectedSceneObject.rotationY - WALL_ROT_Y[wall]),
                            Math.cos(selectedSceneObject.rotationY - WALL_ROT_Y[wall])
                          )
                        );
                        const isCurrent = diff < 0.02;
                        return (
                          <button
                            key={wall}
                            type="button"
                            title={`Face ${wall}`}
                            onClick={() => setSceneObjectFacing(selectedSceneObject.id, wall)}
                            className={cn(
                              "px-2 py-2 rounded-xl font-jakarta text-xs font-medium transition-colors border uppercase",
                              isCurrent
                                ? "bg-sepia/10 text-sepia border-sepia/20"
                                : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                            )}
                          >
                            {wall.charAt(0)}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <button
                        type="button"
                        title="Rotate −15°"
                        onClick={() => rotateSceneObject(selectedSceneObject.id, -ROTATE_STEP)}
                        className="p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300 w-12 text-center">
                        {(((selectedSceneObject.rotationY * 180) / Math.PI + 360) % 360).toFixed(0)}°
                      </span>
                      <button
                        type="button"
                        title="Rotate +15°"
                        onClick={() => rotateSceneObject(selectedSceneObject.id, ROTATE_STEP)}
                        className="p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <RotateCw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* --- Solid: block visitors from walking through --------
                      Feeds the public museum's player collision. The size
                      is auto-fit from the model's bounding box the moment
                      it's switched on; the slider is an override. */}
                  {/* Only a custom .glb prop persists `solid` / `colliderRadius`
                      (see handleSave's per-kind body). The Contact Desk shares
                      this branch but is always solid in the museum, at its own
                      known footprint — furniture, like a Stories podium — so
                      offering it a toggle here would be a control that saves
                      nothing. */}
                  {selectedSceneObject.kind === "custom" && (
                  <div className="border-t border-black/5 dark:border-white/5 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSceneObject.solid}
                        onChange={(e) => {
                          const on = e.target.checked;
                          const fit = measuredFits[selectedSceneObject.id];
                          snapshot();
                          updateSceneObjectLocal(selectedSceneObject.id, {
                            solid: on,
                            // The measurement is stored as measured, in the
                            // model's own units, and clamped to metres only
                            // where it's read (colliderWorldRadius). Clamping
                            // it here pinned a centimetre-authored model's
                            // four-figure radius to 12 before its ~0.0004
                            // scale was applied, leaving a footprint of a few
                            // millimetres under a two-metre prop.
                            //
                            // A prop with no footprint yet gets the *fitted*
                            // circle — the one that wraps the geometry where
                            // it actually stands — rather than the old
                            // reach-from-origin radius, which for a model
                            // exported away from its origin was a ring several
                            // times the width of the prop. The reach value is
                            // still the fallback, for a model that hasn't
                            // finished measuring.
                            colliderRadius: on
                              ? selectedSceneObject.colliderRadius ??
                                fit?.radius ??
                                measuredRadii[selectedSceneObject.id] ??
                                null
                              : selectedSceneObject.colliderRadius,
                            ...(on && selectedSceneObject.colliderRadius == null && fit
                              ? { colliderOffsetX: fit.offsetX, colliderOffsetZ: fit.offsetZ }
                              : null),
                          });
                          toggleStaged(sceneObjectLabel(selectedSceneObject), on, {
                            on: "is solid",
                            off: "is walk-through",
                          });
                        }}
                        className="accent-sepia"
                      />
                      <span className="font-body text-xs text-ink dark:text-cream font-medium">
                        Solid — visitors can&apos;t walk through
                      </span>
                    </label>

                    {selectedSceneObject.solid && (() => {
                      // `measured` and the stored `colliderRadius` are both in
                      // the model's own units; everything shown here is in
                      // metres. Converting once, up front, is what keeps the
                      // readout and the ring in the preview agreeing — a
                      // centimetre-authored .glb has a four-figure radius and a
                      // four-decimal scale, and clamping either one before they
                      // are multiplied gives a number belonging to neither.
                      const scale = selectedSceneObject.scale || 1;
                      const measured = measuredRadii[selectedSceneObject.id] ?? null;
                      const fit = measuredFits[selectedSceneObject.id] ?? null;
                      // The circle's centre, in metres, in the prop's own
                      // rotated frame — the frame the ring is drawn in, so
                      // "Right" moves it toward the model's own right however
                      // the prop has been turned.
                      const offsetX = colliderWorldOffset(selectedSceneObject.colliderOffsetX, scale);
                      const offsetZ = colliderWorldOffset(selectedSceneObject.colliderOffsetZ, scale);
                      const offCentre = Math.abs(offsetX) > 0.001 || Math.abs(offsetZ) > 0.001;
                      // Clamped in metres: a radius stored before measurements
                      // were sanitized (or typed in by a bad model) could
                      // otherwise render a readout in scientific notation and a
                      // slider whose whole travel is one pixel wide.
                      const radius = colliderWorldRadius(
                        selectedSceneObject.colliderRadius ?? measured,
                        scale
                      );
                      const worldDiameter = radius * 2;
                      const sliderMax = Math.min(
                        MAX_COLLIDER_RADIUS,
                        Math.max(
                          4,
                          Math.ceil(
                            colliderWorldRadius(
                              measured ?? selectedSceneObject.colliderRadius,
                              scale
                            ) * 1.5
                          )
                        )
                      );
                      // Travel for the two offset sliders: enough to walk the
                      // circle right off the far side of the model it belongs
                      // to (a footprint further from its prop than that is a
                      // mistake, not a placement), bounded by the same metre
                      // ceiling the stored value is clamped to.
                      const offsetLimit = Math.min(
                        MAX_COLLIDER_OFFSET,
                        Math.max(2, Math.ceil(radius * 3))
                      );
                      // How tall the blocked column stands, in metres, or
                      // null for the floor-to-ceiling default every solid
                      // prop had before this was configurable. Same
                      // multiply-then-clamp helper the public museum's
                      // collision goes through, so the band drawn in the
                      // preview is the band a visitor is actually stopped by.
                      const height = colliderWorldHeight(
                        selectedSceneObject.colliderHeight,
                        scale
                      );
                      // The model's own reach above its base, in model units
                      // — what "on" starts at when we have a measurement.
                      const measuredHeight = fit?.top && fit.top > 0 ? fit.top : null;
                      // How far that column is lifted off the base, in metres.
                      // Read through the same helper the museum's collision
                      // uses, so the ring the admin drags is the height the
                      // visitor is actually stopped from.
                      const baseY = colliderWorldBaseY(
                        selectedSceneObject.colliderBaseY,
                        scale
                      );
                      return (
                        <div className="mt-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                              Collision Size
                            </label>
                            <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                              ⌀ {worldDiameter.toFixed(2)} m
                            </span>
                          </div>
                          {/* Dragged in metres — what the ⌀ readout above and
                              the ring in the preview both show — and stored
                              back in the model's units, which is how the
                              public museum reads it (resized with the prop,
                              see colliderWorldRadius). */}
                          <input
                            type="range"
                            min={MIN_COLLIDER_RADIUS}
                            max={sliderMax}
                            step={0.05}
                            value={radius}
                            onPointerDown={snapshot}
                            onChange={(e) =>
                              updateSceneObjectLocal(selectedSceneObject.id, {
                                colliderRadius: Number(e.target.value) / scale,
                              })
                            }
                            className="w-full touch-none accent-sepia"
                          />
                          {/* --- Collision Position ---------------------
                              A .glb is very often exported with its geometry
                              off to one side of its own origin — the origin
                              is wherever the artist left it, and nothing in
                              the file says otherwise. The footprint used to
                              be pinned to that origin, so for those models
                              the ring sat *beside* the prop and the only
                              lever was to widen it until it happened to
                              cover both, blocking a stretch of bare floor to
                              do it. These two nudge the circle instead. */}
                          <div className="pt-2 mt-0.5 border-t border-black/5 dark:border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                Collision Position
                              </label>
                              {offCentre && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    snapshot();
                                    updateSceneObjectLocal(selectedSceneObject.id, {
                                      colliderOffsetX: 0,
                                      colliderOffsetZ: 0,
                                    });
                                  }}
                                  className="font-jakarta text-[11px] font-medium text-sepia hover:underline"
                                >
                                  Centre
                                </button>
                              )}
                            </div>
                            {/* Dragged in metres and stored in model units,
                                same conversion the size slider above makes,
                                so a resized prop keeps its footprint under
                                the same part of the model. */}
                            {(
                              [
                                { key: "colliderOffsetX" as const, label: "Left / Right", value: offsetX },
                                { key: "colliderOffsetZ" as const, label: "Back / Front", value: offsetZ },
                              ]
                            ).map(({ key, label, value }) => (
                              <div key={key}>
                                <div className="flex items-center justify-between">
                                  <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                                    {label}
                                  </span>
                                  <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300">
                                    {value >= 0 ? "+" : ""}{value.toFixed(2)} m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={-offsetLimit}
                                  max={offsetLimit}
                                  step={0.05}
                                  value={value}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateSceneObjectLocal(selectedSceneObject.id, {
                                      [key]: Number(e.target.value) / scale,
                                    })
                                  }
                                  className="w-full touch-none accent-sepia"
                                />
                              </div>
                            ))}
                          </div>

                          {/* --- Collision Height -----------------------
                              The circle was always a floor-to-ceiling
                              column: a prop was solid at every height or
                              not at all, so a lamp hanging at 3m blocked
                              the floor underneath it and an archway could
                              not be walked through. This gives the circle
                              a top, measured up from the prop's own base,
                              and the visitor is only pushed out while
                              their own body overlaps it. Off by default —
                              a column is still right for a statue, and it
                              is what every prop already placed expects. */}
                          <div className="pt-2 mt-0.5 border-t border-black/5 dark:border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                Collision Height
                              </label>
                              <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                {height == null ? "full height" : `${height.toFixed(2)} m`}
                              </span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={height != null}
                                onChange={(e) => {
                                  snapshot();
                                  updateSceneObjectLocal(selectedSceneObject.id, {
                                    // Switching it on starts at the model's
                                    // own measured height where we have one,
                                    // so the first thing the admin sees is a
                                    // band around the prop rather than an
                                    // arbitrary number they have to correct.
                                    // Stored in model units like every other
                                    // collider field.
                                    colliderHeight: e.target.checked
                                      ? (measuredHeight ?? FALLBACK_COLLIDER_HEIGHT / scale)
                                      : null,
                                  });
                                }}
                                className="accent-sepia"
                              />
                              <span className="font-body text-[11px] text-ink dark:text-cream">
                                Limit how high it blocks
                              </span>
                            </label>
                            {height != null && (
                              <>
                                {/* Dragged in metres, stored in model units —
                                    the same conversion the size and offset
                                    sliders above make, so a resized prop keeps
                                    a column the same height relative to it. */}
                                <input
                                  type="range"
                                  min={MIN_COLLIDER_HEIGHT}
                                  max={MAX_COLLIDER_HEIGHT}
                                  step={0.05}
                                  value={height}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateSceneObjectLocal(selectedSceneObject.id, {
                                      colliderHeight: Number(e.target.value) / scale,
                                    })
                                  }
                                  className="w-full touch-none accent-sepia"
                                />
                                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                                  Measured up from the prop&apos;s own base.
                                  Visitors walk under anything higher than
                                  they are, and can jump over a low one.
                                </p>

                                {/* Lifting the column off the base is the
                                    other half of the same idea: a height
                                    alone can only describe something standing
                                    on the ground, so an archway's crossbeam or
                                    a shelf had no way to be solid where it is
                                    and open underneath. */}
                                <div className="flex items-center justify-between pt-1">
                                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                    Lift off base
                                  </label>
                                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                                    {baseY.toFixed(2)} m
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={MAX_COLLIDER_BASE_Y}
                                  step={0.05}
                                  value={baseY}
                                  onPointerDown={snapshot}
                                  onChange={(e) =>
                                    updateSceneObjectLocal(selectedSceneObject.id, {
                                      colliderBaseY: Number(e.target.value) / scale,
                                    })
                                  }
                                  className="w-full touch-none accent-sepia"
                                />
                                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                                  Raises the whole ring. Leave at 0 for
                                  anything standing on the floor; raise it so
                                  visitors can walk <em>under</em> an archway
                                  or a shelf and still be stopped by it higher
                                  up.
                                </p>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                              Orange ring in the preview marks the blocked area.
                            </p>
                            <button
                              type="button"
                              disabled={measured == null && fit == null}
                              onClick={() => {
                                snapshot();
                                // Stored raw, in the model's own units — the
                                // metre clamp is applied where it's read, not
                                // here, so a model that isn't in metres keeps
                                // a footprint that matches what it looks like.
                                //
                                // Fits the circle *around the geometry* —
                                // centre and half-width both — rather than
                                // around the origin, which is what makes this
                                // land on an off-origin model instead of
                                // beside it. The reach-from-origin radius is
                                // the fallback for a model still measuring.
                                updateSceneObjectLocal(selectedSceneObject.id, {
                                  colliderRadius: fit?.radius ?? measured,
                                  colliderOffsetX: fit?.offsetX ?? 0,
                                  colliderOffsetZ: fit?.offsetZ ?? 0,
                                });
                              }}
                              className="shrink-0 font-jakarta text-[11px] font-medium text-sepia hover:underline disabled:opacity-40 disabled:no-underline"
                            >
                              Fit to model
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  )}

                  <div className="grid grid-cols-4 gap-2 font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums pt-1 border-t border-black/5 dark:border-white/5">
                    <div>X: {selectedSceneObject.positionX.toFixed(2)}</div>
                    <div>Y: {selectedSceneObject.positionY.toFixed(2)}</div>
                    <div>Z: {selectedSceneObject.positionZ.toFixed(2)}</div>
                    <div>{((selectedSceneObject.rotationY * 180) / Math.PI).toFixed(0)}°</div>
                  </div>
                </div>
              )}

              {/* --- Contact Desk ---------------------------------------- */}
              {/* The About room's one interactive prop: a desk a visitor
                  walks up to and presses [E] at to open the museum's own
                  copy of the contact form. Sits outside the About-block /
                  decorative-prop split above deliberately — the desk is
                  placed the free way (drag, turn, Size slider) but is not a
                  decorative prop, so neither branch is its home. Those
                  controls place it; these say what it looks like and what
                  it reads. */}
              {selectedSceneObject.kind === ABOUT_CONTACT_KIND && (
                <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-3">
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Contact Desk
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                      {contactConfig.url
                        ? "Using your uploaded desk. The letter on top is still drawn by code."
                        : "Using the built-in desk. Upload a .glb to replace it."}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => contactModelInputRef.current?.click()}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <Upload size={13} />
                      {uploading ? "Uploading…" : contactConfig.url ? "Replace" : "Upload .glb"}
                    </button>
                    {contactConfig.url && (
                      <button
                        type="button"
                        onClick={() => { snapshot(); updateContactConfig("url", null); }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-500/80 hover:text-red-500 hover:bg-red-500/10 font-jakarta text-xs font-medium transition-colors"
                      >
                        <RotateCcw size={13} /> Use built-in
                      </button>
                    )}
                  </div>

                  {/* Surface image for the built-in desk — hidden once a
                      .glb is in use, which brings its own materials. */}
                  {!contactConfig.url && (
                    <TextureField
                      label="Desk Texture"
                      value={contactConfig.textureUrl}
                      onChange={(url) => { snapshot(); updateContactConfig("textureUrl", url); }}
                    />
                  )}

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Title
                    </label>
                    <input
                      type="text"
                      value={contactConfig.title}
                      onFocus={snapshot}
                      onChange={(e) => updateContactConfig("title", e.target.value)}
                      placeholder="Send an Email"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      The sign above the desk, and the heading on the form it opens.
                    </p>
                  </div>

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={contactConfig.subtitle}
                      onFocus={snapshot}
                      onChange={(e) => updateContactConfig("subtitle", e.target.value)}
                      placeholder="Questions, commissions, collaborations…"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Prompt
                    </label>
                    <input
                      type="text"
                      value={contactConfig.promptLabel}
                      onFocus={snapshot}
                      onChange={(e) => updateContactConfig("promptLabel", e.target.value)}
                      placeholder="Send an Email"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      What the walk-up <strong>[E]</strong> button reads.
                    </p>
                  </div>

                  <input
                    ref={contactModelInputRef}
                    type="file"
                    accept=".glb,model/gltf-binary"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadContactModel(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* --- Digital Wall Clock ---------------------------------- */}
              {/* A working clock, not a picture of one: it reads the real
                  time in the preview and in the room. There's no model to
                  swap — a .glb can't keep time — so everything here is about
                  what it reads and how it looks. Placed by the drag/turn/
                  Size controls above, same as the Contact Desk. */}
              {selectedSceneObject.kind === ABOUT_CLOCK_KIND && (
                <div className="border-t border-black/5 dark:border-white/5 pt-3 space-y-3">
                  <div>
                    <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Wall Clock
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                      Shows the real current time, ticking, for as long as a
                      visitor is in the room.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clockConfig.use24Hour}
                        onChange={(e) => { snapshot(); updateClockConfig("use24Hour", e.target.checked); }}
                        className="accent-sepia"
                      />
                      <span className="font-body text-xs text-ink dark:text-cream font-medium">
                        24-hour time
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clockConfig.showSeconds}
                        onChange={(e) => { snapshot(); updateClockConfig("showSeconds", e.target.checked); }}
                        className="accent-sepia"
                      />
                      <span className="font-body text-xs text-ink dark:text-cream font-medium">
                        Show seconds
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clockConfig.showDate}
                        onChange={(e) => { snapshot(); updateClockConfig("showDate", e.target.checked); }}
                        className="accent-sepia"
                      />
                      <span className="font-body text-xs text-ink dark:text-cream font-medium">
                        Show the date
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Caption
                    </label>
                    <input
                      type="text"
                      value={clockConfig.label}
                      onFocus={snapshot}
                      onChange={(e) => updateClockConfig("label", e.target.value)}
                      placeholder="MANILA"
                      maxLength={MAX_CLOCK_LABEL}
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      Small line above the digits, up to {MAX_CLOCK_LABEL}
                      {" "}characters. Leave blank to hide it.
                    </p>
                  </div>

                  <div>
                    <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-1 block uppercase tracking-widest">
                      Time Zone
                    </label>
                    <input
                      type="text"
                      value={clockConfig.timeZone}
                      onFocus={snapshot}
                      onChange={(e) => updateClockConfig("timeZone", e.target.value)}
                      placeholder="Asia/Manila"
                      spellCheck={false}
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      Leave blank to show each visitor their own time. Set it
                      (e.g. <strong>Asia/Manila</strong>) to show yours instead.
                      An unrecognised zone falls back to the visitor&apos;s.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {([
                      ["digitColor", "Digits"],
                      ["screenColor", "Screen"],
                      ["frameColor", "Case"],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                          {label}
                        </span>
                        <HexColorField
                          value={clockConfig[key]}
                          onChange={(hex) => updateClockConfig(key, hex)}
                          onBeginEdit={snapshot}
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                        Glow
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {clockConfig.glow.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={CLOCK_GLOW_MIN}
                      max={CLOCK_GLOW_MAX}
                      step={0.05}
                      value={clockConfig.glow}
                      onPointerDown={snapshot}
                      onChange={(e) => updateClockConfig("glow", Number(e.target.value))}
                      className="w-full touch-none accent-sepia"
                    />
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                      How hard the digits burn. 0 is a plain unlit readout.
                    </p>
                  </div>
                </div>
              )}

              <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />
              {/* Replace — swap the .glb, keep the placement. Only for
                  uploaded props: every other kind is drawn by code from its
                  own config, so there is no file under it to replace. */}
              {selectedSceneObject.kind === "custom" && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setReplaceModalOpen(true)}
                  title="Upload a different .glb for this object, keeping where it stands"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 font-jakarta text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={14} /> {uploading ? "Replacing…" : "Replace Model"}
                </button>
              )}
              {(selectedSceneObject.kind === "custom" ||
                selectedSceneObject.kind === "text" ||
                isDividerKind(selectedSceneObject.kind) ||
                isSceneBannerKind(selectedSceneObject.kind)) && (
                <button
                  type="button"
                  disabled={duplicating}
                  onClick={() => handleDuplicateSceneObject(selectedSceneObject)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 font-jakarta text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Copy size={14} /> {duplicating ? "Duplicating…" : "Duplicate"}
                </button>
              )}
              {/* Hide from Museum — a fixture's only real "I don't want this
                  in my museum", since Reset Position below deliberately puts
                  it back rather than taking it away. Worded as the state it
                  is in rather than as the action, so it can't be mistaken for
                  the object list's eye icon, which hides things from this
                  preview only and is never saved. */}
              {isHideableKind(selectedSceneObject.kind) && (
                <button
                  type="button"
                  onClick={() => {
                    snapshot();
                    updateSceneObjectLocal(selectedSceneObject.id, {
                      hidden: !selectedSceneObject.hidden,
                    });
                    toggleStaged(sceneObjectLabel(selectedSceneObject), !selectedSceneObject.hidden, {
                      on: "hidden from the museum",
                      off: "visible in the museum",
                    });
                  }}
                  className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-jakarta text-sm font-medium transition-colors ${
                    selectedSceneObject.hidden
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                      : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  }`}
                >
                  {selectedSceneObject.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  {selectedSceneObject.hidden ? "Hidden from museum" : "Visible in museum"}
                </button>
              )}
              {isHideableKind(selectedSceneObject.kind) && selectedSceneObject.hidden && (
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 text-center -mt-1">
                  Visitors won&apos;t see this. Its settings are kept — switch it
                  back on any time. Save to apply.
                </p>
              )}
              {isResetOnlyKind(selectedSceneObject.kind, clockIsProvisioned) ? (
                <button
                  type="button"
                  onClick={() => openDeleteConfirm(selectedSceneObject)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Reset Position
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openDeleteConfirm(selectedSceneObject)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 font-jakarta text-sm font-medium transition-colors"
                >
                  <Trash2 size={14} /> Remove from Room
                </button>
              )}
            </div>
          </>
        )}

        {/* Artworks section — reorder/remove/pagination, synced live with
            the canvas the same way Rooms Tab's own "Manage Artworks"
            ordered list works. */}
        <div className="admin-card border rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              {room.roomType === "SERVICES" ? "Product Frames" : "Artwork Frames"} (
              {artworkItems.length})
            </h4>
            {artworkItems.length > PAGE_SIZE_OPTIONS[0] && (
              <label className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 shrink-0">
                Show
                <select
                  value={artworkPageSize}
                  onChange={(e) => {
                    setArtworkPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number]);
                    setArtworkPage(1);
                  }}
                  className="admin-input rounded-lg px-1.5 py-1 text-xs"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {artworkItems.length === 0 ? (
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">No artworks hung in this room yet.</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {pagedArtworkItems.map((item) => {
                  const absoluteIndex = artworkItems.findIndex((a) => a.id === item.id);
                  const entry = artworks.find((a) => a.id === item.id)!;
                  const hidden = hiddenIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border transition-colors",
                        selection?.type === "artwork" && selection.id === item.id
                          ? "bg-sepia/10 border-sepia/20"
                          : "border-black/5 dark:border-white/5"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelection({ type: "artwork", id: item.id })}
                        className={cn(
                          "flex-1 min-w-0 flex items-center gap-2 text-left px-2.5 py-2 font-body text-xs",
                          selection?.type === "artwork" && selection.id === item.id
                            ? "text-sepia"
                            : "text-ink dark:text-cream"
                        )}
                      >
                        <span className="truncate flex-1">{item.title}</span>
                        {item.hasCustomPosition && (
                          <span className="shrink-0 text-[9px] uppercase tracking-wider text-sepia">Custom</span>
                        )}
                      </button>
                      <div className="flex items-center gap-0.5 pr-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleHidden(item.id)}
                          title={hidden ? "Show in editor" : "Hide in editor"}
                          className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => moveArtwork(item.id, "up")}
                          disabled={absoluteIndex === 0}
                          title="Move up"
                          className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveArtwork(item.id, "down")}
                          disabled={absoluteIndex === artworkItems.length - 1}
                          title="Move down"
                          className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown size={13} />
                        </button>
                        {/* The Services Room's frames mirror the live shop
                            listing (lib/museum/servicesRoom.ts) and are
                            reconciled on the next load, so removing one here
                            would silently come back. Hidden rather than
                            disabled — the real action is hiding or deleting
                            the product, which is a different screen. */}
                        {room.roomType !== "SERVICES" && (
                          <button
                            type="button"
                            onClick={() => removeArtworkFromRoom(entry)}
                            disabled={removingArtworkId === item.id}
                            title="Remove from room"
                            className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalArtworkPages > 1 && (
                <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setArtworkPage((p) => Math.max(1, p - 1))}
                    disabled={artworkPage === 1}
                    className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                    Page {artworkPage} of {totalArtworkPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setArtworkPage((p) => Math.min(totalArtworkPages, p + 1))}
                    disabled={artworkPage === totalArtworkPages}
                    className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky Notes section — same "select from a list, drag/resize in
            the 3D preview" pattern as artwork frames above. Freedom Wall
            only; a room with dozens of notes still fits fine since this
            list scrolls instead of paginating (no reorder concept for
            notes, unlike artworks, so a simpler list is enough). */}
        {room.roomType === "FREEDOM_WALL" && freedomWallNotes.length > 0 && (
          <div className="admin-card border rounded-2xl p-4">
            <h4 className="font-jakarta text-sm font-medium text-ink dark:text-cream mb-3">
              Sticky Notes ({freedomWallNotes.length})
            </h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {freedomWallNotes.map((note) => {
                const active = selection?.type === "note" && selection.id === note.id;
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelection({ type: "note", id: note.id })}
                    className={cn(
                      "w-full text-left flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors",
                      active ? "bg-sepia/10 border-sepia/20" : "border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    <span className={cn("shrink-0 w-2.5 h-2.5 rounded-full", NOTE_COLOR_DOT[note.color] ?? "bg-zinc-300")} />
                    <span className={cn("min-w-0 flex-1 truncate font-body text-xs", active ? "text-sepia" : "text-ink dark:text-cream")}>
                      {note.content}
                    </span>
                    <span className="shrink-0 font-body text-[10px] text-ink-400 dark:text-ink-300">— {note.nickname}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sticky note controls — Wall picker mirrors an artwork frame's own
            exactly (same wallGroups/wallLabel/sameWall); Size mirrors its
            scale slider. Position along the wall is drag-only (3D preview). */}
        {selectedNote && (
          <div className="admin-card border rounded-2xl p-4 space-y-4">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
                Wall
              </p>
              <div className="space-y-1.5">
                {wallGroups.map((group) => (
                  <div key={group[0].id} className="flex gap-1.5">
                    {group.map((wall) => (
                      <button
                        key={`${wall.id}-${wall.segment ?? "full"}`}
                        type="button"
                        onClick={() => setNoteWall(selectedNote.id, wall, selectedNote.positionY)}
                        className={cn(
                          "flex-1 px-3 py-2.5 sm:py-2 rounded-xl font-jakarta text-xs font-medium transition-colors border",
                          selectedNoteWall && sameWall(selectedNoteWall, wall)
                            ? "bg-sepia/10 text-sepia border-sepia/20"
                            : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {wallLabel(wall)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
                Drag the note in the 3D preview to slide it along the {wallLabel(selectedNoteWall ?? walls[0])} wall,
                or up/down to change its height.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Size
                </label>
                <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                  {Math.round(selectedNote.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={NOTE_SCALE_MIN}
                max={NOTE_SCALE_MAX}
                step={0.05}
                value={selectedNote.scale}
                onPointerDown={snapshot}
                onChange={(e) => setNoteScale(selectedNote.id, Number(e.target.value))}
                className="w-full touch-none"
              />
            </div>

            <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />

            <button
              type="button"
              onClick={() => openDeleteNoteConfirm(selectedNote)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 font-jakarta text-sm font-medium transition-colors"
            >
              <Trash2 size={14} /> Move to Trash
            </button>
          </div>
        )}

        {/* Artwork controls */}
        {selectedArtwork && selectedArtworkItem && (
          <div className="admin-card border rounded-2xl p-4 space-y-4">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
                Wall
              </p>
              <div className="space-y-1.5">
                {artworkWallGroups.map((group) => (
                  <div key={group[0].id === "divider" ? `divider-${group[0].dividerId}` : group[0].id} className="flex gap-1.5">
                    {group.map((wall) => (
                      <button
                        key={`${wall.id}-${wall.dividerId ?? ""}-${wall.face ?? wall.segment ?? "full"}`}
                        type="button"
                        onClick={() => setArtworkWall(selectedArtwork.id, wall, selectedArtworkItem.positionY)}
                        className={cn(
                          "flex-1 px-3 py-2.5 sm:py-2 rounded-xl font-jakarta text-xs font-medium transition-colors border",
                          selectedWall && sameWall(selectedWall, wall)
                            ? "bg-sepia/10 text-sepia border-sepia/20"
                            : "text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        {wallLabel(wall, dividerNames)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
                Drag the frame in the 3D preview to slide it along the{" "}
                {wallLabel(selectedWall ?? artworkWalls[0], dividerNames)} wall, or
                drag its green arrow to raise/lower it — height: {selectedArtworkItem.positionY.toFixed(2)}m.
              </p>
              {selectedWall?.id === "divider" && (
                <p className="font-body text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                  Hung on a divider — a frame doesn&apos;t follow the panel, so move and size the
                  divider first, then place the artwork on it.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Size
                </label>
                <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                  {Math.round(selectedArtworkItem.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={0.05}
                value={selectedArtworkItem.scale}
                onPointerDown={snapshot}
                onChange={(e) => setArtworkScale(selectedArtwork.id, Number(e.target.value))}
                className="w-full touch-none"
              />
            </div>

            <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />

            {selectedArtworkItem.hasCustomPosition && (
              <button
                type="button"
                onClick={() => resetArtworkPosition(selectedArtwork.id)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
              >
                <RotateCcw size={14} /> Reset to Auto Layout
              </button>
            )}
          </div>
        )}

        {/* ── Room Banner ─────────────────────────────────────────────
            The one plaque style every label in this room reads (see
            lib/museum/roomBanner.ts): podium plaques, arcade marquees and
            poster captions, price tags, About headings, cosplay foot plaques.
            A room setting rather than a selection, like the Podium Model and
            Cosplay panels above, so it shows whenever a banner room's scene is
            open and never needs an object selected first.

            Only the *look* lives here. What each plaque says comes from the
            thing it labels — a story's title, a product's price, a game's name
            — which is why there is no text field. The About room's headings are
            the exception and keep their own wording, size, face and colour on
            each block. */}
        {roomBannerObject && (
          <div className="admin-card border rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                {ROOM_BANNER_LABEL}
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                {ROOM_BANNER_BLURB[room.roomType as BannerRoomType] ??
                  "How every label in this room is painted."}
              </p>
              {/* The counterpart to the line on a selected Banner's own panel,
                  and shown for the same reason — but only once the room
                  actually holds one, so a room with no banners in it isn't
                  told about a distinction it doesn't have yet. */}
              {sceneObjects.some((o) => isSceneBannerKind(o.kind)) && (
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">
                  Not the {BANNER_LABEL}s you added — select one of those to style it on its own.
                </p>
              )}
            </div>

            {/* ── Panel ──────────────────────────────────────────────── */}
            {(
              [
                ["panelColor", "Panel"],
                ["edgeColor", "Edge"],
                ["textColor", "Text"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  {label}
                </label>
                <HexColorField
                  value={roomBannerStyle[key]}
                  onChange={(hex) => saveRoomBannerStyle({ [key]: hex })}
                  onBeginEdit={snapshot}
                />
              </div>
            ))}
            <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
              The smaller lines under a title (a story&apos;s type, a game&apos;s difficulty, a
              cosplay&apos;s series and credits) are dimmed from the Text colour, so a label keeps
              its hierarchy whatever you pick.
            </p>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Edge Width
                </label>
                <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                  {roomBannerStyle.edgeThickness === 0
                    ? "None"
                    : `${Math.round(roomBannerStyle.edgeThickness * 100)}cm`}
                </span>
              </div>
              <input
                type="range"
                min={MIN_BANNER_EDGE}
                max={MAX_BANNER_EDGE}
                step={0.005}
                value={roomBannerStyle.edgeThickness}
                onPointerDown={snapshot}
                onChange={(e) =>
                  saveRoomBannerStyle({ edgeThickness: Number(e.target.value) })
                }
                {...sliderCommit("Edge width updated")}
                className="w-full touch-none"
              />
              <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                A raised border behind the panel. Zero is no edge at all.
              </p>
            </div>

            {/* ── Type ───────────────────────────────────────────────── */}
            <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Font
                </label>
                <select
                  value={roomBannerStyle.fontFamily}
                  onChange={(e) => {
                    snapshot();
                    saveRoomBannerStyle({ fontFamily: e.target.value });
                  }}
                  className="admin-input border rounded-xl px-2 py-1.5 font-body text-xs text-ink dark:text-cream"
                >
                  {Object.entries(PLAQUE_FONT_OPTIONS).map(([name, path]) => (
                    <option key={path} value={path}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Text Size
                  </label>
                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                    {Math.round(roomBannerStyle.fontScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_BANNER_FONT_SCALE}
                  max={MAX_BANNER_FONT_SCALE}
                  step={0.05}
                  value={roomBannerStyle.fontScale}
                  onPointerDown={snapshot}
                  onChange={(e) => saveRoomBannerStyle({ fontScale: Number(e.target.value) })}
                  {...sliderCommit("Text size updated")}
                  className="w-full touch-none"
                />
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                  Scales every line together, so a plate grows with the type.
                </p>
              </div>
            </div>

            {/* ── Surface ────────────────────────────────────────────── */}
            <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
              <TextureField
                label="Panel Texture"
                value={roomBannerStyle.textureUrl}
                onChange={(url) =>
                  saveRoomBannerStyle(
                    { textureUrl: url },
                    url ? "Panel Texture updated" : "Panel Texture removed"
                  )
                }
              />
              <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                Stretched across each panel — brushed metal, wood, a paper grain. The Panel colour
                above still tints it, so set that to white to show the image as uploaded.
              </p>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Brightness
                  </label>
                  <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                    {Math.round(roomBannerStyle.brightness * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_BANNER_BRIGHTNESS}
                  max={MAX_BANNER_BRIGHTNESS}
                  step={0.05}
                  value={roomBannerStyle.brightness}
                  onPointerDown={snapshot}
                  onChange={(e) => saveRoomBannerStyle({ brightness: Number(e.target.value) })}
                  {...sliderCommit("Brightness updated")}
                  className="w-full touch-none"
                />
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                  Lifts the panel out of a dim corner. The lettering is left alone, so this
                  changes how the label sits in the room rather than washing out its contrast.
                </p>
              </div>
            </div>

            {/* ── Glassmorphism ──────────────────────────────────────── */}
            <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                  Glassmorphism
                </span>
                <input
                  type="checkbox"
                  checked={roomBannerStyle.glassEnabled}
                  onChange={(e) => {
                    snapshot();
                    saveRoomBannerStyle(
                      { glassEnabled: e.target.checked },
                      e.target.checked ? "Glass panel on" : "Glass panel off"
                    );
                  }}
                  className="accent-emerald-500 w-4 h-4"
                />
              </label>
              <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                Frosted translucent panels instead of solid painted ones — the same glass the
                About room&apos;s big plaque wears.
              </p>
              {roomBannerStyle.glassEnabled && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Glass Opacity
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {Math.round(roomBannerStyle.glassOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_BANNER_GLASS_OPACITY}
                      max={MAX_BANNER_GLASS_OPACITY}
                      step={0.01}
                      value={roomBannerStyle.glassOpacity}
                      onPointerDown={snapshot}
                      onChange={(e) =>
                        saveRoomBannerStyle({ glassOpacity: Number(e.target.value) })
                      }
                      {...sliderCommit("Glass opacity updated")}
                      className="w-full touch-none"
                    />
                  </div>

                  <label className="flex items-center justify-between gap-2 cursor-pointer pt-1">
                    <span className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                      Shimmer
                    </span>
                    <input
                      type="checkbox"
                      checked={roomBannerStyle.shimmerEnabled}
                      onChange={(e) => {
                        snapshot();
                        saveRoomBannerStyle(
                          { shimmerEnabled: e.target.checked },
                          e.target.checked ? "Shimmer on" : "Shimmer off"
                        );
                      }}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>
                  <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                    A band of light travelling across the glass. Every plaque in the room sweeps
                    in step, so a room of twelve reads as one lit surface rather than twelve.
                  </p>
                  {roomBannerStyle.shimmerEnabled && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                            Shimmer Speed
                          </label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {roomBannerStyle.shimmerSpeed.toFixed(2)}/s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={MIN_BANNER_SHIMMER_SPEED}
                          max={MAX_BANNER_SHIMMER_SPEED}
                          step={0.05}
                          value={roomBannerStyle.shimmerSpeed}
                          onPointerDown={snapshot}
                          onChange={(e) =>
                            saveRoomBannerStyle({ shimmerSpeed: Number(e.target.value) })
                          }
                          {...sliderCommit("Shimmer speed updated")}
                          className="w-full touch-none"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                            Shimmer Strength
                          </label>
                          <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                            {Math.round(roomBannerStyle.shimmerStrength * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={MIN_BANNER_SHIMMER_STRENGTH}
                          max={MAX_BANNER_SHIMMER_STRENGTH}
                          step={0.05}
                          value={roomBannerStyle.shimmerStrength}
                          onPointerDown={snapshot}
                          onChange={(e) =>
                            saveRoomBannerStyle({ shimmerStrength: Number(e.target.value) })
                          }
                          {...sliderCommit("Shimmer strength updated")}
                          className="w-full touch-none"
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Pedestal model — a room setting, not a selection, so it shows
            whenever the Stories Room's scene is open. The book and its cover
            are always drawn by code on top of whatever pedestal is in use,
            since those are per-story. */}
        {room.roomType === "STORIES" && podiumModelObject && (
          <div className="admin-card border rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                Podium Model
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                {podiumModelConfig.url
                  ? "Using your uploaded pedestal. The book and its cover are still drawn on top."
                  : "Using the built-in pedestal. Upload a .glb to replace it."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => podiumModelInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : podiumModelConfig.url ? "Replace" : "Upload .glb"}
              </button>
              {podiumModelConfig.url && (
                <button
                  type="button"
                  onClick={() =>
                    savePodiumModelConfig({ url: null }, "Using the built-in podium")
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-500/80 hover:text-red-500 hover:bg-red-500/10 font-jakarta text-xs font-medium transition-colors"
                >
                  <RotateCcw size={13} /> Use built-in
                </button>
              )}
            </div>

            {/* Surface image for the built-in pedestal — the same control and
                the same upload path a room's wall/floor/ceiling texture uses,
                tiled in the same world units so a podium finished in the
                floor's material reads as one surface. Hidden once a .glb is
                in use: that model brings its own materials. */}
            {!podiumModelConfig.url && (
              <TextureField
                label="Podium Texture"
                value={podiumModelConfig.textureUrl}
                onChange={(url) =>
                  savePodiumModelConfig(
                    { textureUrl: url },
                    url ? "Podium Texture updated" : "Podium Texture removed"
                  )
                }
              />
            )}

            {podiumModelConfig.url && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Book Height
                  </label>
                  <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                    {podiumModelConfig.bookHeight.toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={2}
                  step={0.05}
                  value={podiumModelConfig.bookHeight}
                  onChange={(e) => savePodiumModelConfig({ bookHeight: Number(e.target.value) })}
                  className="w-full touch-none"
                />
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                  How high the book sits — set this to your model&apos;s top surface.
                  The built-in pedestal is {DEFAULT_PODIUM_BOOK_HEIGHT}m.
                </p>
              </div>
            )}

            <input
              ref={podiumModelInputRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadPodiumModel(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {selectedPodiumItem && (
          <>
            {/* The same Move/Rotate switch scene objects get. A podium only
                ever turns about Y — see EditablePodium, which locks the other
                two rings so a book stand can't be tipped over. */}
            <ModeToolbar mode={mode} onModeChange={setMode} />
          <div className="admin-card border rounded-2xl p-4 space-y-4">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1">
                Podium
              </p>
              <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                {selectedPodiumItem.title}
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
                Drag it anywhere on the floor, or use the{" "}
                <strong>{mode === "rotate" ? "Rotate" : "Move"}</strong> gizmo above to{" "}
                {mode === "rotate" ? "turn it toward the aisle" : "slide and raise it"}. Position:{" "}
                {selectedPodiumItem.positionX.toFixed(2)}, {selectedPodiumItem.positionZ.toFixed(2)}
                {selectedPodiumItem.positionY !== 0 && ` · raised ${selectedPodiumItem.positionY.toFixed(2)}m`}
                {` · facing ${Math.round(
                  ((selectedPodiumItem.rotationY * 180) / Math.PI + 360) % 360
                )}°`}
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                Which stories stand here is mirrored from the published library —
                publish or unpublish in the Stories module to add or remove a podium.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Size
                </label>
                <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                  {Math.round(selectedPodiumItem.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={SCALE_MIN}
                max={SCALE_MAX}
                step={0.05}
                value={selectedPodiumItem.scale}
                onPointerDown={snapshot}
                onChange={(e) => setPodiumScale(selectedPodiumItem.id, Number(e.target.value))}
                className="w-full touch-none"
              />
            </div>

            <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />

            {selectedPodiumItem.hasCustomPosition && (
              <button
                type="button"
                onClick={() => resetPodiumPosition(selectedPodiumItem.id)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
              >
                <RotateCcw size={14} /> Reset to Auto Layout
              </button>
            )}
          </div>
          </>
        )}

        {/* Cosplay Room — the room-wide standee body and the backdrop panel
            every cosplay's second photo hangs on. A room setting, not a
            selection, so it shows whenever the Cosplay scene is open (same as
            the Stories pedestal card above). The two photos are always drawn by
            code on top of whatever body is in use, since those are per-cosplay. */}
        {room.roomType === "COSPLAY" && standeeConfigObject && (
          <div className="admin-card border rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                Standee Model
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                {standeeConfig.url
                  ? "Using your uploaded standee. Each cosplay's photo is still printed on top."
                  : "Using the built-in standee. Upload a .glb to replace it."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => standeeModelInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : standeeConfig.url ? "Replace" : "Upload .glb"}
              </button>
              {standeeConfig.url && (
                <button
                  type="button"
                  onClick={() => saveStandeeConfig({ url: null }, "Using the built-in standee")}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-500/80 hover:text-red-500 hover:bg-red-500/10 font-jakarta text-xs font-medium transition-colors"
                >
                  <RotateCcw size={13} /> Use built-in
                </button>
              )}
            </div>

            {/* Surface image for the built-in standee's base — same control and
                upload path a room's wall/floor/ceiling texture uses. Hidden once
                a .glb is in use: that model brings its own materials. */}
            {!standeeConfig.url && (
              <TextureField
                label="Standee Base Texture"
                value={standeeConfig.textureUrl}
                onChange={(url) =>
                  saveStandeeConfig(
                    { textureUrl: url },
                    url ? "Standee Base Texture updated" : "Standee Base Texture removed"
                  )
                }
              />
            )}

            {standeeConfig.url && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Print Height
                  </label>
                  <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                    {standeeConfig.cutoutHeight.toFixed(2)}m
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_CUTOUT_HEIGHT}
                  max={MAX_CUTOUT_HEIGHT}
                  step={0.05}
                  value={standeeConfig.cutoutHeight}
                  onChange={(e) => saveStandeeConfig({ cutoutHeight: Number(e.target.value) })}
                  {...sliderCommit("Standee height updated")}
                  className="w-full touch-none"
                />
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                  Where the printed photo sits — set this to your model&apos;s top
                  surface. The built-in standee prints at {DEFAULT_STANDEE_CUTOUT_HEIGHT}m.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Backdrop Panel
                  </p>
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                    The photo hung behind each standee. Off leaves the standees
                    standing against bare walls.
                  </p>
                </div>
                <Toggle
                  checked={standeeConfig.backdropEnabled}
                  onChange={(backdropEnabled) =>
                    saveStandeeConfig(
                      { backdropEnabled },
                      backdropEnabled ? "Backdrop panels on" : "Backdrop panels off"
                    )
                  }
                  label="Toggle backdrop panels"
                />
              </div>

              {standeeConfig.backdropEnabled && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Panel Width
                      </label>
                      <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                        {standeeConfig.backdropWidth.toFixed(2)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_BACKDROP_SIZE}
                      max={MAX_BACKDROP_SIZE}
                      step={0.1}
                      value={standeeConfig.backdropWidth}
                      onChange={(e) => saveStandeeConfig({ backdropWidth: Number(e.target.value) })}
                      {...sliderCommit("Backdrop width updated")}
                      className="w-full touch-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Panel Height
                      </label>
                      <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                        {standeeConfig.backdropHeight.toFixed(2)}m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_BACKDROP_SIZE}
                      max={MAX_BACKDROP_SIZE}
                      step={0.1}
                      value={standeeConfig.backdropHeight}
                      onChange={(e) => saveStandeeConfig({ backdropHeight: Number(e.target.value) })}
                      {...sliderCommit("Backdrop height updated")}
                      className="w-full touch-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Panel Frame
                    </label>
                    <HexColorField
                      value={standeeConfig.backdropFrameColor}
                      onChange={(hex) => saveStandeeConfig({ backdropFrameColor: hex })}
                      onBeginEdit={snapshot}
                    />
                  </div>

                  {/* Outer edge — the same raised border the Banner plaque
                      has. One flat frame colour disappears against a wall
                      painted anything near it; a contrasting border is what
                      makes the backdrop read as a framed object rather than a
                      rectangle of photo.

                      No on/off switch: an edge is part of what a frame *is*,
                      and "frame with no edge" is just the old flat panel under
                      a second name. Setting it to the frame's own colour is
                      the honest way to not have one. (It shipped behind a
                      toggle that never worked — the serializer dropped the
                      field on every save, so the switch moved and nothing
                      persisted.) */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Panel Edge
                    </label>
                    <HexColorField
                      value={standeeConfig.backdropEdgeColor}
                      onChange={(hex) => saveStandeeConfig({ backdropEdgeColor: hex })}
                      onBeginEdit={snapshot}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Edge Width
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {standeeConfig.backdropEdgeThickness.toFixed(2)} m
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_BACKDROP_EDGE}
                      max={MAX_BACKDROP_EDGE}
                      step={0.01}
                      value={standeeConfig.backdropEdgeThickness}
                      onPointerDown={snapshot}
                      onChange={(e) =>
                        saveStandeeConfig({ backdropEdgeThickness: Number(e.target.value) })
                      }
                      {...sliderCommit("Backdrop edge updated")}
                      className="w-full touch-none"
                    />
                  </div>
                </>
              )}

              {/* The standee's foot plaque used to be styled here, through five
                  plaque* keys of its own. It now reads the room-wide Room
                  Banner style every other room's labels do (see
                  lib/museum/roomBanner.ts) — its panel above the object list,
                  where a Stories or Services admin finds the same controls.
                  Whatever was set here has been carried over to that row (see
                  roomBannerProvision.ts's seedStyleFor), so nothing standing in
                  the room changed. */}

              {/* ── Billboard lights ────────────────────────────────────
                  Unlike everything above, whether a given standee is lit
                  isn't set here — that's a per-standee switch (select the
                  standee below, or use the bulk buttons here). This section
                  is just how a lit standee's bulbs look, shared by every one
                  that has the switch on, so a room with several lit reads as
                  one design rather than several accidental ones. */}
              <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 space-y-2">
                <p className="font-jakarta text-xs font-medium text-ink dark:text-cream">
                  Billboard Lights
                </p>
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                  Lights for a standee you want a visit to be about. Select a
                  standee below to switch it on individually, or light them all
                  at once here.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllStandeeLights(true)}
                    className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    Light Every Standee
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllStandeeLights(false)}
                    className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    Turn All Off
                  </button>
                </div>
                {/* Style first: it decides which of the two sets of controls
                    below is even meaningful, so an admin picks the fixture
                    before tuning it. */}
                <div className="flex items-center justify-between gap-2">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Style
                  </label>
                  <AdminSelect
                    wrapperClassName="w-40 shrink-0"
                    className="py-1.5 font-body text-xs"
                    value={standeeConfig.lightsStyle}
                    onChange={(e) => {
                      snapshot();
                      saveStandeeConfig({
                        lightsStyle: e.target.value as CosplayStandeeConfig["lightsStyle"],
                      });
                    }}
                  >
                    {LIGHTS_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {LIGHTS_STYLE_LABELS[style]}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                  {standeeConfig.lightsStyle === "floodlight"
                    ? "Lamps on the floor at each standee's feet, throwing a cone of light up the front of the print."
                    : "Bulbs ringing a lit standee's backdrop — or the print itself, if this room hangs no panel."}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    {standeeConfig.lightsStyle === "floodlight" ? "Light Color" : "Bulb Color"}
                  </label>
                  <HexColorField
                    value={standeeConfig.lightsColor}
                    onChange={(hex) => saveStandeeConfig({ lightsColor: hex })}
                    onBeginEdit={snapshot}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Pattern
                  </label>
                  <AdminSelect
                    wrapperClassName="w-40 shrink-0"
                    className="py-1.5 font-body text-xs capitalize"
                    value={standeeConfig.lightsAnimation}
                    onChange={(e) => {
                      snapshot();
                      saveStandeeConfig({
                        lightsAnimation: e.target.value as CosplayStandeeConfig["lightsAnimation"],
                      });
                    }}
                  >
                    {LIGHTS_ANIMATIONS.map((mode) => (
                      <option key={mode} value={mode} className="capitalize">
                        {mode}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Brightness
                    </label>
                    <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                      {Math.round(standeeConfig.lightsIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_LIGHTS_INTENSITY}
                    max={MAX_LIGHTS_INTENSITY}
                    step={0.05}
                    value={standeeConfig.lightsIntensity}
                    onPointerDown={snapshot}
                    onChange={(e) => saveStandeeConfig({ lightsIntensity: Number(e.target.value) })}
                    {...sliderCommit("Light brightness updated")}
                    className="w-full touch-none"
                  />
                </div>
                {/* Bulb size/spacing describe a ring of beads and lamps/beam
                    describe a rig — showing both at once would offer four
                    sliders of which two do nothing, which is how an admin
                    concludes a setting is broken. */}
                {standeeConfig.lightsStyle === "marquee" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Bulb Size
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {(standeeConfig.lightsBulbSize * 100).toFixed(1)} cm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_BULB_SIZE}
                        max={MAX_BULB_SIZE}
                        step={0.005}
                        value={standeeConfig.lightsBulbSize}
                        onPointerDown={snapshot}
                        onChange={(e) => saveStandeeConfig({ lightsBulbSize: Number(e.target.value) })}
                        {...sliderCommit("Bulb size updated")}
                        className="w-full touch-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Bulb Spacing
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {standeeConfig.lightsSpacing.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_BULB_SPACING}
                        max={MAX_BULB_SPACING}
                        step={0.01}
                        value={standeeConfig.lightsSpacing}
                        onPointerDown={snapshot}
                        onChange={(e) => saveStandeeConfig({ lightsSpacing: Number(e.target.value) })}
                        {...sliderCommit("Bulb spacing updated")}
                        className="w-full touch-none"
                      />
                    </div>
                  </>
                )}

                {standeeConfig.lightsStyle === "floodlight" && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Lamps
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {standeeConfig.floodCount}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_FLOOD_COUNT}
                        max={MAX_FLOOD_COUNT}
                        step={1}
                        value={standeeConfig.floodCount}
                        onPointerDown={snapshot}
                        onChange={(e) => saveStandeeConfig({ floodCount: Number(e.target.value) })}
                        {...sliderCommit("Floodlight count updated")}
                        className="w-full touch-none"
                      />
                      <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                        Spread evenly across the front of each standee.
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Beam Reach
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {standeeConfig.floodBeamHeight.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_FLOOD_BEAM_HEIGHT}
                        max={MAX_FLOOD_BEAM_HEIGHT}
                        step={0.05}
                        value={standeeConfig.floodBeamHeight}
                        onPointerDown={snapshot}
                        onChange={(e) =>
                          saveStandeeConfig({ floodBeamHeight: Number(e.target.value) })
                        }
                        {...sliderCommit("Beam height updated")}
                        className="w-full touch-none"
                      />
                      <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                        How far up the print the light throws — the lamps aim
                        themselves from this, so they always point at the standee.
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                          Beam Spread
                        </label>
                        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                          {standeeConfig.floodBeamSpread.toFixed(2)} m
                        </span>
                      </div>
                      <input
                        type="range"
                        min={MIN_FLOOD_BEAM_SPREAD}
                        max={MAX_FLOOD_BEAM_SPREAD}
                        step={0.01}
                        value={standeeConfig.floodBeamSpread}
                        onPointerDown={snapshot}
                        onChange={(e) =>
                          saveStandeeConfig({ floodBeamSpread: Number(e.target.value) })
                        }
                        {...sliderCommit("Beam spread updated")}
                        className="w-full touch-none"
                      />
                      <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                        How wide the cone opens where it lands — a tight spot up
                        the middle, or a wash across the whole board.
                      </p>
                    </div>
                  </>
                )}
                {standeeConfig.lightsAnimation !== "static" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        Speed
                      </label>
                      <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
                        {standeeConfig.lightsSpeed.toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min={MIN_LIGHTS_SPEED}
                      max={MAX_LIGHTS_SPEED}
                      step={0.05}
                      value={standeeConfig.lightsSpeed}
                      onPointerDown={snapshot}
                      onChange={(e) => saveStandeeConfig({ lightsSpeed: Number(e.target.value) })}
                      {...sliderCommit("Light speed updated")}
                      className="w-full touch-none"
                    />
                  </div>
                )}
              </div>
            </div>

            <input
              ref={standeeModelInputRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadStandeeModel(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {selectedStandeeItem && (
          <>
            {/* The same Move/Rotate switch podiums get — a standee only ever
                turns about Y (see EditableStandee), since tipping one would
                float its backdrop off the wall. */}
            <ModeToolbar mode={mode} onModeChange={setMode} />
            <div className="admin-card border rounded-2xl p-4 space-y-4">
              <div>
                <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1">
                  Standee
                </p>
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                  {selectedStandeeItem.character || selectedStandeeItem.title}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
                  Drag it anywhere on the floor, or use the{" "}
                  <strong>{mode === "rotate" ? "Rotate" : "Move"}</strong> gizmo above to{" "}
                  {mode === "rotate" ? "turn it into the room" : "slide and raise it"}. The photo
                  behind it moves with it. Position:{" "}
                  {selectedStandeeItem.positionX.toFixed(2)}, {selectedStandeeItem.positionZ.toFixed(2)}
                  {selectedStandeeItem.positionY !== 0 && ` · raised ${selectedStandeeItem.positionY.toFixed(2)}m`}
                  {` · facing ${Math.round(
                    ((selectedStandeeItem.rotationY * 180) / Math.PI + 360) % 360
                  )}°`}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                  Which cosplays stand here is mirrored from the published list —
                  publish or unpublish in the Cosplays module to add or remove a standee.
                </p>
                {!selectedStandeeItem.backdropImageUrl && standeeConfig.backdropEnabled && (
                  <p className="flex items-start gap-1.5 font-body text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      This cosplay has no second photo, so nothing hangs behind it. Add a
                      Backdrop Photo in the Cosplays module.
                    </span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Size
                  </label>
                  <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                    {Math.round(selectedStandeeItem.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.05}
                  value={selectedStandeeItem.scale}
                  onPointerDown={snapshot}
                  onChange={(e) => setStandeeScale(selectedStandeeItem.id, Number(e.target.value))}
                  className="w-full touch-none"
                />
              </div>

              {/* Optional per-standee switch — see the Billboard Lights
                  section above for how the bulbs look. This is the one
                  cosplay-room setting that lives on the standee itself rather
                  than the room, because *which* standees are lit is the whole
                  point of the feature. */}
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Billboard Lights
                </span>
                <input
                  type="checkbox"
                  checked={selectedStandeeItem.lightsEnabled}
                  onChange={(e) => {
                    snapshot();
                    setStandeeLights(selectedStandeeItem.id, e.target.checked);
                  }}
                  className="h-4 w-4"
                />
              </label>

              <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />

              {selectedStandeeItem.hasCustomPosition && (
                <button
                  type="button"
                  onClick={() => resetStandeePosition(selectedStandeeItem.id)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Reset to Auto Layout
                </button>
              )}
            </div>
          </>
        )}

        {/* Arcade Room — the room-wide Cabinets / Posters default. A room
            setting, not a selection, so it shows whenever the Arcade scene
            is open (same as the Stories pedestal card above). */}
        {room.roomType === "ARCADE" && arcadeConfigObject && (
          <div className="admin-card border rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                Default Display
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                How a game shows when it has no override of its own. Select a
                cabinet in the preview to switch just that one.
              </p>
            </div>
            <div className="flex gap-2">
              {(["CABINET", "POSTER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() =>
                    saveArcadeConfig(
                      { defaultMode: m },
                      m === "POSTER" ? "Default: wall posters" : "Default: arcade cabinets"
                    )
                  }
                  className={cn(
                    "flex-1 px-3 py-2 rounded-xl font-jakarta text-xs font-medium transition-colors",
                    arcadeDefaultMode === m
                      ? "bg-sepia text-white"
                      : "bg-black/5 dark:bg-white/5 text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                  )}
                >
                  {m === "CABINET" ? "Arcade Cabinets" : "Wall Posters"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cabinet model — the Arcade counterpart to the Stories pedestal card
            above, and the same room-wide setting rather than a selection. The
            screen image and the marquee name are always drawn by code on top
            of whatever cabinet is in use, since those are per-game. */}
        {room.roomType === "ARCADE" && arcadeConfigObject && (
          <div className="admin-card border rounded-2xl p-4 space-y-3">
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                Cabinet Model
              </p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                {arcadeConfig.cabinetModelUrl
                  ? "Using your uploaded cabinet. The screen and marquee are still drawn on top."
                  : "Using the built-in cabinet. Upload a .glb to replace it."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => cabinetModelInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <Upload size={13} />
                {uploading ? "Uploading…" : arcadeConfig.cabinetModelUrl ? "Replace" : "Upload .glb"}
              </button>
              {arcadeConfig.cabinetModelUrl && (
                <button
                  type="button"
                  onClick={() =>
                    saveArcadeConfig(
                      { cabinetModelUrl: null },
                      "Using the built-in cabinet"
                    )
                  }
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-500/80 hover:text-red-500 hover:bg-red-500/10 font-jakarta text-xs font-medium transition-colors"
                >
                  <RotateCcw size={13} /> Use built-in
                </button>
              )}
            </div>

            {/* Surface image for the built-in cabinet — the same control and
                upload path a room's wall/floor/ceiling texture uses, tiled in
                the same world units. Hidden once a .glb is in use: that model
                brings its own materials. */}
            {!arcadeConfig.cabinetModelUrl && (
              <TextureField
                label="Cabinet Texture"
                value={arcadeConfig.cabinetTextureUrl}
                onChange={(url) =>
                  saveArcadeConfig(
                    { cabinetTextureUrl: url },
                    url ? "Cabinet Texture updated" : "Cabinet Texture removed"
                  )
                }
              />
            )}

            {arcadeConfig.cabinetModelUrl && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Screen Height
                    </label>
                    <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                      {arcadeConfig.screenHeight.toFixed(2)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.02}
                    value={arcadeConfig.screenHeight}
                    onChange={(e) =>
                      saveArcadeConfig(
                        { screenHeight: Number(e.target.value) },
                        "Screen height updated"
                      )
                    }
                    className="w-full touch-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                      Screen Depth
                    </label>
                    <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                      {arcadeConfig.screenDepth.toFixed(2)}m
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.01}
                    value={arcadeConfig.screenDepth}
                    onChange={(e) =>
                      saveArcadeConfig(
                        { screenDepth: Number(e.target.value) },
                        "Screen depth updated"
                      )
                    }
                    className="w-full touch-none"
                  />
                </div>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                  Where the screen and marquee sit on your model — height off the
                  floor, then how far forward. The built-in cabinet is{" "}
                  {DEFAULT_CABINET_SCREEN_HEIGHT}m and {DEFAULT_CABINET_SCREEN_DEPTH}m.
                  Model it facing forward with its origin on the floor.
                </p>
              </>
            )}

            <input
              ref={cabinetModelInputRef}
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadCabinetModel(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {selectedCabinetItem && selectedCabinetEntry && (
          <>
            <ModeToolbar mode={mode} onModeChange={setMode} />
            <div className="admin-card border rounded-2xl p-4 space-y-4">
              <div>
                <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1">
                  {selectedCabinetItem.mode === "POSTER" ? "Poster" : "Cabinet"}
                </p>
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                  {selectedCabinetItem.title}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
                  Drag it anywhere on the floor, or use the{" "}
                  <strong>{mode === "rotate" ? "Rotate" : "Move"}</strong> gizmo above. Position:{" "}
                  {selectedCabinetItem.positionX.toFixed(2)}, {selectedCabinetItem.positionZ.toFixed(2)}
                  {selectedCabinetItem.positionY !== 0 && ` · raised ${selectedCabinetItem.positionY.toFixed(2)}m`}
                  {` · facing ${Math.round(((selectedCabinetItem.rotationY * 180) / Math.PI + 360) % 360)}°`}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                  Which games appear here is mirrored from the Minigames module —
                  turn a game on or off there to add or remove a cabinet.
                </p>
              </div>

              <div>
                <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Display
                </label>
                <div className="flex gap-2">
                  {([
                    { v: null, label: "Room default" },
                    { v: "CABINET" as const, label: "Cabinet" },
                    { v: "POSTER" as const, label: "Poster" },
                  ]).map((opt) => {
                    const active = (selectedCabinetEntry.displayMode ?? null) === opt.v;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setCabinetMode(selectedCabinetItem.id, opt.v)}
                        className={cn(
                          "flex-1 px-2 py-1.5 rounded-lg font-jakarta text-[11px] font-medium transition-colors",
                          active
                            ? "bg-sepia text-white"
                            : "bg-black/5 dark:bg-white/5 text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Size
                  </label>
                  <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 tabular-nums">
                    {Math.round(selectedCabinetItem.scale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.05}
                  value={selectedCabinetItem.scale}
                  onPointerDown={snapshot}
                  onChange={(e) => setCabinetScale(selectedCabinetItem.id, Number(e.target.value))}
                  className="w-full touch-none"
                />
              </div>

              <SaveButton dirty={dirty} saving={saving} onSave={handleSave} />

              {selectedCabinetItem.hasCustomPosition && (
                <button
                  type="button"
                  onClick={() => resetCabinetPosition(selectedCabinetItem.id)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
                >
                  <RotateCcw size={14} /> Reset to Auto Layout
                </button>
              )}
            </div>
          </>
        )}

        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 px-1">
          Drag in the 3D preview to reposition. Nothing saves until you click Save. Ctrl/Cmd+Z to undo.
        </p>
      </div>

      {/* Remove object confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream text-center">
              {isResetOnlyKind(deleteConfirm.kind, clockIsProvisioned)
                ? `Reset ${KIND_LABEL[deleteConfirm.kind]} to its default position?`
                : deleteConfirm.label?.trim()
                  ? `Remove “${deleteConfirm.label.trim()}”?`
                  : `Remove this ${KIND_LABEL[deleteConfirm.kind]?.toLowerCase() ?? "object"}?`}
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-6 text-center">
              {deleteConfirm.kind === FREEDOM_WALL_BANNER_KIND
                ? "It'll go back to its default position, size, and colour, and show the active event's name again."
                : isAboutBlockKind(deleteConfirm.kind)
                ? "It'll snap back to where it was originally designed to sit."
                : 'It won\'t show in the museum — a quick "Restore" stays available in this editor for the rest of your session.'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => handleDeleteSceneObject(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "…" : isResetOnlyKind(deleteConfirm.kind, clockIsProvisioned) ? "Reset" : "Remove"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky note delete confirm modal — same soft-delete-to-Trash copy
          and preview-card pattern as FreedomWallTab.tsx's own per-note
          delete, so the two read as one consistent flow regardless of which
          admin screen it's triggered from. */}
      {deleteNoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream text-center">
              Move note to Trash?
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-4 text-center">
              It comes off the public wall right away. You can view, restore, or permanently delete it
              later under <strong>Trash → Freedom Wall</strong>.
            </p>
            <div className="rounded-xl p-3 text-xs bg-black/5 dark:bg-white/5 text-left flex items-start gap-2 mb-6">
              <span className={cn("mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full", NOTE_COLOR_DOT[deleteNoteTarget.color] ?? "bg-zinc-300")} />
              <div className="min-w-0">
                <p className="font-semibold text-ink dark:text-cream truncate">{deleteNoteTarget.nickname}</p>
                <p className="text-ink-400 dark:text-ink-300 mt-0.5 break-words whitespace-pre-wrap line-clamp-4">
                  {deleteNoteTarget.content}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => deleteNote(deleteNoteTarget)}
                disabled={deletingNote}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletingNote ? "…" : "Move to Trash"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteNoteTarget(null)}
                disabled={deletingNote}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved-changes navigation guard */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream text-center">
              You have unsaved changes
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-6 text-center">
              If you leave now, your edits will be lost. Save first or discard?
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  await handleSave();
                  setLeaveConfirmOpen(false);
                  if (pendingNavRef.current) router.push(pendingNavRef.current);
                }}
                className="px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors"
              >
                Save &amp; Leave
              </button>
              <button
                type="button"
                onClick={() => {
                  setLeaveConfirmOpen(false);
                  if (pendingNavRef.current) router.push(pendingNavRef.current);
                }}
                className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors"
              >
                Discard &amp; Leave
              </button>
              <button
                type="button"
                onClick={() => setLeaveConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload decorative object modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-jakarta text-lg font-semibold text-ink dark:text-cream">Add Decorative Object</p>
              <button
                type="button"
                onClick={() => { setUploadModalOpen(false); setNewObjectName(""); }}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-4">
              Upload a self-contained <strong>.glb</strong> 3D model (max 100MB) — a carpet, plant, light
              fixture, or anything else. It&apos;s added at the room&apos;s center; drag it into place afterward.
            </p>
            <label className="block mb-4">
              <span className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1 block">
                Name <span className="normal-case tracking-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={newObjectName}
                maxLength={MAX_SCENE_LABEL}
                onChange={(e) => setNewObjectName(e.target.value)}
                placeholder="e.g. Lobby Ficus, Red Carpet"
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
              <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1 block">
                Shows in the object list instead of &ldquo;Decorative Object&rdquo;. You can rename it later.
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadModel(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:border-black/30 dark:hover:border-white/30 transition-colors disabled:opacity-50"
            >
              <Upload size={22} />
              <span className="font-body text-sm">{uploading ? "Uploading…" : "Choose a .glb file"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Replace Model — the same signed upload as Add Decorative Object, but
          writing over an existing row's modelUrl instead of creating one. No
          Name field: this is the same object, so renaming it here would be a
          second, unrelated edit hidden inside a file picker. */}
      {replaceModalOpen && selectedSceneObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="admin-modal border w-full max-w-md p-6 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <p className="font-jakarta text-lg font-semibold text-ink dark:text-cream">Replace Model</p>
              <button
                type="button"
                onClick={() => setReplaceModalOpen(false)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-4">
              Swap the 3D model under <strong>{sceneObjectLabel(selectedSceneObject)}</strong> for a
              different <strong>.glb</strong> (max 100MB). Where it stands, how it&apos;s turned, its
              size, its name and its collision settings all stay exactly as they are.
            </p>
            <p className="font-body text-[11px] text-amber-600 dark:text-amber-400 mb-4">
              This one saves straight away — the new file is live in the museum as soon as it
              finishes uploading.
            </p>
            <input
              ref={replaceInputRef}
              type="file"
              accept=".glb"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleReplaceModel(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:border-black/30 dark:hover:border-white/30 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={22} />
              <span className="font-body text-sm">{uploading ? "Replacing…" : "Choose a .glb file"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SaveButton({ dirty, saving, onSave }: { dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
      >
        <Save size={14} />
        {saving ? "Saving…" : "Save"}
      </button>
      {dirty && !saving && (
        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 text-center">Unsaved changes</p>
      )}
    </div>
  );
}

function SceneObjectSection({
  title,
  objects,
  selection,
  hiddenIds,
  onSelect,
  onToggleHidden,
}: {
  title: string;
  objects: SceneObject[];
  selection: Selection;
  hiddenIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleHidden: (id: string) => void;
}) {
  // Foldable, because these lists are the bulk of the panel's height and an
  // admin working on one thing rarely needs the other two open. The count
  // stays on the header so a folded section still says what's in it.
  // Open by default — nothing is hidden until the admin decides to hide it.
  const [open, setOpen] = useState(true);
  return (
    <div className="admin-card border rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left group"
      >
        <h4 className="font-jakarta text-sm font-medium text-ink dark:text-cream">
          {title}{" "}
          <span className="text-ink-400 dark:text-ink-300 font-normal">({objects.length})</span>
        </h4>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 text-ink-400 dark:text-ink-300 transition-transform group-hover:text-ink dark:group-hover:text-cream",
            open ? "rotate-0" : "-rotate-90"
          )}
        />
      </button>
      {!open ? null : objects.length === 0 ? (
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-3">Nothing placed yet.</p>
      ) : (
        <div className="space-y-1.5 mt-3">
          {objects.map((o) => {
            const hidden = hiddenIds.has(o.id);
            const active = selection?.type === "scene" && selection.id === o.id;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl border transition-colors",
                  active ? "bg-sepia/10 border-sepia/20" : "border-black/5 dark:border-white/5"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(o.id)}
                  className={cn(
                    "flex-1 flex items-center gap-2 text-left px-3 py-2 font-body text-sm",
                    active ? "text-sepia" : "text-ink dark:text-cream"
                  )}
                >
                  <span className="truncate flex-1">{sceneObjectLabel(o)}</span>
                  {/* Deliberately *not* the eye icon to the right, which is
                      this editor's own show/hide for the preview. This badge
                      is the saved one: visitors don't see this object. Two
                      similar-sounding states in one row, so they're given
                      different shapes — a worded badge against an icon. */}
                  {o.hidden && (
                    <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Not in museum
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleHidden(o.id)}
                  title={hidden ? "Show in editor" : "Hide in editor"}
                  className="p-1.5 mr-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Move / Rotate switch for whichever object is selected. Extracted so the
// podium panel gets exactly the control scene objects already had rather
// than a second copy that could drift from it.
function ModeToolbar({
  mode,
  onModeChange,
  allowRotate = true,
}: {
  mode: SceneMode;
  onModeChange: (mode: SceneMode) => void;
  /** False for the About room's blocks, which are position-only. */
  allowRotate?: boolean;
}) {
  return (
    <div className="admin-card border rounded-2xl p-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onModeChange("translate")}
        className={cn(
          "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-jakarta text-xs font-medium transition-colors",
          mode === "translate" ? "bg-sepia/10 text-sepia" : "text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5"
        )}
      >
        <Move size={14} /> Move
      </button>
      {allowRotate && (
        <button
          type="button"
          onClick={() => onModeChange("rotate")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl font-jakarta text-xs font-medium transition-colors",
            mode === "rotate" ? "bg-sepia/10 text-sepia" : "text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5"
          )}
        >
          <RotateCw size={14} /> Rotate
        </button>
      )}
    </div>
  );
}
