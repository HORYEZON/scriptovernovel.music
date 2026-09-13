"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import { BannerPanel } from "./BannerPanel";
import {
  defaultRoomBannerStyle,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import { useWallFocus, WALL_FOCUS_EPSILON } from "@/lib/museum/useWallFocus";
import type { MuseumAboutData, MuseumAboutSkill, MuseumAboutCertificate, MuseumAboutGig } from "@/types";
import { useStitchedMapTexture } from "@/lib/museum/stitchedMap";
import { FRAME_CENTER_Y } from "./framePlacement";
import { ContactDesk } from "./ContactDesk";
import { WallClock } from "./WallClock";
import {
  ABOUT_PHOTO_KIND,
  ABOUT_PLAQUE_KIND,
  ABOUT_CERTS_KIND,
  ABOUT_CARD_KIND,
  ABOUT_GIGS_KIND,
  DEFAULT_CONTACT_DESK_CONFIG,
  type ContactDeskConfig,
  type WallClockConfig,
  type AboutBlockOffsets,
  type AboutWall,
  type AboutLabelConfig,
  DEFAULT_BLOCK_WALL,
  DEFAULT_PLAQUE_CONFIG,
  DEFAULT_CERTS_LABEL_CONFIG,
  DEFAULT_CARD_LABEL_CONFIG,
  DEFAULT_GIGS_LABEL_CONFIG,
  MAX_WALL_CERTS,
  resolveCertPlacement,
} from "@/lib/museum/aboutRoomBlocks";
import {
  ROOM_WIDTH,
  CORNER_MARGIN,
  FRAME_WALL_OFFSET,
  INTERACT_PROXIMITY_ENTER,
  INTERACT_PROXIMITY_EXIT,
  INTERACT_GLOW_COLOR,
} from "./roomConstants";

// Self-hosted (public/fonts/) DM Sans in .woff + AnimeAce/BadaBoomBB .ttf
// — troika-three-text supports .ttf/.otf/.woff (NOT .woff2).
const FONT_REGULAR = "/fonts/DMSans-Regular.woff";
const FONT_BOLD    = "/fonts/DMSans-Bold.woff";

// ---------- Portrait -------------------------------------------------------
const PORTRAIT_HEIGHT = 2.6;
const PORTRAIT_ASPECT = 3 / 4;
const PORTRAIT_WIDTH  = PORTRAIT_HEIGHT * PORTRAIT_ASPECT;
export const PORTRAIT_X = -5.4;
const PORTRAIT_INTERVAL_MS   = 8000;
const PORTRAIT_FADE_MS       = 750;
const PORTRAIT_SCALE_ACTIVE  = 1.035;
// Every block in this room lights up in the museum's one "you're on this"
// gold (roomConstants' INTERACT_GLOW_COLOR — the same colour an artwork
// frame's border turns in a curated room), at the intensity below. This used
// to be a paler cream at about half this strength, which on these dark
// frames barely registered: walking up to a photo or a certificate was
// supposed to light it and in practice you couldn't tell. Uploaded .glb
// props deliberately get none of this — see that constant's doc comment.
const PORTRAIT_EMISSIVE_COLOR = INTERACT_GLOW_COLOR;
const ABOUT_GLOW_MAX = 1.15;
const PORTRAIT_EMISSIVE_MAX   = ABOUT_GLOW_MAX;

// ---------- Plaque ---------------------------------------------------------
export const PLAQUE_X       = -1.5;
const PLAQUE_WIDTH          = 8.6;
export const PLAQUE_TOP_Y   = FRAME_CENTER_Y + 1.7;

// The plaque's fields flow top-to-bottom — each slot is sized from its own
// font size (and the bio's wrapped line count) so making one bigger in the
// editor pushes everything under it down instead of overlapping. See the
// `plaque flow layout` block in AboutRoomContents.
const PLAQUE_LINE_HEIGHT_EM = 1.18;
const PLAQUE_BLOCK_GAP      = 0.16;
const PLAQUE_BIO_AVG_EM     = 0.5;   // rough glyph advance for the bio wrap estimate

const PLAQUE_LOGO_HEIGHT_BASE = 0.6;
const PLAQUE_LOGO_Y_OFFSET = -(PLAQUE_LOGO_HEIGHT_BASE / 2 + 0.14);

// The plaque's transparent stack, painted back to front. Every layer states
// its place explicitly because three sorts transparent objects by each
// object's *centre*, and these layers have centres metres apart on a
// 9-metre-wide plaque — left to itself the order changes with where the
// visitor stands, which is how the pills used to vanish and how the logo
// came to carve a box out of the shimmer.
const PLAQUE_GLOW_FRAME_RENDER_ORDER = -2;
const PLAQUE_PANEL_RENDER_ORDER      = -1;
const PLAQUE_SHIMMER_RENDER_ORDER    = 0;
const PLAQUE_PILL_RENDER_ORDER       = 1;
const PLAQUE_PILL_TEXT_RENDER_ORDER  = 2;
const PLAQUE_LOGO_RENDER_ORDER       = 3;

const PLAQUE_GLASS_COLOR    = "#d4d0c6";
const PLAQUE_GLASS_DARK     = "#14110d"; // Darkness=1 tint target
const PLAQUE_GLASS_OPACITY_BASE = 0.62; // multiplied by plaqueConfig.brightness
const PLAQUE_GLASS_ROUGHNESS = 0.08;
const PLAQUE_BG_COLOR       = "#211c17";
const PLAQUE_PAD_X          = 0.4;
const PLAQUE_PAD_TOP        = 0.45;
const PLAQUE_PAD_BOTTOM     = 0.65;
const PLAQUE_PANEL_TOP      = PLAQUE_PAD_TOP;
const PLAQUE_PANEL_WIDTH    = PLAQUE_WIDTH + PLAQUE_PAD_X * 2;
const PLAQUE_PANEL_CENTER_X = PLAQUE_X + PLAQUE_WIDTH / 2;

// ---------- Skills (pill badges) ------------------------------------------
const SKILL_FONT_SIZE         = 0.125;
// Uppercase DM Sans runs wide — a generous per-glyph estimate so troika's
// real layout never overflows the pill the estimate sized.
const SKILL_GLYPH_EM          = 0.66;
const SKILL_LETTER_SPACING_EM = 0.03;
const SKILL_CHIP_PAD_X        = 0.18;  // horizontal padding inside each pill
const SKILL_CHIP_PAD_Y        = 0.06;  // vertical padding inside each pill
const SKILL_GAP_X             = 0.22;
const SKILL_ROW_HEIGHT        = 0.26;  // slightly taller than before to fit pills
const SKILL_CHIP_H            = SKILL_FONT_SIZE + SKILL_CHIP_PAD_Y * 2;
const MAX_SKILL_ROWS          = 2;
// Each pill is a SINGLE flat rounded-rect mesh + its label. The old
// border/fill/text stack was separated in Z and smeared into ghost
// duplicates at grazing camera angles.
// Pill fill. One flat value, never animated and never tied to how close the
// visitor is: at the old 0.2 a pill only really read once a proximity effect
// lifted it, so walking away looked like the pills themselves vanishing and
// left the far half of a wide plaque as bare floating text. Every skill is
// meant to look like a pill from anywhere in the room.
const SKILL_PILL_OPACITY = 0.34;

// ---------- Certificates --------------------------------------------------
const CERT_SIZE             = 1.4;
export const CERT_LABEL_Y   = FRAME_CENTER_Y + 1.25;
const CERT_STAGGER_SPAN     = 0.65;
const CERT_POP_DISTANCE     = 0.07;
const CERT_LIFT_DISTANCE    = 0.05;
const CERT_GLOW_COLOR       = INTERACT_GLOW_COLOR;
const CERT_GLOW_INTENSITY   = ABOUT_GLOW_MAX;

// ---------- Calling Card --------------------------------------------------
const CARD_WIDTH            = 2.2;   // business-card landscape 2:1
const CARD_HEIGHT           = 1.1;
const CARD_BORDER_COLOR     = "#5a4632";
const CARD_EMISSIVE_MAX     = ABOUT_GLOW_MAX;
const CARD_FLIP_DURATION_MS = 700;

// ---------- Wall geometry helpers -----------------------------------------

/**
 * Returns the world-space Z/X/rotY for a block given the room's depth,
 * which wall it's on, and this room's centerZ.
 *
 * `wallFacing` is the rotation applied to the block group so content
 * always faces inward — same convention ArtworkFrame uses.
 *
 * Returns { fixedValue, freeAxis, rotationY } where
 *   fixedValue — the axis perpendicular to the wall (snapped to wall face)
 *   freeAxis  — the axis along the wall (caller adds offset on this axis)
 *   rotationY — world-space rotationY so the block faces the room center
 */
function wallGeometry(wall: AboutWall, depth: number) {
  const northZ = -depth / 2 + FRAME_WALL_OFFSET;
  const southZ =  depth / 2 - FRAME_WALL_OFFSET;
  const westX  = -ROOM_WIDTH / 2 + FRAME_WALL_OFFSET;
  const eastX  =  ROOM_WIDTH / 2 - FRAME_WALL_OFFSET;

  switch (wall) {
    case "north": return { z: northZ, x: 0, rotationY: 0 };
    case "south": return { z: southZ, x: 0, rotationY: Math.PI };
    case "west":  return { z: 0, x: westX, rotationY: Math.PI / 2 };
    case "east":  return { z: 0, x: eastX, rotationY: -Math.PI / 2 };
  }
}

/**
 * A block's local-X ("along the wall") offset → the room-local XZ shift it
 * becomes once the block group is rotated onto its wall. Same three.js
 * Y-rotation the certs proximity loop already uses:
 *   x' =  along·cos(θ)   z' = -along·sin(θ)
 */
function alongWallShift(along: number, rotationY: number): [number, number] {
  return [along * Math.cos(rotationY), -along * Math.sin(rotationY)];
}

interface SkillChip {
  key: string;
  label: string;
  row: number;
  x: number;
  width: number;
}

interface SkillLayout {
  chips: SkillChip[];
  rowCount: number;
  /** Total pill width used on each row (index = row) — for centring. */
  rowWidths: number[];
  /** Effective per-pill scale actually rendered — the admin's Pill Size
   *  multiplier, shrunk further only if that doesn't fit `maxRows` (see
   *  resolveSkillLayout). */
  scale: number;
}

function estimateChipWidth(label: string, s: number) {
  return (
    label.length * SKILL_FONT_SIZE * s * (SKILL_GLYPH_EM + SKILL_LETTER_SPACING_EM) +
    SKILL_CHIP_PAD_X * s * 2
  );
}

/** Wrap every skill into pills at scale `s` — no truncation, no "+N MORE";
 *  that's resolveSkillLayout's job to keep the row count sane. */
function layoutSkillChips(skills: MuseumAboutSkill[], maxWidth: number, s: number): SkillLayout {
  if (skills.length === 0) return { chips: [], rowCount: 0, rowWidths: [], scale: s };
  const gap = SKILL_GAP_X * s;
  const chips: SkillChip[] = [];
  const rowWidths: number[] = [];
  let row = 0;
  let rowWidth = 0;
  for (const skill of skills) {
    const label = skill.name.toUpperCase();
    const width = estimateChipWidth(label, s);
    if (rowWidth > 0 && rowWidth + gap + width > maxWidth) {
      rowWidths[row] = rowWidth;
      row++;
      rowWidth = 0;
    }
    const x = rowWidth === 0 ? 0 : rowWidth + gap;
    chips.push({ key: skill.id, label, row, x, width });
    rowWidth = x + width;
  }
  rowWidths[row] = rowWidth;
  return { chips, rowCount: row + 1, rowWidths, scale: s };
}

/** Start from the admin's chosen Pill Size (`baseScale`) and only shrink
 *  from there — down to a hard floor — until every skill fits within
 *  `maxRows`. The user wants all skills visible (never a "+N MORE" pill)
 *  *and* direct control over how big the pills read. */
function resolveSkillLayout(
  skills: MuseumAboutSkill[],
  maxWidth: number,
  baseScale: number,
  maxRows = MAX_SKILL_ROWS
): SkillLayout {
  let last = layoutSkillChips(skills, maxWidth, baseScale);
  for (let s = baseScale; s >= 0.35; s -= 0.05) {
    last = layoutSkillChips(skills, maxWidth, s);
    if (last.rowCount <= maxRows) return last;
  }
  return last;
}

/** The room-wide plaque finish, handed to every AboutBanner in the tree. A
 *  context rather than a prop because the three headings that draw one sit
 *  inside three unrelated components (the certificates wall, the gigs board,
 *  the calling card) that would otherwise each gain a prop they only pass on. */
const AboutBannerStyleContext = createContext<RoomBannerStyle>(
  defaultRoomBannerStyle("ABOUT")
);

// --------------------------------------------------------------------------

export function AboutRoomContents({
  data,
  depth,
  centerZ,
  baseY = 0,
  shouldLoad = true,
  onActiveCertChange,
  onGigsProximityChange,
  onContactProximityChange,
  contact,
  clock,
  blockOffsets,
  banner = defaultRoomBannerStyle("ABOUT"),
}: {
  data: MuseumAboutData;
  /** The room's shared plaque finish — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  depth: number;
  centerZ: number;
  /** This room's own floor Y (see roomLayout.ts's floorYSouth) — non-zero
   * only when About ScriptOverNovel has been moved to the Second Floor. */
  baseY?: number;
  shouldLoad?: boolean;
  onActiveCertChange?: (cert: MuseumAboutCertificate | null) => void;
  /** Fires true/false as the player enters/leaves [E]-interact range of the
   *  Timeline & Gigs board — MuseumScene opens the events panel on activate. */
  onGigsProximityChange?: (near: boolean) => void;
  /** Same again for the Contact Desk — MuseumScene opens the "Send an Email"
   *  panel on activate. */
  onContactProximityChange?: (near: boolean) => void;
  /** The Contact Desk's placement + config, straight off its scene-object row
   *  (see MuseumRoomPublic.aboutContact). Absent = the room has no desk. */
  contact?: {
    position: [number, number, number];
    rotationY: number;
    scale: number;
    config: Required<ContactDeskConfig>;
  };
  /** The digital wall clock's placement + config, straight off its scene-
   *  object row (see MuseumRoomPublic.aboutClock). Absent = no clock. */
  clock?: {
    position: [number, number, number];
    rotationY: number;
    scale: number;
    config: Required<WallClockConfig>;
  };
  blockOffsets?: AboutBlockOffsets;
}) {
  const { camera } = useThree();

  // Resolve per-block wall + hang-height from admin config (or defaults).
  // Each block is placed by its wall alone (like an artwork frame); the
  // only free value is a vertical hang-height delta (offset[1]) — X/Z
  // always come from the wall (see lib/museum/aboutRoomBlocks.ts).
  const photoMeta  = blockOffsets?.[ABOUT_PHOTO_KIND];
  const plaqueMeta = blockOffsets?.[ABOUT_PLAQUE_KIND];
  const certsMeta  = blockOffsets?.[ABOUT_CERTS_KIND];
  const cardMeta   = blockOffsets?.[ABOUT_CARD_KIND];
  const gigsMeta   = blockOffsets?.[ABOUT_GIGS_KIND];

  const photoWall  = photoMeta?.wall  ?? DEFAULT_BLOCK_WALL[ABOUT_PHOTO_KIND];
  const plaqueWall = plaqueMeta?.wall ?? DEFAULT_BLOCK_WALL[ABOUT_PLAQUE_KIND];
  const certsWall  = certsMeta?.wall  ?? DEFAULT_BLOCK_WALL[ABOUT_CERTS_KIND];
  const cardWall   = cardMeta?.wall   ?? DEFAULT_BLOCK_WALL[ABOUT_CARD_KIND];
  const gigsWall   = gigsMeta?.wall   ?? DEFAULT_BLOCK_WALL[ABOUT_GIGS_KIND];

  // "Hide from Museum" per block. Read as its own booleans next to the walls
  // and heights above so every use below reads the same way, and so the
  // minimap's copy of this decision (MuseumScene's `hung` list) has an
  // obvious counterpart to stay in step with.
  const showPhoto  = !photoMeta?.hidden;
  const showPlaque = !plaqueMeta?.hidden;
  const showCerts  = !certsMeta?.hidden;
  const showCard   = !cardMeta?.hidden;
  const showGigs   = !gigsMeta?.hidden;

  const photoHeight  = photoMeta?.offset[1]  ?? 0;
  const plaqueHeight = plaqueMeta?.offset[1] ?? 0;
  const certsHeight  = certsMeta?.offset[1]  ?? 0;
  const cardHeight   = cardMeta?.offset[1]   ?? 0;
  const gigsHeight   = gigsMeta?.offset[1]   ?? 0;

  // Admin "Resize" (SceneObject.scale) — applied as the block group's scale.
  const photoScale  = photoMeta?.scale  ?? 1;
  const plaqueScale = plaqueMeta?.scale ?? 1;
  const certsScale  = certsMeta?.scale  ?? 1;
  const cardScale   = cardMeta?.scale   ?? 1;
  const gigsScale   = gigsMeta?.scale   ?? 1;

  const plaqueConfig = plaqueMeta?.plaqueConfig ?? DEFAULT_PLAQUE_CONFIG;
  const certsLabel   = certsMeta?.labelConfig ?? DEFAULT_CERTS_LABEL_CONFIG;
  const cardLabel    = cardMeta?.labelConfig  ?? DEFAULT_CARD_LABEL_CONFIG;
  const gigsLabel    = gigsMeta?.labelConfig  ?? DEFAULT_GIGS_LABEL_CONFIG;

  // Resolve wall geometry for each block
  const photoGeo  = wallGeometry(photoWall,  depth);
  const plaqueGeo = wallGeometry(plaqueWall, depth);
  const certsGeo  = wallGeometry(certsWall,  depth);
  const cardGeo   = wallGeometry(cardWall,   depth);
  const gigsGeo   = wallGeometry(gigsWall,   depth);

  // Along-wall placement = admin "Hang Width" (offset[0]) plus each block's
  // own designed along-wall anchor (Photo/Plaque sit off-centre by design;
  // Certs/Card are centred). Both are local-X values resolved onto the
  // block's wall via its rotation — see alongWallShift.
  const photoDesign  = photoWall  === "north" || photoWall  === "south" ? PORTRAIT_X : 0;
  const plaqueDesign = plaqueWall === "north" || plaqueWall === "south" ? PLAQUE_X   : 0;
  const [photoDX,  photoDZ]  = alongWallShift((photoMeta?.offset[0]  ?? 0) + photoDesign,  photoGeo.rotationY);
  const [plaqueDX, plaqueDZ] = alongWallShift((plaqueMeta?.offset[0] ?? 0) + plaqueDesign, plaqueGeo.rotationY);
  const [certsDX,  certsDZ]  = alongWallShift(certsMeta?.offset[0] ?? 0, certsGeo.rotationY);
  const [cardDX,   cardDZ]   = alongWallShift(cardMeta?.offset[0]  ?? 0, cardGeo.rotationY);
  const [gigsDX,   gigsDZ]   = alongWallShift(gigsMeta?.offset[0]  ?? 0, gigsGeo.rotationY);

  // Compose actual world positions (room-local, centerZ added at the outer group)
  const photoPos: [number, number, number]  = [
    photoGeo.x + photoDX,
    FRAME_CENTER_Y + photoHeight,
    photoGeo.z + photoDZ,
  ];
  const plaquePos: [number, number, number] = [
    plaqueGeo.x + plaqueDX,
    PLAQUE_TOP_Y + plaqueHeight,
    plaqueGeo.z + plaqueDZ,
  ];
  const factsLine = [
    data.basedIn   && `Based in ${data.basedIn}`,
    data.experience && `${data.experience} experience`,
    data.languages && data.languages,
  ].filter(Boolean).join("   ·   ");

  const bioParagraph  = data.bio?.split("\n\n").find((p) => p.trim().length > 0) ?? "";
  const bioExcerpt    = bioParagraph.length > 300
    ? `${bioParagraph.slice(0, 297).trimEnd()}…`
    : bioParagraph;

  // --- Plaque flow layout ------------------------------------------------
  // Stack Name → Headline → Facts → Bio → (Skills heading) → pills, each at
  // the running bottom of everything above it. Slot heights are estimated
  // from font size (bio also from its wrapped line count) — generous enough
  // that a cranked-up size never overlaps the next block.
  const bioCharsPerLine = Math.max(8, Math.floor(PLAQUE_WIDTH / (plaqueConfig.bioSize * PLAQUE_BIO_AVG_EM)));
  const bioLineCount = bioExcerpt ? Math.max(1, Math.ceil(bioExcerpt.length / bioCharsPerLine)) : 0;

  let plaqueCursorY = 0;
  const yName = plaqueCursorY;
  plaqueCursorY -= plaqueConfig.nameSize * PLAQUE_LINE_HEIGHT_EM + PLAQUE_BLOCK_GAP;
  const yHeadline = plaqueCursorY;
  if (data.headline) plaqueCursorY -= plaqueConfig.headlineSize * PLAQUE_LINE_HEIGHT_EM + PLAQUE_BLOCK_GAP;
  const yFacts = plaqueCursorY;
  if (factsLine) plaqueCursorY -= plaqueConfig.factsSize * PLAQUE_LINE_HEIGHT_EM + PLAQUE_BLOCK_GAP;
  const yBio = plaqueCursorY;
  if (bioExcerpt) plaqueCursorY -= bioLineCount * plaqueConfig.bioSize * 1.4 + PLAQUE_BLOCK_GAP;
  const ySkillsArea = plaqueCursorY - 0.12;

  const skillLayout = useMemo(
    () => resolveSkillLayout(data.skills, PLAQUE_WIDTH, plaqueConfig.skillsPillFontSize),
    [data.skills, plaqueConfig.skillsPillFontSize]
  );
  const skillRowCount = skillLayout.rowCount || 1;
  // Pills start below the "Artist Skills" heading (only shown when there are
  // skills + a non-blank label).
  const showSkillsLabel = skillLayout.chips.length > 0 && plaqueConfig.skillsLabel.trim().length > 0;
  const skillsTopY = ySkillsArea - (showSkillsLabel ? plaqueConfig.skillsLabelSize + 0.16 : 0);
  const plaquePanelBottom =
    skillsTopY - (skillRowCount - 1) * SKILL_ROW_HEIGHT * skillLayout.scale - PLAQUE_PAD_BOTTOM;
  const plaquePanelHeight = PLAQUE_PANEL_TOP - plaquePanelBottom;
  const plaquePanelCenterY = PLAQUE_TOP_Y + (PLAQUE_PANEL_TOP + plaquePanelBottom) / 2;

  const certs    = data.certificates.slice(0, MAX_WALL_CERTS);
  // Certs spread evenly along whichever wall they're on — the room depth
  // for the E/W walls, the room width for N/S. Symmetric about the wall's
  // centre; this is the certs group's *local* X, which the group's own
  // wall rotation turns into the along-wall axis (same pattern as the
  // Photo/Plaque blocks — content near the local origin, wall anchor +
  // rotation on the wrapping group).
  const certWallSpan = certsWall === "north" || certsWall === "south" ? ROOM_WIDTH : depth;
  const certUsable   = Math.max(0, certWallSpan - CORNER_MARGIN * 2);
  const certSpread = certs.length <= 1
    ? [0]
    : certs.map((_, i) => -certUsable / 2 + (certUsable / (certs.length - 1)) * i);
  // Each certificate's actual spot, in the certs group's local space: the
  // spread above plus whatever the admin nudged that one certificate by in the
  // Scene Editor (aboutRoomBlocks' CertPlacement — a delta, so the strip's own
  // Hang Width / Hang Height / Resize still carry every thumb with them, and
  // adding a certificate still re-spreads the row without stranding the ones
  // already placed by hand). Resolved once here rather than inside the thumb,
  // because the proximity tracker below has to measure to the same spots.
  const certLayout = certs.map((cert, i) => {
    const placement = resolveCertPlacement(certsMeta?.certPlacements, cert.id);
    return {
      along:  certSpread[i] + placement.along,
      height: placement.height,
      scale:  placement.scale,
    };
  });

  // Focus refs — world-space target; useWallFocus.ts does its own
  // world-space camera read internally (see that file), so nothing here
  // needs to change for the player-rig refactor.
  const portraitFocusRef = useWallFocus({
    point:  [photoPos[0], photoPos[1], centerZ + photoPos[2]],
    normal: [Math.sin(photoGeo.rotationY), 0, Math.cos(photoGeo.rotationY)],
    maxDistance: 5.5,
  });
  const certFocusRef = useWallFocus({
    point:  [certsGeo.x + certsDX, FRAME_CENTER_Y + certsHeight, centerZ + certsGeo.z + certsDZ],
    normal: [Math.sin(certsGeo.rotationY), 0, Math.cos(certsGeo.rotationY)],
    maxDistance: 9,
  });
  // The plaque, targeted at its *panel's* centre rather than the group
  // origin — that origin is the name's top-left corner, several metres off
  // to one side of a 9-metre-wide panel, so aiming at it would have lit the
  // plaque up only while a visitor stood at its left-hand end. The panel's
  // local centre is carried onto the wall by the block's own rotation, the
  // same alongWallShift every position here goes through. Generous distance:
  // this is the widest thing in the room and a visitor reads it from further
  // back than they'd stand to look at a photo.
  const [plaquePanelDX, plaquePanelDZ] = alongWallShift(
    (PLAQUE_PANEL_CENTER_X - PLAQUE_X) * plaqueScale,
    plaqueGeo.rotationY
  );
  const plaqueFocusRef = useWallFocus({
    point: [
      plaquePos[0] + plaquePanelDX,
      plaquePos[1] + (plaquePanelCenterY - PLAQUE_TOP_Y) * plaqueScale,
      centerZ + plaquePos[2] + plaquePanelDZ,
    ],
    normal: [Math.sin(plaqueGeo.rotationY), 0, Math.cos(plaqueGeo.rotationY)],
    maxDistance: 9,
  });
  // Card position — same shape as Certs: the wall supplies the perpendicular
  // axis, admin Hang Width / Height slide it along the wall / vertically.
  const cardPos: [number, number, number] = [
    cardGeo.x + cardDX,
    FRAME_CENTER_Y + 0.3 + cardHeight,
    cardGeo.z + cardDZ,
  ];
  const cardFocusRef = useWallFocus({
    point:  [cardPos[0], cardPos[1], centerZ + cardPos[2]],
    normal: [Math.sin(cardGeo.rotationY), 0, Math.cos(cardGeo.rotationY)],
    maxDistance: 6,
  });

  // Timeline & Gigs board — wall anchor + Hang Width/Height (same shape as
  // Certs/Card). Its centre is where the framed map hangs.
  const gigsPos: [number, number, number] = [
    gigsGeo.x + gigsDX,
    FRAME_CENTER_Y + gigsHeight,
    gigsGeo.z + gigsDZ,
  ];
  const gigsFocusRef = useWallFocus({
    point:  [gigsPos[0], gigsPos[1], centerZ + gigsPos[2]],
    normal: [Math.sin(gigsGeo.rotationY), 0, Math.cos(gigsGeo.rotationY)],
    maxDistance: 7,
  });

  // Nearest-cert proximity (same hysteresis as PlayerControls)
  const activeCertIndexRef = useRef(-1);
  // World-space camera position scratch, shared by the three proximity
  // trackers below — `camera.position` is local to the player rig, not
  // world space (see Docs/Museum_VRMode.md §3.1). Reused every frame, not
  // allocated; each tracker refills it at the top of its own useFrame since
  // R3F doesn't guarantee these three run in a fixed relative order.
  const scratchCamPos = useRef(new THREE.Vector3());
  useFrame(() => {
    if (!onActiveCertChange || certs.length === 0) return;
    // Strip hidden from the museum — release whichever certificate was the
    // active [E] target, then stop tracking. Without the release a visitor
    // standing at the strip when it was switched off would keep its info
    // panel open against a wall with nothing on it.
    if (!showCerts) {
      if (activeCertIndexRef.current !== -1) {
        activeCertIndexRef.current = -1;
        onActiveCertChange(null);
      }
      return;
    }
    camera.getWorldPosition(scratchCamPos.current);
    // World XZ of cert i — its along-wall local offset rotated onto the
    // wall the strip is mounted on (mirrors the certs group's transform).
    const cosR = Math.cos(certsGeo.rotationY);
    const sinR = Math.sin(certsGeo.rotationY);
    const certDist = (i: number) => Math.hypot(
      scratchCamPos.current.x - (certsGeo.x + certsDX + certLayout[i].along * certsScale * cosR),
      scratchCamPos.current.z - (centerZ + certsGeo.z + certsDZ - certLayout[i].along * certsScale * sinR)
    );
    let nearestIndex = 0;
    let nearestDist  = Infinity;
    for (let i = 0; i < certs.length; i++) {
      const dist = certDist(i);
      if (dist < nearestDist) { nearestDist = dist; nearestIndex = i; }
    }
    const current = activeCertIndexRef.current;
    if (current === -1) {
      if (nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeCertIndexRef.current = nearestIndex;
        onActiveCertChange(certs[nearestIndex]);
      }
    } else {
      const distToCurrent = certDist(current);
      if (nearestIndex !== current && nearestDist <= INTERACT_PROXIMITY_ENTER && nearestDist < distToCurrent) {
        activeCertIndexRef.current = nearestIndex;
        onActiveCertChange(certs[nearestIndex]);
      } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
        activeCertIndexRef.current = -1;
        onActiveCertChange(null);
      }
    }
  });

  // Gigs board proximity — boolean (one panel for the whole board), same
  // enter/exit hysteresis as the cert tracker above.
  const gigsNearRef = useRef(false);
  useFrame(() => {
    if (!onGigsProximityChange) return;
    // Same release-then-stop as the certificates tracker above.
    if (!showGigs) {
      if (gigsNearRef.current) {
        gigsNearRef.current = false;
        onGigsProximityChange(false);
      }
      return;
    }
    camera.getWorldPosition(scratchCamPos.current);
    const dist = Math.hypot(
      scratchCamPos.current.x - gigsPos[0],
      scratchCamPos.current.z - (centerZ + gigsPos[2])
    );
    if (!gigsNearRef.current && dist <= INTERACT_PROXIMITY_ENTER) {
      gigsNearRef.current = true;
      onGigsProximityChange(true);
    } else if (gigsNearRef.current && dist > INTERACT_PROXIMITY_EXIT) {
      gigsNearRef.current = false;
      onGigsProximityChange(false);
    }
  });

  // Contact Desk proximity — same boolean tracker with the same enter/exit
  // hysteresis. The desk stands *against* its wall rather than hanging on it,
  // so it's pulled a little into the room off the wall face; measuring to
  // that pulled-in point is what makes "walk up to the desk" and "the prompt
  // appears" line up.
  // Furniture, not a hanging: the desk carries its own absolute placement
  // (dragged and turned in the Scene Editor exactly like a Stories podium),
  // so there is no wall geometry to resolve here.
  const contactPos: [number, number, number] = contact?.position ?? [0, 0, 0];
  const contactConfig = contact?.config ?? DEFAULT_CONTACT_DESK_CONFIG;
  //
  // Unlike the trackers above this one runs even with no callback attached:
  // it also drives the desk's own highlight, which the Scene Editor's preview
  // (which passes no callback) should still show.
  const contactNearRef = useRef(false);
  const [contactActive, setContactActive] = useState(false);
  useFrame(() => {
    // No desk in this room — hidden from the museum, or its row failed to
    // provision. Without this the tracker went on measuring against
    // contactPos' [0,0,0] fallback, so walking through the middle of the
    // room lit up "Press [E] to Send an Email" at nothing, and pressing it
    // opened the contact form. Anything already in range is released first,
    // so a desk hidden mid-visit doesn't leave the prompt stuck on screen.
    if (!contact) {
      if (contactNearRef.current) {
        contactNearRef.current = false;
        setContactActive(false);
        onContactProximityChange?.(false);
      }
      return;
    }
    camera.getWorldPosition(scratchCamPos.current);
    const dist = Math.hypot(
      scratchCamPos.current.x - contactPos[0],
      scratchCamPos.current.z - (centerZ + contactPos[2])
    );
    if (!contactNearRef.current && dist <= INTERACT_PROXIMITY_ENTER) {
      contactNearRef.current = true;
      setContactActive(true);
      onContactProximityChange?.(true);
    } else if (contactNearRef.current && dist > INTERACT_PROXIMITY_EXIT) {
      contactNearRef.current = false;
      setContactActive(false);
      onContactProximityChange?.(false);
    }
  });

  // Plaque frosted-glass look: Brightness sets the opacity, Darkness tints
  // the panel from its default light grey toward near-black and firms up the
  // opacity so it can read as a solid dark panel. The logo plate is handed
  // the same colour + opacity so the two always match.
  const glassDark = THREE.MathUtils.clamp(plaqueConfig.darkness, 0, 1);
  const glassColor = useMemo(
    () => new THREE.Color(PLAQUE_GLASS_COLOR).lerp(new THREE.Color(PLAQUE_GLASS_DARK), glassDark),
    [glassDark]
  );
  const glassOpacity = Math.min(
    1,
    PLAQUE_GLASS_OPACITY_BASE * plaqueConfig.brightness + glassDark * 0.3
  );

  return (
    <AboutBannerStyleContext.Provider value={banner}>
    <group position={[0, baseY, centerZ]}>

      {/* ── Photo Slideshow ─────────────────────────────────────────── */}
      {showPhoto && data.images.length > 0 && (
        <group
          position={[photoPos[0], photoPos[1], photoPos[2]]}
          rotation={[0, photoGeo.rotationY, 0]}
          scale={photoScale}
        >
          <PortraitSlideshow
            images={data.images}
            shouldLoad={shouldLoad}
            focusRef={portraitFocusRef}
          />
        </group>
      )}

      {/* ── Bio & Skills Plaque ─────────────────────────────────────── */}
      {/* Resize scales about the group origin (the name's top-left) — the
          editor's Resize range is kept modest so the panel can't run off
          the wall. */}
      {showPlaque && (
      <group
        position={[plaquePos[0], plaquePos[1], plaquePos[2]]}
        rotation={[0, plaqueGeo.rotationY, 0]}
        scale={plaqueScale}
      >
        {/* Frosted-glass backing panel.
            renderOrder −1 pins it to the back of the transparent pass, and
            that is load-bearing rather than tidiness. Three sorts transparent
            objects back-to-front by each object's *centre*, so a skill pill
            out at the far end of a plaque seen at an angle sorts as further
            away than this panel's centre and therefore draws first — then the
            panel paints straight over it, because the pills set
            depthWrite:false and so never wrote the depth that would have
            protected them. That is what made the far half of the pills vanish
            as a visitor backed away and reappear as they walked up: not an
            effect fading, but the sort order flipping. */}
        <mesh
          renderOrder={PLAQUE_PANEL_RENDER_ORDER}
          position={[PLAQUE_PANEL_CENTER_X - PLAQUE_X, plaquePanelCenterY - PLAQUE_TOP_Y, -0.02]}
        >
          <planeGeometry args={[PLAQUE_PANEL_WIDTH, plaquePanelHeight]} />
          <meshStandardMaterial
            color={glassColor}
            transparent
            opacity={glassOpacity}
            roughness={PLAQUE_GLASS_ROUGHNESS}
          />
        </mesh>
        {/* The border that lights up on approach — the plaque's answer to
            the frame every other block in this room glows. */}
        <GlowFrame
          width={PLAQUE_PANEL_WIDTH}
          height={plaquePanelHeight}
          focusRef={plaqueFocusRef}
          position={[PLAQUE_PANEL_CENTER_X - PLAQUE_X, plaquePanelCenterY - PLAQUE_TOP_Y, -0.021]}
        />
        {/* …and the light travelling across it. Its own plane sitting just in
            front of the glass, so the sweep rides the panel and nothing in
            front of it — name, bio, skill pills — is touched. */}
        <PlaqueShimmer
          width={PLAQUE_PANEL_WIDTH}
          height={plaquePanelHeight}
          position={[PLAQUE_PANEL_CENTER_X - PLAQUE_X, plaquePanelCenterY - PLAQUE_TOP_Y, -0.019]}
          speed={plaqueConfig.plaqueShimmerSpeed}
          strength={plaqueConfig.plaqueShimmerStrength}
          active={shouldLoad}
        />

        {/* Logo — printed straight onto the plaque's own glass at its
            top-right, capped to the right ~45% of the panel so Logo Size
            can't grow it over the name/bio text. */}
        {data.logoImage && (
          <AboutLogo
            url={data.logoImage}
            shouldLoad={shouldLoad}
            rightEdgeX={PLAQUE_WIDTH - 0.15}
            minLeftX={PLAQUE_WIDTH * 0.55}
            y={PLAQUE_LOGO_Y_OFFSET}
            height={PLAQUE_LOGO_HEIGHT_BASE * plaqueConfig.logoScale}
          />
        )}

        {/* Name */}
        {/* material-toneMapped={false} on every plaque text field — the
            renderer's tone-mapping curve lifts an SDF glyph's partial-alpha
            edge pixels differently than its solid interior, which shows as
            a light "outline" once the admin sets a dark colour on a dark
            panel (fine on a light colour, where there's no room to look
            brighter). Same reasoning MuseumRoom.tsx's image planes already
            use toneMapped={false} for. */}
        <Text
          position={[0, yName, 0]}
          fontSize={plaqueConfig.nameSize}
          maxWidth={PLAQUE_WIDTH}
          color={plaqueConfig.nameColor}
          anchorX="left"
          anchorY="top"
          font={plaqueConfig.nameFontFamily}
          material-toneMapped={false}
        >
          {data.displayName}
        </Text>

        {/* Headline */}
        {data.headline && (
          <Text
            position={[0, yHeadline, 0]}
            fontSize={plaqueConfig.headlineSize}
            maxWidth={PLAQUE_WIDTH}
            color={plaqueConfig.headlineColor}
            anchorX="left"
            anchorY="top"
            font={plaqueConfig.headlineFontFamily}
            material-toneMapped={false}
          >
            {data.headline}
          </Text>
        )}

        {/* Based In · Experience · Languages */}
        {factsLine && (
          <Text
            position={[0, yFacts, 0]}
            fontSize={plaqueConfig.factsSize}
            maxWidth={PLAQUE_WIDTH}
            color={plaqueConfig.factsColor}
            anchorX="left"
            anchorY="top"
            font={plaqueConfig.factsFontFamily}
            material-toneMapped={false}
          >
            {factsLine}
          </Text>
        )}

        {/* Bio */}
        {bioExcerpt && (
          <Text
            position={[0, yBio, 0]}
            fontSize={plaqueConfig.bioSize}
            maxWidth={PLAQUE_WIDTH}
            lineHeight={1.4}
            color={plaqueConfig.bioColor}
            anchorX="left"
            anchorY="top"
            font={plaqueConfig.bioFontFamily}
            material-toneMapped={false}
          >
            {bioExcerpt}
          </Text>
        )}

        {/* Skill badges — every skill shown (auto-shrunk to fit), under a
            featured "Artist Skills" heading; pill UI mirroring Public/About */}
        {skillLayout.chips.length > 0 && (
          <>
            {plaqueConfig.skillsLabel.trim() && (
              <Text
                position={[0, ySkillsArea, 0]}
                fontSize={plaqueConfig.skillsLabelSize}
                letterSpacing={0.14}
                maxWidth={PLAQUE_WIDTH}
                color={plaqueConfig.skillsLabelColor}
                anchorX="left"
                anchorY="top"
                font={plaqueConfig.skillsLabelFontFamily}
                material-toneMapped={false}
              >
                {plaqueConfig.skillsLabel}
              </Text>
            )}
            <SkillsBlock
              chips={skillLayout.chips}
              rowWidths={skillLayout.rowWidths}
              scale={skillLayout.scale}
              plaqueX={0}
              maxWidth={PLAQUE_WIDTH}
              align={plaqueConfig.skillsAlign}
              topY={skillsTopY}
              pillColor={plaqueConfig.skillsPillColor}
              textColor={plaqueConfig.skillsPillTextColor}
              fontFamily={plaqueConfig.skillsPillFontFamily}
            />
          </>
        )}
      </group>
      )}

      {/* ── Certificates Strip ──────────────────────────────────────── */}
      {showCerts && certs.length > 0 && (
        <group
          // Origin at eye level (like Photo/Plaque) so Resize scales the
          // strip in place rather than launching it off the floor.
          position={[certsGeo.x + certsDX, FRAME_CENTER_Y + certsHeight, certsGeo.z + certsDZ]}
          rotation={[0, certsGeo.rotationY, 0]}
          scale={certsScale}
        >
          {/* Admin-editable heading (text / font / colour / plate) */}
          <AboutBanner label={certsLabel} position={[0, CERT_LABEL_Y - FRAME_CENTER_Y + 0.12, 0]} />
          {certs.map((cert, i) => (
            <CertificateThumb
              key={cert.id}
              cert={cert}
              alongWall={certLayout[i].along}
              hangHeight={certLayout[i].height}
              scale={certLayout[i].scale}
              shouldLoad={shouldLoad}
              wallFocusRef={certFocusRef}
              index={i}
              total={certs.length}
            />
          ))}
        </group>
      )}

      {/* ── Calling Card ────────────────────────────────────────────── */}
      {showCard && data.callingCardFront && (
        <CallingCardDisplay
          front={data.callingCardFront}
          back={data.callingCardBack}
          shouldLoad={shouldLoad}
          focusRef={cardFocusRef}
          position={cardPos}
          rotationY={cardGeo.rotationY}
          scale={cardScale}
          label={cardLabel}
        />
      )}

      {/* ── Timeline & Gigs ─────────────────────────────────────────── */}
      {showGigs && (
        <group
          position={gigsPos}
          rotation={[0, gigsGeo.rotationY, 0]}
          scale={gigsScale}
        >
          <GigsBoard gigs={data.gigs} label={gigsLabel} shouldLoad={shouldLoad} focusRef={gigsFocusRef} />
        </group>
      )}

      {/* ── Contact Desk ────────────────────────────────────────────── */}
      {/* The room's one interactive prop. `active` is driven by this file's
          own proximity tracker rather than MuseumScene's activeContact, so
          the desk warms up on approach even before the prompt appears. */}
      {contact && (
      <ContactDesk
        position={contactPos}
        rotationY={contact?.rotationY ?? 0}
        scale={contact?.scale ?? 1}
        active={contactActive}
        shouldLoad={shouldLoad}
        label={contactConfig.title}
        modelUrl={contactConfig.url}
        textureUrl={contactConfig.textureUrl}
      />
      )}

      {/* ── Digital Wall Clock ──────────────────────────────────────── */}
      {/* Hung wherever the admin dragged it. `ticking` follows the same
          shouldLoad gate every other block here uses — there's nothing to
          keep in time while the visitor is rooms away, and it catches up
          the instant they're back. */}
      {clock && (
        <group
          position={clock.position}
          rotation={[0, clock.rotationY, 0]}
          scale={clock.scale}
        >
          <WallClock config={clock.config} ticking={shouldLoad} />
        </group>
      )}
    </group>
    </AboutBannerStyleContext.Provider>
  );
}

// --- Skills block (pill badge version) ------------------------------------

/** A flat, origin-centred rounded-rect outline for one pill. */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const rr = Math.max(0.001, Math.min(r, h / 2, w / 2));
  const x = -w / 2;
  const y = -h / 2;
  const s = new THREE.Shape();
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

// --- Proximity glow frame --------------------------------------------------
// The border every other block in this room already has, for the one block
// that doesn't: the Bio & Skills Plaque is a bare sheet of glass, so there
// was no frame on it to light up when a visitor walked over. This draws a
// rim just outside the panel's edge and fades it in on approach, in the same
// gold at the same strength as the photo / certificate / card / gigs frames.
//
// A ring rather than a filled quad, and sitting *behind* the panel: a filled
// backing would put an opaque sheet behind a deliberately translucent one,
// and only the part standing out past the panel is the border anyway.
// meshBasicMaterial so it reads as light rather than as a lit surface —
// an emissive standard material in a dim room barely shows, which is a large
// part of why the old glows were so easy to miss.
const GLOW_FRAME_THICKNESS = 0.1;

function GlowFrame({
  width,
  height,
  focusRef,
  position,
}: {
  width: number;
  height: number;
  focusRef: RefObject<number>;
  position: [number, number, number];
}) {
  const shape = useMemo(() => {
    const outer = roundedRectShape(
      width + GLOW_FRAME_THICKNESS * 2,
      height + GLOW_FRAME_THICKNESS * 2,
      GLOW_FRAME_THICKNESS * 1.6
    );
    outer.holes.push(roundedRectShape(width, height, GLOW_FRAME_THICKNESS));
    return outer;
  }, [width, height]);

  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const idleRef = useRef(true);
  useFrame(() => {
    const focus = focusRef.current;
    if (focus < WALL_FOCUS_EPSILON && idleRef.current) return;
    idleRef.current = focus < WALL_FOCUS_EPSILON;
    if (matRef.current) matRef.current.opacity = focus;
  });

  return (
    // renderOrder −2 — behind the glass panel's own −1, for the same reason
    // that one is pinned: transparent objects sort by centre, and this ring's
    // centre and the panel's are the same point.
    <mesh position={position} renderOrder={PLAQUE_GLOW_FRAME_RENDER_ORDER}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        ref={matRef}
        color={INTERACT_GLOW_COLOR}
        transparent
        opacity={0}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// --- Plaque shimmer --------------------------------------------------------
// A soft band of light travelling across the plaque's glass panel.
//
// Drawn as one extra plane the exact size of the panel, carrying a repeating
// 1D gradient, and animated by scrolling that texture's offset. Doing it in
// the texture rather than by moving a narrow highlight mesh is what keeps the
// band clipped to the panel for free — a moving mesh would need to be masked
// at both edges, and would slide out over the room's wall on every pass.
const SHIMMER_TEX_WIDTH = 128;
/** Band half-width as a fraction of the panel. Wide enough to read as a sheen
 *  crossing the glass rather than a stripe wiping over it. */
const SHIMMER_BAND = 0.1;

function PlaqueShimmer({
  width,
  height,
  position,
  speed,
  strength,
  active,
}: {
  width: number;
  height: number;
  position: [number, number, number];
  /** Sweeps per second; 0 parks the band off-panel and stops the work. */
  speed: number;
  /** How bright the band burns, 0–1. 0 is the same as switching it off. */
  strength: number;
  /** False while the room is far enough away not to be drawn — no reason to
   *  scroll a texture nobody is looking at. */
  active: boolean;
}) {
  const texture = useMemo(() => {
    const data = new Uint8Array(SHIMMER_TEX_WIDTH * 4);
    for (let i = 0; i < SHIMMER_TEX_WIDTH; i++) {
      // Gaussian falloff around the middle of the strip, so tiling it leaves
      // one soft band with flat dark space either side of it.
      const t = i / SHIMMER_TEX_WIDTH - 0.5;
      const a = Math.exp(-(t * t) / (2 * SHIMMER_BAND * SHIMMER_BAND));
      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = Math.round(a * 255);
    }
    const tex = new THREE.DataTexture(data, SHIMMER_TEX_WIDTH, 1, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, []);

  // Freeing it matters here: a DataTexture holds a GPU allocation that
  // outlives the component unless it's disposed.
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (!active || speed <= 0) return;
    texture.offset.x = -((performance.now() / 1000) * speed) % 1;
  });

  if (speed <= 0 || strength <= 0) return null;

  return (
    <mesh position={position} renderOrder={PLAQUE_SHIMMER_RENDER_ORDER}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={strength}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function SkillsBlock({
  chips,
  rowWidths,
  scale,
  plaqueX,
  maxWidth,
  align,
  topY,
  pillColor,
  textColor,
  fontFamily,
}: {
  chips: SkillChip[];
  /** Total pill width used on each row (index = row) — for centring. */
  rowWidths: number[];
  /** Effective per-pill scale from resolveSkillLayout — scales font + pill
   *  geometry. */
  scale: number;
  plaqueX: number;
  /** The plaque's own text column width — the space rows centre within. */
  maxWidth: number;
  align: "left" | "center";
  topY: number;
  /** Uniform pill fill + text colour — every skill reads the same, and reads
   *  the same from any distance (no per-skill accent tint, and nothing keyed
   *  to proximity: see SKILL_PILL_OPACITY). */
  pillColor: string;
  textColor: string;
  fontFamily: string;
}) {
  const fontSize = SKILL_FONT_SIZE * scale;
  const chipH    = SKILL_CHIP_H * scale;
  const rowH     = SKILL_ROW_HEIGHT * scale;
  const radius   = chipH / 2;

  const shapes = useMemo(
    () => chips.map((c) => roundedRectShape(c.width, chipH, radius)),
    [chips, chipH, radius]
  );

  return (
    <>
      {chips.map((chip, i) => {
        const rowOffset = align === "center" ? (maxWidth - (rowWidths[chip.row] ?? 0)) / 2 : 0;
        const cx = plaqueX + rowOffset + chip.x + chip.width / 2;
        const cy = topY - chip.row * rowH - chipH / 2;
        return (
          <group key={chip.key} position={[cx, cy, 0]}>
            {/* renderOrder 1 — after the glass panel (−1) whatever the
                camera angle. See the panel's own comment. */}
            <mesh renderOrder={PLAQUE_PILL_RENDER_ORDER}>
              <shapeGeometry args={[shapes[i]]} />
              <meshStandardMaterial
                color={pillColor}
                transparent
                opacity={SKILL_PILL_OPACITY}
                roughness={0.9}
                depthWrite={false}
              />
            </mesh>
            <Text
              renderOrder={PLAQUE_PILL_TEXT_RENDER_ORDER}
              position={[0, 0, 0.004]}
              fontSize={fontSize}
              letterSpacing={SKILL_LETTER_SPACING_EM}
              color={textColor}
              anchorX="center"
              anchorY="middle"
              font={fontFamily}
              material-toneMapped={false}
            >
              {chip.label}
            </Text>
          </group>
        );
      })}
    </>
  );
}

// --- Logo ------------------------------------------------------------------

// The logo sits directly on the plaque's own frosted glass. It used to carry
// a plate of its own behind it, painted in that same glass colour and
// opacity — which is exactly what made it read as a box: the plaque's panel
// is already there, so the plate was a second sheet of glass stacked on the
// first, denser than everything around it, and sitting in *front* of the
// shimmer plane so the travelling light swept past behind it and never lit
// it. The plate was pinned inside the panel's bounds in every case, so
// removing it costs nothing.
//
// Removing the plate was not the whole story though. The logo *quad* was
// still printing its own rectangle into the shimmer, for a second and
// separate reason: a transparent material still writes depth unless told
// not to, so this quad was stamping the depth buffer across its full
// rectangle — the fully-transparent pixels of the PNG included. Whenever it
// happened to draw before the shimmer (three sorts transparent objects by
// each object's *centre*, and this one sits far off to the right of the
// panel's centre, so which of the two goes first changes with the angle you
// stand at), the shimmer was then depth-rejected inside that rectangle and
// the band visibly travelled *around* an invisible box. Hence depthWrite off
// and an explicit renderOrder below, the same treatment the skill pills
// already needed for the same sorting reason.
function AboutLogo({
  url, shouldLoad, rightEdgeX, minLeftX, y, height: heightProp = PLAQUE_LOGO_HEIGHT_BASE,
}: {
  url: string;
  shouldLoad: boolean;
  /** Local X the logo is right-aligned to. */
  rightEdgeX: number;
  /** Local X the logo's left edge is not allowed to cross — it is scaled
   *  down to fit `[minLeftX, rightEdgeX]` rather than growing over the
   *  plaque's name / bio text. */
  minLeftX: number;
  /** Local Y of the logo centre. */
  y: number;
  height?: number;
}) {
  const [loaded, setLoaded] = useState<{ texture: THREE.Texture; aspect: number } | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(url)
      .then((result) => { if (!cancelled) setLoaded(result); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url, shouldLoad]);

  // Breathing room kept between the logo and the edge it is aligned to, so a
  // logo scaled right up to the cap doesn't touch the panel's border. Was the
  // padding around the old plate; the gap it created is still wanted.
  const edgePad = 0.12;
  // Site logos are wordmarks — assume wide before the texture resolves so the
  // logo doesn't visibly pop from a square when it loads.
  const rawWidth  = heightProp * (loaded?.aspect ?? 3);
  // Cap the logo to the right-hand band so Logo Size can't push it over the
  // plaque text.
  const maxWidth = Math.max(0.3, rightEdgeX - minLeftX);
  const fit      = Math.min(1, maxWidth / (rawWidth + edgePad));
  const width  = rawWidth * fit;
  const height = heightProp * fit;
  const centerX = rightEdgeX - edgePad * fit / 2 - width / 2;

  return (
    <group position={[centerX, y, 0.01]}>
      {/* renderOrder above the panel (−1), the shimmer (0) and the skill
          pills/text (1/2), so the logo is always painted last no matter
          which side of the plaque the visitor is standing on. */}
      <mesh renderOrder={PLAQUE_LOGO_RENDER_ORDER} key={loaded ? loaded.texture.uuid : "placeholder"}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={loaded?.texture}
          color={loaded ? "#ffffff" : "#d8d3c6"}
          transparent
          // The whole point: a transparent quad still writes depth by
          // default, and this one's clear pixels were carving the logo's
          // rectangle out of the shimmer behind it.
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// --- Editable banner (Certs heading / Calling Card title) -----------------
// Admin-editable text + font + colour + optional plate, stored per block as
// AboutLabelConfig JSON (see lib/museum/aboutRoomBlocks.ts) — the museum's
// take on the Freedom Wall event plaque.

function AboutBanner({
  label, position, letterSpacing = 0.18,
}: {
  label: Required<AboutLabelConfig>;
  /** Local position of the banner's centre. */
  position: [number, number, number];
  letterSpacing?: number;
}) {
  // The room-wide finish (edge, uploaded surface, glass, shimmer, brightness)
  // — see lib/museum/roomBanner.ts. Deliberately only the *finish*: this room's
  // headings have carried their own text, size, face and colour per block for
  // as long as the About blocks have existed (AboutLabelConfig), and those are
  // per-heading choices a shared row has no business overwriting. So the block
  // still says what it says and in what colour; the room says what it's made
  // of. Read from context rather than threaded through three unrelated
  // components that only pass it along.
  const roomBanner = useContext(AboutBannerStyleContext);
  const text = label.text.trim() || " ";
  // troika can't be measured before layout — size the plate from a glyph
  // estimate + padding, same trick as FreedomWallPlaque.
  const plateW = Math.max(0.8, text.length * label.fontSize * (0.6 + letterSpacing) + 0.6);
  const plateH = label.fontSize * 2.4;
  // The block's own plate colour and opacity win over the room's — see above.
  // backgroundOpacity 0 still means "no plate at all" (the Calling Card's
  // default), which is why the panel is skipped rather than drawn transparent:
  // an invisible plate would still cost its shimmer and its texture fetch.
  const panelStyle = useMemo(
    () => ({
      ...roomBanner,
      panelColor: label.backgroundColor,
      glassEnabled: true,
      glassOpacity: label.backgroundOpacity,
    }),
    [roomBanner, label.backgroundColor, label.backgroundOpacity]
  );

  return (
    <group position={position}>
      {label.backgroundOpacity > 0.001 && (
        <group position={[0, 0, -0.02]}>
          <BannerPanel width={plateW} height={plateH} style={panelStyle} />
        </group>
      )}
      <Text
        fontSize={label.fontSize}
        letterSpacing={letterSpacing}
        color={label.textColor}
        anchorX="center"
        anchorY="middle"
        font={label.fontFamily}
        material-toneMapped={false}
      >
        {text}
      </Text>
    </group>
  );
}

// --- Timeline & Gigs board -----------------------------------------------
// A framed "streets" map of the gigs, mounted on the wall. The next-event
// pin twinkles yellow (mirrors EventsMapLeaflet.makePinIcon). Walk up +
// [E] opens the full interactive events map — MuseumScene's GigsPanel.

const GIGS_MAP_W = 3.6;
const GIGS_MAP_H = 2.4;
// The caption strip under the map — the next event's name, then its date and
// venue. Both scale together off the block's `descriptionScale`, so the pair
// keeps reading as a heading and its subtitle at any size.
const GIGS_CAPTION_SIZE = 0.11;
const GIGS_SUBCAPTION_SIZE = 0.072;
const GIGS_CAPTION_PLATE_H = 0.36;
const GIGS_PH_LON = 121.774;   // Philippines centre — empty-state framing
const GIGS_PH_LAT = 12.8797;
// Pins. Two gigs in neighbouring towns land within a few millimetres of each
// other at this map scale, which drew one pin flat on top of another — the
// next event ended up *behind* a past one, which is precisely backwards. So
// pins closer than PIN_SPREAD_MIN are fanned onto rings around their true
// spot, nearest-first, the way a map's marker cluster spiderfies.
const GIG_PIN_SPREAD_MIN  = 0.15;   // centres closer than this count as overlapping
const GIG_PIN_SPREAD_STEP = 0.155;  // ring radius added per ring out
const GIG_PIN_SPREAD_SLOTS = 6;     // positions tried per ring before widening
// Base standoff off the map surface. Each pin is nudged further forward the
// lower it sits, so a nearer (lower) pin always occludes one behind it rather
// than z-fighting, and the next event gets a nudge of its own on top of that.
const GIG_PIN_Z         = 0.04;
const GIG_PIN_Z_PER_ROW = 0.004;
const GIG_PIN_Z_NEXT    = 0.03;

function formatGigDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function GigsBoard({
  gigs, label, shouldLoad, focusRef,
}: {
  gigs: MuseumAboutGig[];
  label: Required<AboutLabelConfig>;
  shouldLoad: boolean;
  focusRef: ReturnType<typeof useWallFocus>;
}) {
  const next = useMemo(
    () => gigs.find((g) => g.isNextEvent) ?? gigs[0] ?? null,
    [gigs]
  );
  const hasNext = Boolean(next?.isNextEvent);
  const { texture, project } = useStitchedMapTexture({
    centerLon: next?.longitude ?? GIGS_PH_LON,
    centerLat: next?.latitude ?? GIGS_PH_LAT,
    zoom: gigs.length === 0 ? 4 : hasNext ? 11 : 5,
    width: 1024,
    height: 683,
    style: "streets",
    shouldLoad,
  });

  const frameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (frameMatRef.current) frameMatRef.current.emissiveIntensity = ABOUT_GLOW_MAX * focusRef.current;
  });

  const captionDate = next ? formatGigDate(next.eventDate) : null;
  const descriptionScale = label.descriptionScale;

  // Every pin's final spot on the map. The next event is placed first so it
  // keeps its true coordinates and everything else fans around it — it's the
  // one pin a visitor is looking for, so it's the one that stays honest and,
  // via its z, on top.
  const pins = useMemo(() => {
    if (!texture) return [];
    const placed: { id: string; x: number; y: number; z: number; isNext: boolean }[] = [];
    const ordered = [...gigs].sort((a, b) => Number(b.isNextEvent) - Number(a.isNextEvent));

    for (const gig of ordered) {
      const uv = project(gig.longitude, gig.latitude);
      if (!uv) continue;
      const trueX = (uv[0] - 0.5) * GIGS_MAP_W;
      const trueY = (uv[1] - 0.5) * GIGS_MAP_H;
      let x = trueX;
      let y = trueY;

      // Walk outward ring by ring until this pin has a clear spot. Bounded:
      // past the last ring it just sits where it lands rather than drifting
      // any further from where the gig actually happened.
      const collides = () =>
        placed.some((p) => Math.hypot(p.x - x, p.y - y) < GIG_PIN_SPREAD_MIN);
      for (let slot = 0; slot < GIG_PIN_SPREAD_SLOTS * 3 && collides(); slot++) {
        const ring = Math.floor(slot / GIG_PIN_SPREAD_SLOTS) + 1;
        // Half-slot twist per ring so an outer ring's pins sit in the gaps of
        // the ring inside it rather than directly behind them.
        const angle =
          ((slot % GIG_PIN_SPREAD_SLOTS) / GIG_PIN_SPREAD_SLOTS + ring * 0.5) * Math.PI * 2;
        x = trueX + Math.cos(angle) * GIG_PIN_SPREAD_STEP * ring;
        y = trueY + Math.sin(angle) * GIG_PIN_SPREAD_STEP * ring;
      }

      placed.push({
        id: gig.id,
        x,
        y,
        z:
          GIG_PIN_Z +
          (GIGS_MAP_H / 2 - y) * GIG_PIN_Z_PER_ROW +
          (gig.isNextEvent ? GIG_PIN_Z_NEXT : 0),
        isNext: gig.isNextEvent,
      });
    }
    return placed;
  }, [gigs, texture, project]);

  return (
    <>
      <AboutBanner label={label} position={[0, GIGS_MAP_H / 2 + 0.34, 0]} />

      {/* Wooden frame */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[GIGS_MAP_W + 0.18, GIGS_MAP_H + 0.18, 0.05]} />
        <meshStandardMaterial
          ref={frameMatRef}
          color={CARD_BORDER_COLOR}
          roughness={0.55}
          emissive={PORTRAIT_EMISSIVE_COLOR}
          emissiveIntensity={0}
        />
      </mesh>

      {/* Map surface — the stitched tiles, or a plain panel while loading /
          if the tiles fail. */}
      <mesh>
        <planeGeometry args={[GIGS_MAP_W, GIGS_MAP_H]} />
        <meshStandardMaterial
          key={texture ? texture.uuid : "no-map"}
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#e9e5dc"}
          roughness={0.95}
          toneMapped={false}
        />
      </mesh>

      {/* Pins */}
      {pins.map((pin) => (
        <GigPin key={pin.id} x={pin.x} y={pin.y} z={pin.z} isNext={pin.isNext} />
      ))}

      {/* Caption strip */}
      {gigs.length === 0 ? (
        <Text position={[0, 0, 0.03]} fontSize={0.17} color="#6b6456" anchorX="center" anchorY="middle" font={FONT_REGULAR}>
          Gigs coming soon
        </Text>
      ) : next ? (
        <group position={[0, -(GIGS_MAP_H / 2 + 0.19 * descriptionScale), 0.02]}>
          {/* The plate grows with the text it backs, or a larger caption would
              hang off both ends of it. */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[GIGS_MAP_W, GIGS_CAPTION_PLATE_H * descriptionScale]} />
            <meshStandardMaterial color="#1b1712" transparent opacity={0.74} roughness={0.9} />
          </mesh>
          <Text
            position={[0, 0.04 * descriptionScale, 0]}
            fontSize={GIGS_CAPTION_SIZE * descriptionScale}
            maxWidth={GIGS_MAP_W - 0.3}
            color={hasNext ? "#FFE135" : "#f2ede0"}
            anchorX="center"
            anchorY="middle"
            font={FONT_BOLD}
          >
            {hasNext ? `NEXT · ${next.title}` : next.title}
          </Text>
          {(captionDate || next.venueName) && (
            <Text
              position={[0, -0.1 * descriptionScale, 0]}
              fontSize={GIGS_SUBCAPTION_SIZE * descriptionScale}
              color="#c7c1b0"
              anchorX="center"
              anchorY="middle"
              font={FONT_REGULAR}
            >
              {[captionDate, next.venueName].filter(Boolean).join("   ·   ")}
            </Text>
          )}
        </group>
      ) : null}
    </>
  );
}

/** A classic map-marker outline — a round head tapering to a point at the
 *  origin — as a flat 2D shape, matching the markers the events map itself
 *  uses. Drawn flat rather than modelled: a cone-and-ball read as a 3D bauble
 *  sitting on the map instead of a pin marking a place on it. */
function mapPinShape(radius: number): THREE.Shape {
  const headY = radius * 1.75;      // head centre, above the tip
  const theta = Math.PI * 0.3;      // where the tail leaves the head
  const tailX = Math.sin(theta) * radius;
  const tailY = headY - Math.cos(theta) * radius;
  const angle = Math.atan2(tailY - headY, tailX);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(radius * 0.42, headY * 0.34, tailX, tailY);
  // Over the top, from the right tail point round to the left one.
  shape.absarc(0, headY, radius, angle, Math.PI - angle, false);
  shape.quadraticCurveTo(-radius * 0.42, headY * 0.34, 0, 0);
  return shape;
}

const GIG_PIN_RADIUS = 0.058;
const GIG_PIN_HEAD_Y = GIG_PIN_RADIUS * 1.75;
const GIG_PIN_DOT_R  = GIG_PIN_RADIUS * 0.4;

// One gig's marker. Its tip sits on the gig's real coordinates and the head
// stands above it, the way a map pin is read. Unlit on purpose (basic, not
// standard, material): a marker is a symbol printed on the map, so it should
// read the same under every one of the room's lighting presets rather than
// dimming into the paper at night. A past gig is smaller so the next event
// wins the eye even where the two overlap.
function GigPin({ x, y, z, isNext }: { x: number; y: number; z: number; isNext: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pingRef = useRef<THREE.Mesh>(null);
  const pingMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const shape = useMemo(() => mapPinShape(GIG_PIN_RADIUS), []);

  useFrame(() => {
    if (!isNext) return;
    // 1.6s pulse — same cadence as EventsMapLeaflet's CSS pin.
    const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 1000) * ((Math.PI * 2) / 1.6));
    if (groupRef.current) groupRef.current.scale.setScalar(1 + pulse * 0.12);
    // A ring travelling out of the tip and fading as it goes — on its own
    // sawtooth, so it reads as a ripple leaving the pin rather than breathing
    // in and out with it.
    const ping = ((performance.now() / 1000) % 1.6) / 1.6;
    if (pingRef.current) pingRef.current.scale.setScalar(0.5 + ping * 2.4);
    if (pingMatRef.current) pingMatRef.current.opacity = 0.45 * (1 - ping);
  });

  const color = isNext ? "#FFC61A" : "#D8422F";
  return (
    <group position={[x, y, z]} scale={isNext ? 1 : 0.82}>
      {/* Contact shadow, flat on the map under the tip — without it the pin
          floats, since nothing else here casts a shadow onto the texture. */}
      <mesh position={[0, 0, -0.008]}>
        <circleGeometry args={[GIG_PIN_RADIUS * 0.62, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {isNext && (
        <mesh ref={pingRef} position={[0, 0, -0.006]}>
          <ringGeometry args={[GIG_PIN_RADIUS * 0.85, GIG_PIN_RADIUS, 28]} />
          <meshBasicMaterial
            ref={pingMatRef}
            color={color}
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
      )}

      <group ref={groupRef}>
        <mesh>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        {/* The marker's hole, as a pale disc rather than a real hole — the map
            behind it is busy, and a cut-out fills with street detail instead
            of reading as part of the pin. */}
        <mesh position={[0, GIG_PIN_HEAD_Y, 0.002]}>
          <circleGeometry args={[GIG_PIN_DOT_R, 20]} />
          <meshBasicMaterial color="#fffdf7" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

// --- Portrait slideshow ----------------------------------------------------

function applyCoverUV(texture: THREE.Texture, imageAspect: number) {
  if (imageAspect > PORTRAIT_ASPECT) {
    const scale = PORTRAIT_ASPECT / imageAspect;
    texture.repeat.set(scale, 1);
    texture.offset.set((1 - scale) / 2, 0);
  } else {
    const scale = imageAspect / PORTRAIT_ASPECT;
    texture.repeat.set(1, scale);
    texture.offset.set(0, (1 - scale) / 2);
  }
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
}

function PortraitSlideshow({
  images, shouldLoad, focusRef,
}: {
  images: string[];
  shouldLoad: boolean;
  focusRef: RefObject<number>;
}) {
  const loadedRef = useRef<(THREE.Texture | null)[]>(images.map(() => null));

  useEffect(() => {
    loadedRef.current = images.map(() => null);
    if (!shouldLoad || images.length === 0) return;
    let cancelled = false;
    images.forEach((url, i) => {
      loadDownscaledTexture(url)
        .then((loaded) => {
          if (cancelled) return;
          applyCoverUV(loaded.texture, loaded.aspect);
          loadedRef.current[i] = loaded.texture;
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [images, shouldLoad]);

  const matARef     = useRef<THREE.MeshStandardMaterial>(null);
  const matBRef     = useRef<THREE.MeshStandardMaterial>(null);
  const groupRef    = useRef<THREE.Group>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const slotIndex   = useRef({ a: 0, b: 0 });
  const activeSlot  = useRef<"a" | "b">("a");
  const currentIndex = useRef(0);
  const fadeStart   = useRef(performance.now() - PORTRAIT_FADE_MS);
  const idleRef     = useRef(true);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      currentIndex.current = (currentIndex.current + 1) % images.length;
      const newActive = activeSlot.current === "a" ? "b" : "a";
      activeSlot.current = newActive;
      slotIndex.current[newActive] = currentIndex.current;
      fadeStart.current = performance.now();
    }, PORTRAIT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length]);

  useFrame(() => {
    const a = matARef.current;
    const b = matBRef.current;
    if (a) {
      const texA = loadedRef.current[slotIndex.current.a];
      if (texA && a.map !== texA) { a.map = texA; a.color.set("#ffffff"); a.needsUpdate = true; }
    }
    if (b) {
      const texB = loadedRef.current[slotIndex.current.b];
      if (texB && b.map !== texB) { b.map = texB; b.color.set("#ffffff"); b.needsUpdate = true; }
    }
    const t     = THREE.MathUtils.clamp((performance.now() - fadeStart.current) / PORTRAIT_FADE_MS, 0, 1);
    const eased = t * t * (3 - 2 * t);
    if (a) a.opacity = activeSlot.current === "a" ? eased : 1 - eased;
    if (b) b.opacity = activeSlot.current === "b" ? eased : 1 - eased;

    const focus  = focusRef.current;
    const isIdle = focus < WALL_FOCUS_EPSILON && idleRef.current;
    if (isIdle) return;
    idleRef.current = focus < WALL_FOCUS_EPSILON;

    if (groupRef.current)
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(1, PORTRAIT_SCALE_ACTIVE, focus));
    if (frameMatRef.current)
      frameMatRef.current.emissiveIntensity = PORTRAIT_EMISSIVE_MAX * focus;
  });

  return (
    <group>
      <group ref={groupRef}>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[PORTRAIT_WIDTH + 0.16, PORTRAIT_HEIGHT + 0.16, 0.04]} />
          <meshStandardMaterial
            ref={frameMatRef}
            color="#5a4632"
            roughness={0.55}
            emissive={PORTRAIT_EMISSIVE_COLOR}
            emissiveIntensity={0}
          />
        </mesh>
        <mesh>
          <planeGeometry args={[PORTRAIT_WIDTH, PORTRAIT_HEIGHT]} />
          <meshStandardMaterial ref={matARef} color="#d8d3c6" roughness={0.9} toneMapped={false} side={THREE.DoubleSide} transparent opacity={1} />
        </mesh>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[PORTRAIT_WIDTH, PORTRAIT_HEIGHT]} />
          <meshStandardMaterial ref={matBRef} color="#d8d3c6" roughness={0.9} toneMapped={false} side={THREE.DoubleSide} transparent opacity={0} />
        </mesh>
      </group>
    </group>
  );
}

// --- Certificate thumbnails -----------------------------------------------

const CERT_TEXT_MAX_CHARS = 70;
function trimCertText(text: string) {
  return text.length > CERT_TEXT_MAX_CHARS
    ? `${text.slice(0, CERT_TEXT_MAX_CHARS - 3).trimEnd()}…`
    : text;
}

function CertificateThumb({
  cert, alongWall, hangHeight = 0, scale = 1, shouldLoad, wallFocusRef, index, total,
}: {
  cert: MuseumAboutCertificate;
  /** Local X offset along the certs group's wall — the group's own wall
   *  rotation turns this into the along-wall axis, so every thumb inherits
   *  the wall facing and sits flush (no per-thumb rotation). */
  alongWall: number;
  /** Local Y offset from the strip's own hang height — this certificate
   *  alone, hung higher or lower than its neighbours. */
  hangHeight?: number;
  /** This certificate's own size multiplier, on top of the strip's Resize.
   *  Applied to the outer group so the walk-up pop/lift (which is written in
   *  the inner group's local space) scales with the thumb instead of reading
   *  as a lurch on a big one and a twitch on a small one. */
  scale?: number;
  shouldLoad: boolean;
  wallFocusRef: RefObject<number>;
  index: number;
  total: number;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!cert.imageUrl || !shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(cert.imageUrl)
      .then((loaded) => { if (!cancelled) setTexture(loaded.texture); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cert.imageUrl, shouldLoad]);

  const popGroupRef   = useRef<THREE.Group>(null);
  const backingMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const localFocus    = useRef(0);
  const idleRef       = useRef(true);
  const stagger = total > 1 ? (index / total) * CERT_STAGGER_SPAN : 0;

  useFrame((_, delta) => {
    const wallFocus = wallFocusRef.current;
    const isIdle = wallFocus < WALL_FOCUS_EPSILON && idleRef.current;
    if (isIdle) return;
    idleRef.current = wallFocus < WALL_FOCUS_EPSILON;
    const delayedTarget = THREE.MathUtils.clamp(
      (wallFocus - stagger) / Math.max(0.0001, 1 - stagger), 0, 1
    );
    localFocus.current = THREE.MathUtils.damp(localFocus.current, delayedTarget, 8, delta);
    if (popGroupRef.current) {
      popGroupRef.current.position.z = CERT_POP_DISTANCE * localFocus.current;
      popGroupRef.current.position.y = CERT_LIFT_DISTANCE * localFocus.current;
    }
    if (backingMatRef.current)
      backingMatRef.current.emissiveIntensity = CERT_GLOW_INTENSITY * localFocus.current;
  });

  const hasImage = Boolean(cert.imageUrl);

  return (
    <group position={[alongWall, hangHeight, 0]} scale={scale}>
      <group ref={popGroupRef}>
        <mesh position={[0, 0, -0.025]}>
          <boxGeometry args={[CERT_SIZE + 0.1, CERT_SIZE + 0.1, 0.03]} />
          <meshStandardMaterial
            ref={backingMatRef}
            color={hasImage ? "#3a3126" : PLAQUE_BG_COLOR}
            roughness={0.6}
            emissive={CERT_GLOW_COLOR}
            emissiveIntensity={0}
          />
        </mesh>
        {hasImage ? (
          <mesh>
            <planeGeometry args={[CERT_SIZE, CERT_SIZE]} />
            <meshStandardMaterial
              key={texture ? texture.uuid : "placeholder"}
              map={texture}
              color={texture ? "#ffffff" : "#d8d3c6"}
              roughness={texture ? 0.9 : 1}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <>
            <Text position={[0, 0.06, 0.001]} fontSize={0.1} maxWidth={CERT_SIZE - 0.18}
              lineHeight={1.25} textAlign="center" color="#ddd8c9" anchorX="center" anchorY="bottom" font={FONT_BOLD}>
              {trimCertText(cert.title)}
            </Text>
            {cert.issuer && (
              <Text position={[0, 0.0, 0.001]} fontSize={0.075} maxWidth={CERT_SIZE - 0.18}
                textAlign="center" color="#8fd6b4" anchorX="center" anchorY="top" font={FONT_REGULAR}>
                {trimCertText(cert.issuer)}
              </Text>
            )}
          </>
        )}
      </group>
    </group>
  );
}

// --- Calling Card (flip-on-proximity) -------------------------------------

function CallingCardDisplay({
  front, back, shouldLoad, focusRef, position, rotationY, scale = 1, label,
}: {
  front: string;
  back: string | null;
  shouldLoad: boolean;
  focusRef: ReturnType<typeof useWallFocus>;
  /** Room-local [x,y,z] — wall anchor + admin Hang Width/Height (see
   * lib/museum/aboutRoomBlocks.ts's getAboutBlockAnchor). */
  position: [number, number, number];
  /** Faces inward from whichever wall it's mounted on — see wallGeometry
   * above. */
  rotationY: number;
  /** Admin "Resize". */
  scale?: number;
  /** Admin-editable title (text / font / colour / plate). */
  label: Required<AboutLabelConfig>;
}) {
  const [frontTex, setFrontTex] = useState<THREE.Texture | null>(null);
  const [backTex,  setBackTex]  = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(front)
      .then((r) => { if (!cancelled) setFrontTex(r.texture); })
      .catch(() => {});
    if (back) {
      loadDownscaledTexture(back)
        .then((r) => { if (!cancelled) setBackTex(r.texture); })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [front, back, shouldLoad]);

  const groupRef    = useRef<THREE.Group>(null);
  const frameMatRef = useRef<THREE.MeshStandardMaterial>(null);
  // Flip state — driven imperatively in useFrame so there's no per-frame
  // React setState. `flipAngle` is the whole card's current Y rotation
  // (0 = front, π = back); `flipped` is the latched target with hysteresis.
  const flipAngle = useRef(0);
  const flipped   = useRef(false);
  const idleRef   = useRef(true);

  // Auto-flip on proximity: walk up → the whole card turns to show the
  // back; walk away → it turns back to the front. Latched with hysteresis
  // so it commits to a full turn instead of tracking focus and stalling
  // half-folded, and it always eases all the way to its target (never
  // frozen mid-turn by the idle check).
  useFrame((_, delta) => {
    const focus = focusRef.current;

    if (back) {
      if (!flipped.current && focus > 0.55) flipped.current = true;
      else if (flipped.current && focus < 0.2) flipped.current = false;
    }
    const target = back && flipped.current ? Math.PI : 0;
    const settled = Math.abs(flipAngle.current - target) < 0.002;

    // Skip the frame only when there's genuinely nothing to do — the turn
    // is finished AND the player isn't near enough for the focus zoom/glow.
    if (settled && focus < WALL_FOCUS_EPSILON) {
      if (idleRef.current) return;
      idleRef.current = true;
    } else {
      idleRef.current = false;
    }

    if (settled) {
      flipAngle.current = target;
    } else {
      const k = Math.min(delta * (1000 / CARD_FLIP_DURATION_MS), 1);
      flipAngle.current += (target - flipAngle.current) * k;
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = flipAngle.current;
      groupRef.current.scale.setScalar(THREE.MathUtils.lerp(1, 1.04, focus));
    }
    if (frameMatRef.current)
      frameMatRef.current.emissiveIntensity = CARD_EMISSIVE_MAX * focus;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      {/* The whole card turns as one — frame + both faces in the flip
          group, so nothing shows through edge-on mid-turn. The frame box
          is symmetric front↔back so a 180° turn looks unchanged. */}
      <group ref={groupRef}>
        <mesh>
          <boxGeometry args={[CARD_WIDTH + 0.16, CARD_HEIGHT + 0.16, 0.05]} />
          <meshStandardMaterial
            ref={frameMatRef}
            color={CARD_BORDER_COLOR}
            roughness={0.55}
            emissive={PORTRAIT_EMISSIVE_COLOR}
            emissiveIntensity={0}
          />
        </mesh>
        {/* Front face */}
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
          <meshStandardMaterial
            key={frontTex ? frontTex.uuid : "front-ph"}
            map={frontTex}
            color={frontTex ? "#ffffff" : "#d8d3c6"}
            roughness={0.9}
            toneMapped={false}
            side={THREE.FrontSide}
          />
        </mesh>
        {/* Back face */}
        {back && (
          <mesh position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[CARD_WIDTH, CARD_HEIGHT]} />
            <meshStandardMaterial
              key={backTex ? backTex.uuid : "back-ph"}
              map={backTex}
              color={backTex ? "#ffffff" : "#d8d3c6"}
              roughness={0.9}
              toneMapped={false}
              side={THREE.FrontSide}
            />
          </mesh>
        )}
      </group>

      {/* Admin-editable title (text / font / colour / plate) */}
      <AboutBanner
        label={label}
        position={[0, -(CARD_HEIGHT / 2 + 0.14 + label.fontSize), 0.01]}
        letterSpacing={0.15}
      />
    </group>
  );
}
