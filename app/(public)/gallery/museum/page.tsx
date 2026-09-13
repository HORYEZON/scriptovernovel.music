// app/(public)/gallery/museum/page.tsx
//
// Public entry point for the Digital Museum. Server-rendered: one Prisma
// query on load fetches the museum + every enabled room's already-filtered
// (published, non-deleted) artworks, all in one shot — small expected
// dataset (see the V2 plan's §18 note), so switching rooms client-side
// needs zero further requests, same as V1's "walking around makes zero
// further requests" property.
import Link from "next/link";
import { ArrowLeft, Landmark } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MuseumRoomPublic, MuseumChaseCompanion, MuseumAchievementPublic, FreedomWallNotePublic } from "@/types";
import {
  sanitizeSplashEffect,
  sanitizeSplashStyle,
  sanitizeSplashBgColor,
  sanitizeSplashTaglineFontSize,
  sanitizeSplashTaglineFontFamily,
  clampSplashSpeed,
} from "@/lib/museum-splash";
import { parseMinimapHudConfig } from "@/lib/museum/minimapHud";
import {
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  DEFAULT_CEILING_COLOR,
  ABOUT_ROOM_ID,
  getRoomSize,
} from "./components/roomConstants";
import { MuseumClient } from "./MuseumClient";
import { ensureAboutRoom, ensureAboutContactDesk } from "@/lib/museum/aboutRoom";
import { ensureWallClock, ensureRespawnRoomWallClock } from "@/lib/museum/wallClock";
import { ensureFreedomWallRoom, ensureFreedomWallBanner } from "@/lib/museum/freedomWallRoom";
import { FREEDOM_WALL_BANNER_KIND } from "@/lib/museum/freedomWallBanner";
import { ensureStairsRoom } from "@/lib/museum/stairsRoom";
import { ensureServicesRoom, syncServicesRoomProducts } from "@/lib/museum/servicesRoom";
import { ensureStoriesRoom, syncStoriesRoomStories, ensureStoryPodiumModel } from "@/lib/museum/storiesRoom";
import { STORY_PODIUM_MODEL_KIND } from "@/lib/museum/storyPodiumModel";
import { ensureArcadeRoom, syncArcadeRoomGames, ensureArcadeConfig } from "@/lib/museum/arcadeRoom";
import { ensureCosplayRoom, syncCosplayRoomEntries, ensureCosplayStandeeModel } from "@/lib/museum/cosplayRoom";
import { ensureRoomBanner } from "@/lib/museum/roomBannerProvision";
import { ROOM_BANNER_KIND } from "@/lib/museum/roomBanner";
import { COSPLAY_STANDEE_MODEL_KIND, parseCosplayStandeeConfig } from "@/lib/museum/cosplayStandee";
import { DIVIDER_KIND } from "@/lib/museum/wallDivider";
import { BANNER_KIND } from "@/lib/museum/sceneBanner";
import { parseVisionFilterConfig, resolveVisionFilters } from "@/lib/museum/visionFilters";
import { ARCADE_CONFIG_KIND, parseArcadeConfig, normalizeArcadeMode, type ArcadeDisplayMode } from "@/lib/museum/arcadeConfig";
import { buildPublicGames } from "@/lib/minigames/server";
import { readPlayerId } from "@/lib/minigames/player";
import type { PublicGame } from "@/lib/minigames/types";
import { getAboutData } from "@/lib/museum/getAboutData";
import {
  ABOUT_BLOCK_KINDS,
  ABOUT_PLAQUE_KIND,
  ABOUT_CERTS_KIND,
  ABOUT_CARD_KIND,
  ABOUT_GIGS_KIND,
  ABOUT_CLOCK_KIND,
  type AboutBlockKind,
  type AboutBlockOffsets,
  type AboutBlockMeta,
  rotYToWall,
  DEFAULT_BLOCK_WALL,
  parsePlaqueConfig,
  parseAboutLabelConfig,
  parseContactDeskConfig,
  parseWallClockConfig,
  parseCertPlacements,
  defaultAboutLabelConfig,
} from "@/lib/museum/aboutRoomBlocks";

export const dynamic = "force-dynamic";

// A room's own hung pieces (MuseumRoomArtwork).
const ARTWORK_SELECT = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  videoUrl: true,
  slug: true,
  medium: true,
  dimensions: true,
  year: true,
  status: true,
  // Variants come along because the Services Room has to state a price
  // before the visitor has picked a size — see lib/utils' formatPriceRange.
  // Same ordering as /shop's own picker so the two never disagree about
  // which size is "first".
  product: {
    select: {
      price: true,
      variants: {
        orderBy: { sortOrder: "asc" as const },
        select: { id: true, label: true, price: true, stock: true },
      },
    },
  },
} as const;

// Dynamic (not the static `export const metadata` this replaced) — the tab
// title reflects the admin's Museum Title (General Settings) when set, so
// "ScriptOverNovel Digital Museum" shows up instead of the generic default once
// they've bothered to type one.
export async function generateMetadata(): Promise<Metadata> {
  const museum = await prisma.digitalMuseum
    .findUnique({ where: { id: "singleton" }, select: { title: true, description: true } })
    .catch(() => null);
  return {
    title: museum?.title || "Digital Museum",
    description:
      museum?.description || "Step inside a free-roaming 3D gallery room and explore the collection.",
  };
}

async function getMuseum() {
  return prisma.digitalMuseum.findUnique({
    where: { id: "singleton" },
    select: {
      enabled: true,
      title: true,
      description: true,
      splashEnabled: true,
      splashEffect: true,
      splashSpeedMs: true,
      splashBgColor: true,
      splashTaglineFontSize: true,
      splashTaglineFontFamily: true,
      splashStyle: true,
      splashStyleMobile: true,
      aboutSplashEnabled: true,
      aboutWallColor: true,
      aboutFloorColor: true,
      aboutCeilingColor: true,
      aboutWallTexture: true,
      aboutFloorTexture: true,
      aboutCeilingTexture: true,
      aboutSplashIcon: true,
      aboutSplashTitle: true,
      aboutEnabled: true,
      achievementsEnabled: true,
      achievementsHudEnabled: true,
      minimapConfig: true,
      museumMusicUrl: true,
      museumMusicEnabled: true,
      museumMusicVolume: true,
      museumBrightnessLight: true,
      museumBrightnessDark: true,
      visionFiltersEnabled: true,
      visionFilterConfig: true,
      rooms: {
        // ABOUT and FREEDOM_WALL are excluded here — both are provisioned
        // separately below (ensureAboutRoom / ensureFreedomWallRoom) and
        // inserted at their fixed corridor positions after the curated list.
        //
        // SERVICES is excluded for a different reason: it *does* belong among
        // these rooms, at its own displayOrder (see lib/museum/servicesRoom.ts),
        // but its frames mirror the shop listing, which doesn't filter on
        // `artwork.published` the way ROOM_CONTENT_SELECT's artworks filter
        // below does. Rather than loosen that filter for every room, it's
        // read through its own select and merged back into this list by
        // displayOrder further down.
        // STORIES and ARCADE are excluded for the same reason as SERVICES:
        // each takes an ordinary slot in this list, but its podium/cabinet
        // rows have to be reconciled against the published Stories library
        // (resp. the playable mini games) *before* they're read, and that
        // sync can't run inside this query. Both are fetched separately below
        // and merged back in by displayOrder — and leaving either one in here
        // would put it in the corridor twice, once from this query and again
        // from that merge.
        // COSPLAY is excluded for the same reason as STORIES/ARCADE — its
        // standee rows are reconciled against the published Cosplays before
        // they're read, and it's merged back in by displayOrder below.
        where: { enabled: true, deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS", "SERVICES", "STORIES", "ARCADE", "COSPLAY"] } },
        orderBy: { displayOrder: "asc" },
        select: ROOM_CONTENT_SELECT,
      },
    },
  });
}

// The museum's trimmed story payload — see MuseumStory in types/index.ts.
// Pages travel with the room so pressing [E] costs no request, the same call
// every other museum payload makes. If a large library ever makes this heavy,
// the fallback is covers + page counts here and a lazy fetch on open (noted
// in docs/StoriesRoom_Spec.md).
//
// Declared above ROOM_CONTENT_SELECT because that object's initializer reads
// it — a module-level const referenced before its own initializer has run is
// a TDZ error at import time, not a hoisted undefined.
const STORY_SELECT = {
  id: true,
  title: true,
  description: true,
  type: true,
  coverImageUrl: true,
  author: true,
  year: true,
  slug: true,
  continueEnabled: true,
  continueUrl: true,
  continueLabel: true,
  pages: {
    orderBy: { pageNumber: "asc" as const },
    select: { id: true, imageUrl: true, pageNumber: true, caption: true },
  },
} as const;

// The museum's trimmed cosplay payload — see MuseumCosplay in types/index.ts.
// Both photo URLs travel with the room so walking up to a standee and pressing
// [E] costs no request, the same call every other museum payload makes.
//
// Declared above ROOM_CONTENT_SELECT for the same reason STORY_SELECT is: a
// module-level const referenced before its own initializer has run is a TDZ
// error at import time, not a hoisted undefined.
const COSPLAY_SELECT = {
  id: true,
  title: true,
  description: true,
  character: true,
  series: true,
  standeeImageUrl: true,
  backdropImageUrl: true,
  cosplayer: true,
  photographer: true,
  year: true,
  event: true,
} as const;

// Shared between the curated rooms query above and the About room's own
// lookup below — every room (curated or the About capstone) needs the
// exact same shape merged into a MuseumRoomPublic.
const ROOM_CONTENT_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  roomType: true,
  // Not part of MuseumRoomPublic (mapRoomContent drops it) — read only so
  // the Services Room can be merged back into the curated list at the right
  // spot below, since it's fetched separately from the rooms query.
  displayOrder: true,
  isEntryRoom: true,
  // 0 = ground floor, 1 = second floor — see MuseumRoom.floor's doc comment
  // and docs/SecondFloorStairs_Spec.md.
  floor: true,
  wallColor: true,
  floorColor: true,
  ceilingColor: true,
  wallTexture: true,
  floorTexture: true,
  ceilingTexture: true,
  splashIcon: true,
  splashTitle: true,
  splashEnabled: true,
  // Every placed custom decorative object (Museum Scene Editor,
  // Docs/MuseumSceneEditor_Spec.md) — filtered by `kind` in the mapping
  // below.
  sceneObjects: {
    // `hidden` is the admin's "Hide from Museum" switch — the row keeps its
    // model, wording and placement, it just isn't in the room visitors walk
    // into. Filtered here, at the one read the whole public payload is built
    // from, so a hidden object is absent rather than merely undrawn: no
    // minimap dot, no collision footprint, no [E] prompt at an empty patch of
    // floor. See MuseumSceneObject.hidden in the schema.
    where: { deletedAt: null, hidden: false },
    orderBy: { createdAt: "asc" as const },
    select: { id: true, kind: true, modelUrl: true, positionX: true, positionY: true, positionZ: true, rotationY: true, scale: true, solid: true, colliderRadius: true, colliderOffsetX: true, colliderOffsetZ: true, colliderHeight: true, colliderBaseY: true },
  },
  artworks: {
    orderBy: { displayOrder: "asc" as const },
    where: { artwork: { published: true, deletedAt: null } },
    select: {
      positionX: true,
      positionY: true,
      positionZ: true,
      rotationY: true,
      scale: true,
      artwork: { select: ARTWORK_SELECT },
    },
  },
  // Podiums — only ever non-empty on the STORIES room, an empty relation for
  // every other room, so this lives in the shared select rather than needing
  // a variant the way the Services Room's looser artwork filter does. The
  // published/deleted filter is belt-and-braces: syncStoriesRoomStories has
  // already removed any row that stopped qualifying, but a story unpublished
  // between the sync and this read shouldn't slip through.
  stories: {
    orderBy: { displayOrder: "asc" as const },
    where: { story: { published: true, deletedAt: null } },
    select: {
      id: true,
      displayOrder: true,
      positionX: true,
      positionY: true,
      positionZ: true,
      rotationY: true,
      scale: true,
      story: { select: STORY_SELECT },
    },
  },
  // Arcade cabinets — only ever non-empty on the ARCADE room, an empty
  // relation everywhere else (same as `stories`). Each row's `game` payload
  // is joined in from buildPublicGames() below rather than read here.
  miniGames: {
    orderBy: { displayOrder: "asc" as const },
    select: {
      id: true,
      displayOrder: true,
      displayMode: true,
      positionX: true,
      positionY: true,
      positionZ: true,
      rotationY: true,
      scale: true,
      game: { select: { type: true } },
    },
  },
  // Cosplay standees — only ever non-empty on the COSPLAY room, an empty
  // relation everywhere else (same as `stories`). The published/deleted filter
  // is belt-and-braces: syncCosplayRoomEntries has already removed any row that
  // stopped qualifying, but a cosplay unpublished between the sync and this read
  // shouldn't slip through.
  cosplays: {
    orderBy: { displayOrder: "asc" as const },
    where: { cosplay: { published: true, deletedAt: null } },
    select: {
      id: true,
      displayOrder: true,
      positionX: true,
      positionY: true,
      positionZ: true,
      rotationY: true,
      scale: true,
      lightsEnabled: true,
      cosplay: { select: COSPLAY_SELECT },
    },
  },
} as const;

type RoomWithContent = Prisma.MuseumRoomGetPayload<{ select: typeof ROOM_CONTENT_SELECT }>;

// The Services Room reads through this instead — identical shape (so
// mapRoomContent takes it unchanged), one different artwork filter. Its
// frames mirror the shop, and /shop only excludes soft-deleted artworks, so
// filtering on `published` here would silently drop a listed product whose
// artwork was never published to the public gallery. Nothing else needs the
// looser filter, which is why it isn't ROOM_CONTENT_SELECT's own.
const SERVICES_ROOM_CONTENT_SELECT = {
  ...ROOM_CONTENT_SELECT,
  artworks: {
    ...ROOM_CONTENT_SELECT.artworks,
    where: { artwork: { deletedAt: null } },
  },
} as const;

// Shared room → MuseumRoomPublic mapping — used for every curated room and
// again for the About room below, so both stay in lockstep (e.g. neither
// forgets to split sceneObjects apart by kind) without duplicating the
// logic itself.
function mapRoomContent(
  room: RoomWithContent,
  // Only passed for the ARCADE room — maps a MiniGameType to its public
  // payload (built once from buildPublicGames). A cabinet row whose game type
  // has no playable payload is dropped rather than rendered blank.
  gamesByType?: Map<string, PublicGame>
) {
  return {
    id: room.id,
    name: room.name,
    slug: room.slug,
    description: room.description,
    roomType: room.roomType,
    isEntryRoom: room.isEntryRoom,
    floor: room.floor,
    wallColor: room.wallColor,
    floorColor: room.floorColor,
    ceilingColor: room.ceilingColor,
    wallTexture: room.wallTexture,
    floorTexture: room.floorTexture,
    ceilingTexture: room.ceilingTexture,
    splashIcon: room.splashIcon,
    splashTitle: room.splashTitle,
    splashEnabled: room.splashEnabled,
    customObjects: room.sceneObjects
      .filter(
        (o) =>
          (o.kind === "custom" ||
            o.kind === "text" ||
            // A partition wall placed from the Scene Editor — a real
            // placement like a prop, drawn from its own config JSON rather
            // than a model (see lib/museum/wallDivider.ts).
            o.kind === DIVIDER_KIND ||
            // An admin-placed titled plaque — like the divider, a real
            // placement drawn from its own config JSON rather than a model
            // (see lib/museum/sceneBanner.ts).
            o.kind === BANNER_KIND ||
            o.kind === FREEDOM_WALL_BANNER_KIND ||
            // The wall clock in the visitor's respawn room (see
            // lib/museum/wallClock.ts), which travels as an ordinary placed
            // object like every other room fixture here. The About room's
            // own clock is deliberately excluded: that room draws its
            // contents itself (AboutRoomContents), and it already receives
            // the same row through `aboutClock` below — letting it through
            // here as well would hang two clocks on the same nail.
            (o.kind === ABOUT_CLOCK_KIND && room.roomType !== "ABOUT") ||
            // Config, not a placement — carried through so MuseumScene can
            // read the pedestal model, and skipped there when building the
            // room's decorative objects (see storyPodiumModel.ts).
            o.kind === STORY_PODIUM_MODEL_KIND ||
            // Same again for the Cosplay Room's standee/backdrop config (see
            // cosplayStandee.ts) — config, not a placement.
            o.kind === COSPLAY_STANDEE_MODEL_KIND ||
            // And for the room-wide plaque style every label in the room reads
            // (see roomBanner.ts). Config, not a placement, and skipped again
            // in MuseumScene when it builds the room's decorative objects —
            // which is exactly where this row was *expected* to arrive. Left
            // off this list, every banner style an admin saved was provisioned,
            // edited, previewed in the Scene Editor and then silently dropped
            // on the way to the museum, which parsed a missing row as the
            // defaults: the panel texture, the glass and its shimmer never
            // reached a visitor.
            o.kind === ROOM_BANNER_KIND) && o.modelUrl
      )
      .map((o) => ({
        id: o.id,
        kind: o.kind,
        modelUrl: o.modelUrl as string,
        positionX: o.positionX,
        positionY: o.positionY,
        positionZ: o.positionZ,
        rotationY: o.rotationY,
        scale: o.scale,
        solid: o.solid,
        colliderRadius: o.colliderRadius,
        colliderOffsetX: o.colliderOffsetX,
        colliderOffsetZ: o.colliderOffsetZ,
        colliderHeight: o.colliderHeight,
        colliderBaseY: o.colliderBaseY,
      })),
    // Only artworks an admin has actually customized get an entry —
    // everything else falls through to the auto-computed layout, same
    // "override else fall back" convention as splashTitle above.
    artworkPlacementOverrides: Object.fromEntries(
      room.artworks
        .filter((entry) => entry.positionX !== null || entry.scale !== null)
        .map((entry) => [
          entry.artwork.id,
          {
            position:
              entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null
                ? { x: entry.positionX, y: entry.positionY, z: entry.positionZ, rotationY: entry.rotationY }
                : null,
            scale: entry.scale,
          },
        ])
    ),
    artworks: room.artworks.map((entry) => entry.artwork),
    // Podiums. Unlike artworks, the placement override rides on the entry
    // itself rather than a separate keyed record — a podium's position is the
    // only thing the editor changes about it, so there's nothing to look up.
    stories: room.stories.map((entry) => ({
      entryId: entry.id,
      displayOrder: entry.displayOrder,
      positionX: entry.positionX,
      positionY: entry.positionY,
      positionZ: entry.positionZ,
      rotationY: entry.rotationY,
      scale: entry.scale,
      story: entry.story,
    })),
    // Arcade cabinets. Same "placement rides on the entry" shape as stories;
    // the public game payload is joined in from gamesByType.
    miniGames: room.miniGames.flatMap((entry) => {
      const game = gamesByType?.get(entry.game.type);
      if (!game) return [];
      return [
        {
          entryId: entry.id,
          displayOrder: entry.displayOrder,
          displayMode: normalizeArcadeMode(entry.displayMode),
          positionX: entry.positionX,
          positionY: entry.positionY,
          positionZ: entry.positionZ,
          rotationY: entry.rotationY,
          scale: entry.scale,
          game,
        },
      ];
    }),
    // Cosplay standees. Same "placement rides on the entry" shape as stories —
    // and one entry is the whole pair, standee plus the photo behind it.
    cosplays: room.cosplays.map((entry) => ({
      entryId: entry.id,
      displayOrder: entry.displayOrder,
      positionX: entry.positionX,
      positionY: entry.positionY,
      positionZ: entry.positionZ,
      rotationY: entry.rotationY,
      scale: entry.scale,
      lightsEnabled: entry.lightsEnabled,
      cosplay: entry.cosplay,
    })),
  };
}

function MuseumMessage({ body }: { body: string }) {
  return (
    <div className="pt-32 pb-24 section-padding">
      <div className="max-w-md mx-auto text-center bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-10">
        <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-4">
          <Landmark size={28} />
        </div>
        <h1 className="font-grotesk font-bold text-2xl uppercase tracking-widest text-white mb-3">
          Digital Museum
        </h1>
        <p className="font-body text-sm text-white/60 mb-8">{body}</p>
        {/* "/" not "/gallery" — see MuseumClient's Back link for why. */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Gallery
        </Link>
      </div>
    </div>
  );
}

export default async function DigitalMuseumPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?room=freedom-wall | about | services | stories | arcade | cosplay —
  // deep-link straight into a specific room (GalleryClient's "Inside the
  // Museum" dropdown, the admin "Go to" menus). Forwarded to MuseumClient,
  // which fires a travelRequest on mount.
  const resolvedParams = await searchParams;
  const roomParam = typeof resolvedParams?.room === "string" ? resolvedParams.room : null;
  const deepLinkRoom = (["freedom-wall", "about", "services", "stories", "arcade", "cosplay"] as const).find(
    (slug) => slug === roomParam
  ) ?? null;
  // ?roomId=<MuseumRoom.id> — the same deep link by id rather than by slug,
  // which is the only way to name a *curated* room (Collections, ScriptOverNovel
  // Room): those are admin-created rows, so there is no fixed slug for them.
  // The Museum Scene Editor's "Go to" uses it to open the room being laid out
  // (see lib/museum/roomStatus.ts). Not validated here — MuseumClient only
  // travels to a room it actually rendered, so an id for a room that is off,
  // deleted or invented simply does nothing.
  const deepLinkRoomId =
    typeof resolvedParams?.roomId === "string" ? resolvedParams.roomId : null;
  const [museum, aboutData, achievementRows, chaseCompanionRows] =
    await Promise.all([
      getMuseum().catch(() => null),
      getAboutData(),
      prisma.museumAchievement
        .findMany({
          where: { enabled: true },
          orderBy: [{ category: "asc" }, { threshold: "asc" }],
          select: { id: true, category: true, threshold: true, reward: true },
        })
        .catch(() => []),
      prisma.chaseCompanion
        .findMany({
          where: { enabled: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, assetType: true, assetUrl: true },
        })
        .catch(() => []),
    ]);

  if (!museum?.enabled) {
    return <MuseumMessage body="The Digital Museum isn't open right now — check back soon." />;
  }

  // ── Services Room ──────────────────────────────────────────────────────
  // The shop wall (lib/museum/servicesRoom.ts). Provisioned like About/
  // Freedom Wall/Stairs, but unlike them it takes an ordinary slot in the
  // curated corridor at whatever displayOrder the admin has dragged it to —
  // so it's merged into `rooms` below rather than appended at a fixed spot.
  // The sync runs before the read so a product listed or hidden since the
  // last visit is reflected on this load, without ProductsClient.tsx having
  // to know this room exists.
  const servicesRow = await ensureServicesRoom();
  await ensureRoomBanner(servicesRow.id, "SERVICES").catch(() => {});
  await syncServicesRoomProducts(servicesRow.id).catch(() => {
    // A failed reconcile shows a slightly stale wall — never a broken
    // museum. The room still renders from whatever rows it already has.
  });
  const servicesContent = servicesRow.enabled
    ? await prisma.museumRoom.findUnique({
        where: { id: servicesRow.id },
        select: SERVICES_ROOM_CONTENT_SELECT,
      })
    : null;

  // ── Stories Room ───────────────────────────────────────────────────────
  // The library (lib/museum/storiesRoom.ts). Same shape of handling as the
  // Services Room above and for the same reason: it sits at an ordinary
  // displayOrder in the corridor, but its podium rows have to be reconciled
  // against the published Stories library before they're read.
  const storiesRow = await ensureStoriesRoom();
  // Config row for the optional pedestal .glb — see storyPodiumModel.ts.
  // Holds no URL until an admin uploads one, so this changes nothing on its
  // own; it just guarantees the editor has a row to attach an upload to.
  await ensureStoryPodiumModel(storiesRow.id).catch(() => {});
  // The room-wide plaque style its podium labels read — see roomBanner.ts.
  await ensureRoomBanner(storiesRow.id, "STORIES").catch(() => {});
  await syncStoriesRoomStories(storiesRow.id).catch(() => {
    // A failed reconcile shows a slightly stale floor — never a broken
    // museum. The room still renders from whatever rows it already has.
  });
  const storiesContent = storiesRow.enabled
    ? await prisma.museumRoom.findUnique({
        where: { id: storiesRow.id },
        select: ROOM_CONTENT_SELECT,
      })
    : null;

  // ── Arcade Room ────────────────────────────────────────────────────────
  // The Mini Games (lib/museum/arcadeRoom.ts). Handled exactly like the
  // Stories Room above: an ordinary displayOrder slot in the corridor, but
  // its cabinet rows have to be reconciled against the playable mini games
  // (and each row's public game payload joined in) before they're read.
  const arcadeRow = await ensureArcadeRoom();
  // Config row for the room-wide Cabinets/Posters default — see arcadeConfig.ts.
  await ensureArcadeConfig(arcadeRow.id).catch(() => {});
  await ensureRoomBanner(arcadeRow.id, "ARCADE").catch(() => {});
  await syncArcadeRoomGames(arcadeRow.id).catch(() => {
    // A failed reconcile shows a slightly stale floor — never a broken
    // museum. The room still renders from whatever rows it already has.
  });
  // The public payloads for every playable game (same list the gallery's Mini
  // Games launcher shows) — read on demand, joined to the cabinet rows below.
  // readPlayerId is read-only: a visitor who has never played gets null and
  // simply sees no personal bests on the cabinets.
  const arcadeGames: PublicGame[] = arcadeRow.enabled
    ? await buildPublicGames(await readPlayerId().catch(() => null)).catch(() => [])
    : [];
  const gamesByType = new Map(arcadeGames.map((g) => [g.type as string, g]));
  const arcadeContent = arcadeRow.enabled
    ? await prisma.museumRoom.findUnique({
        where: { id: arcadeRow.id },
        select: ROOM_CONTENT_SELECT,
      })
    : null;
  // The room-wide arcade settings: the display-mode fallback, plus the cabinet
  // body every game stands on (built-in, re-surfaced, or an uploaded .glb).
  const arcadeConfig = parseArcadeConfig(
    arcadeContent?.sceneObjects.find((o) => o.kind === ARCADE_CONFIG_KIND)?.modelUrl
  );
  const arcadeDefaultMode: ArcadeDisplayMode = arcadeConfig.defaultMode;

  // ── Cosplay Room ───────────────────────────────────────────────────────
  // The costume standees (lib/museum/cosplayRoom.ts). Handled exactly like the
  // Stories Room above: an ordinary displayOrder slot in the corridor, but its
  // standee rows have to be reconciled against the published Cosplays before
  // they're read.
  const cosplayRow = await ensureCosplayRoom();
  // Config row for the room-wide standee body + backdrop panel — see
  // cosplayStandee.ts. Holds the defaults until an admin changes something, so
  // this changes nothing on its own; it just guarantees the editor has a row to
  // attach an upload to.
  await ensureCosplayStandeeModel(cosplayRow.id).catch(() => {});
  await ensureRoomBanner(cosplayRow.id, "COSPLAY").catch(() => {});
  await syncCosplayRoomEntries(cosplayRow.id).catch(() => {
    // A failed reconcile shows a slightly stale room — never a broken museum.
    // The room still renders from whatever rows it already has.
  });
  const cosplayContent = cosplayRow.enabled
    ? await prisma.museumRoom.findUnique({
        where: { id: cosplayRow.id },
        select: ROOM_CONTENT_SELECT,
      })
    : null;
  // The room-wide standee settings: the body every cosplay's print stands on
  // (built-in, re-surfaced, or an uploaded .glb) plus the backdrop panel its
  // second photo hangs on.
  const cosplayStandeeConfig = parseCosplayStandeeConfig(
    cosplayContent?.sceneObjects.find((o) => o.kind === COSPLAY_STANDEE_MODEL_KIND)?.modelUrl
  );

  // ── Respawn room's wall clock ──────────────────────────────────────────
  // The room a visitor spawns into gets the same working clock the About
  // room has (lib/museum/wallClock.ts) — it is the first wall anyone sees.
  // Provisioned here as well as in the Scene Editor's own route, so a
  // visitor who arrives before an admin has ever opened that room's scene
  // still finds it hanging; the row is created once and simply read back on
  // every load after that.
  //
  // Merged into the mapped room below rather than left for the next load:
  // the museum read above already ran, so a clock created just now isn't in
  // the rows it returned, and the visitor who triggered the provisioning is
  // exactly the one who would otherwise see a bare wall.
  const respawnClockRow = await ensureRespawnRoomWallClock().catch(() => null);

  // Curated rooms plus the mirror rooms, in one displayOrder-sorted list —
  // exactly what the rooms query alone produced before they existed.
  const rooms: MuseumRoomPublic[] = [
    ...museum.rooms.map((room) => ({ displayOrder: room.displayOrder, room })),
    ...(servicesContent ? [{ displayOrder: servicesContent.displayOrder, room: servicesContent }] : []),
    ...(storiesContent ? [{ displayOrder: storiesContent.displayOrder, room: storiesContent }] : []),
    ...(arcadeContent ? [{ displayOrder: arcadeContent.displayOrder, room: arcadeContent }] : []),
    ...(cosplayContent ? [{ displayOrder: cosplayContent.displayOrder, room: cosplayContent }] : []),
  ]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((entry) => {
      const base = mapRoomContent(
        entry.room,
        entry.room.roomType === "ARCADE" ? gamesByType : undefined
      );
      // A clock provisioned moments ago (see respawnClockRow above) isn't in
      // the rows mapRoomContent just read, so it's added here. An existing
      // one came through the mapping already and is left alone.
      const mapped =
        respawnClockRow &&
        respawnClockRow.roomId === entry.room.id &&
        respawnClockRow.modelUrl &&
        // A hidden clock is absent from `customObjects` for the same reason
        // it is absent from the museum — not because it hasn't been read yet.
        // Without this the check below reads that absence as "needs adding"
        // and hangs the very clock the admin just switched off.
        !respawnClockRow.hidden &&
        !base.customObjects.some((o) => o.id === respawnClockRow.id)
          ? {
              ...base,
              customObjects: [
                ...base.customObjects,
                {
                  id: respawnClockRow.id,
                  kind: respawnClockRow.kind,
                  modelUrl: respawnClockRow.modelUrl,
                  positionX: respawnClockRow.positionX,
                  positionY: respawnClockRow.positionY,
                  positionZ: respawnClockRow.positionZ,
                  rotationY: respawnClockRow.rotationY,
                  scale: respawnClockRow.scale,
                  solid: respawnClockRow.solid,
                  colliderRadius: respawnClockRow.colliderRadius,
                  colliderOffsetX: respawnClockRow.colliderOffsetX,
                  colliderOffsetZ: respawnClockRow.colliderOffsetZ,
                  colliderHeight: respawnClockRow.colliderHeight,
                  colliderBaseY: respawnClockRow.colliderBaseY,
                },
              ],
            }
          : base;
      if (entry.room.roomType === "ARCADE") {
        return {
          ...mapped,
          arcadeDefaultMode,
          arcadeCabinet: {
            modelUrl: arcadeConfig.cabinetModelUrl,
            textureUrl: arcadeConfig.cabinetTextureUrl,
            screenHeight: arcadeConfig.screenHeight,
            screenDepth: arcadeConfig.screenDepth,
          },
        };
      }
      // The Cosplay Room's standee config travels the same way the Arcade
      // Room's cabinet config does, and for the same reason: it describes every
      // one of the room's contents, so it belongs on the room rather than being
      // re-parsed per standee.
      if (entry.room.roomType === "COSPLAY") {
        return {
          ...mapped,
          cosplayStandee: {
            modelUrl: cosplayStandeeConfig.url,
            textureUrl: cosplayStandeeConfig.textureUrl,
            cutoutHeight: cosplayStandeeConfig.cutoutHeight,
            backdropEnabled: cosplayStandeeConfig.backdropEnabled,
            backdropWidth: cosplayStandeeConfig.backdropWidth,
            backdropHeight: cosplayStandeeConfig.backdropHeight,
            backdropFrameColor: cosplayStandeeConfig.backdropFrameColor,
            backdropEdgeColor: cosplayStandeeConfig.backdropEdgeColor,
            backdropEdgeThickness: cosplayStandeeConfig.backdropEdgeThickness,
            plaquePanelColor: cosplayStandeeConfig.plaquePanelColor,
            plaqueEdgeColor: cosplayStandeeConfig.plaqueEdgeColor,
            plaqueTextColor: cosplayStandeeConfig.plaqueTextColor,
            plaqueFontFamily: cosplayStandeeConfig.plaqueFontFamily,
            plaqueFontScale: cosplayStandeeConfig.plaqueFontScale,
            lightsStyle: cosplayStandeeConfig.lightsStyle,
            lightsColor: cosplayStandeeConfig.lightsColor,
            lightsIntensity: cosplayStandeeConfig.lightsIntensity,
            lightsBulbSize: cosplayStandeeConfig.lightsBulbSize,
            lightsSpacing: cosplayStandeeConfig.lightsSpacing,
            lightsAnimation: cosplayStandeeConfig.lightsAnimation,
            lightsSpeed: cosplayStandeeConfig.lightsSpeed,
            floodCount: cosplayStandeeConfig.floodCount,
            floodBeamHeight: cosplayStandeeConfig.floodBeamHeight,
            floodBeamSpread: cosplayStandeeConfig.floodBeamSpread,
          },
        };
      }
      return mapped;
    });

  // "About ScriptOverNovel" is a real MuseumRoom row (roomType: "ABOUT" — see
  // lib/museum/aboutRoom.ts) so it can carry MuseumSceneObject placements
  // (Museum Scene Editor decorative objects) just like a curated room, but
  // its *displayed* content still comes from the exact same Profile/
  // CertificateAward/ArtistSkill/SocialLink rows app/(public)/about/page.tsx
  // reads (same fallback display name too, so it's never a second content
  // source to keep in sync), and its wall/floor/ceiling still come from
  // DigitalMuseum.about* rather than the row's own (unused) color columns —
  // see RoomsTab.tsx's "About ScriptOverNovel" card. Always appended as the
  // corridor's final room (its displayOrder is fixed far beyond any
  // curated room's — see ensureAboutRoom) so it's reachable by walking
  // through the last curated room's doorway (roomLayout.ts chains rooms in
  // array order), and it's the one room a visitor can always reach even
  // before any real gallery room has been curated.
  const aboutRoomRow = await ensureAboutRoom();
  await ensureRoomBanner(aboutRoomRow.id, "ABOUT").catch(() => {});
  const aboutRoomContent = await prisma.museumRoom.findUnique({
    where: { id: aboutRoomRow.id },
    select: ROOM_CONTENT_SELECT,
  });

  // The About room's 3 movable content blocks — a position *offset*, not
  // an absolute placement (see lib/museum/aboutRoomBlocks.ts), so unlike
  // customObjects these are extracted from the raw sceneObjects list here
  // rather than through mapRoomContent's generic mapping, which has no
  // reason to know about them (every other room ignores these kinds
  // entirely — they only ever exist on this one row).
  // Each entry now also carries a wall (decoded from the SceneObject's
  // rotationY) and, for the plaque block, display config (parsed from its
  // modelUrl JSON string — see aboutRoomBlocks.ts for encoding details).
  // The Contact Desk row — see ensureAboutContactDesk. A failed provision
  // just means no desk this load, never a broken room.
  // These two come back from their provisioning helpers rather than through
  // ROOM_CONTENT_SELECT above, so its `hidden` filter can't reach them —
  // hence the explicit check on each. Treating a hidden fixture as absent
  // (rather than passing it along with a flag to be honoured downstream) is
  // what makes hiding safe: `aboutContact`/`aboutClock` being undefined is
  // already the "this room has no desk/clock" case every consumer handles.
  const aboutContactRow = await ensureAboutContactDesk(aboutRoomRow.id)
    .then((row) => (row.hidden ? null : row))
    .catch(() => null);
  // The digital wall clock — same lazy provision, same "a failed provision
  // just means no clock this load" tolerance.
  const aboutClockRow = await ensureWallClock(aboutRoomRow.id, "ABOUT")
    .then((row) => (row.hidden ? null : row))
    .catch(() => null);

  // Read on their own rather than out of `aboutRoomContent.sceneObjects`,
  // and deliberately *without* that select's `hidden: false` filter. The 5
  // About blocks are the one case where a missing row does not mean "not
  // there": it means "draw this where the design puts it" (see
  // aboutRoomBlocks.ts — these rows hold an offset from a designed anchor,
  // not a placement). So dropping a hidden block's row here would put the
  // block back at its default spot, which is the opposite of hiding it. The
  // rows come through carrying `hidden` instead, and AboutRoomContents skips
  // the ones marked.
  const aboutBlockRows = await prisma.museumSceneObject.findMany({
    where: {
      roomId: aboutRoomRow.id,
      deletedAt: null,
      kind: { in: ABOUT_BLOCK_KINDS as readonly string[] as string[] },
    },
    select: {
      kind: true, modelUrl: true, positionX: true, positionY: true,
      rotationY: true, scale: true, hidden: true,
    },
  });

  const aboutBlockOffsets: AboutBlockOffsets = Object.fromEntries(
    aboutBlockRows
      .filter((o): o is typeof o & { kind: AboutBlockKind } => (ABOUT_BLOCK_KINDS as readonly string[]).includes(o.kind))
      .map((o) => {
        const meta: AboutBlockMeta = {
          // [alongWall, height, 0] — the wall owns the perpendicular axis.
          offset: [o.positionX, o.positionY, 0],
          wall: rotYToWall(o.rotationY) ?? DEFAULT_BLOCK_WALL[o.kind as AboutBlockKind],
          scale: o.scale ?? 1,
          hidden: o.hidden,
        };
        if (o.kind === ABOUT_PLAQUE_KIND) {
          meta.plaqueConfig = parsePlaqueConfig(o.modelUrl);
        } else if (
          o.kind === ABOUT_CERTS_KIND ||
          o.kind === ABOUT_CARD_KIND ||
          o.kind === ABOUT_GIGS_KIND
        ) {
          meta.labelConfig = parseAboutLabelConfig(
            o.modelUrl,
            defaultAboutLabelConfig(o.kind as AboutBlockKind)
          );
          // Both configs share this one column — see mergeSceneObjectConfig.
          if (o.kind === ABOUT_CERTS_KIND) {
            meta.certPlacements = parseCertPlacements(o.modelUrl);
          }
        }
        return [o.kind, meta];
      })
  );

  const aboutRoom: MuseumRoomPublic = {
    ...(aboutRoomContent
      ? mapRoomContent(aboutRoomContent)
      : {
          floor: 0,
          customObjects: [],
          artworkPlacementOverrides: {},
          artworks: [],
          // Podiums only ever exist in the Stories Room.
          stories: [],
          // Cabinets only ever exist in the Arcade Room.
          miniGames: [],
          // Standees only ever exist in the Cosplay Room.
          cosplays: [],
        }),
    // Client-facing identity stays this fixed constant rather than the
    // real row's own cuid — MuseumScene.tsx, useWallFocus.ts,
    // ScreenshotCapture.tsx, CertificateInfoPanel.tsx, AboutRoomCorner.tsx
    // and MuseumSceneLoader.tsx all compare a room's id against
    // ABOUT_ROOM_ID directly, so this keeps every one of them working
    // unchanged; only the admin-only Museum Scene Editor route needs the
    // real id (see RoomsTab.tsx's Edit Scene link, sourced from
    // /api/digital-museum's aboutRoomId instead of this public payload).
    id: ABOUT_ROOM_ID,
    name: "About ScriptOverNovel",
    slug: "about-scriptovernovel",
    description: "Meet the artist behind the collection.",
    roomType: "ABOUT",
    isEntryRoom: false,
    // Wall/floor/ceiling are admin-set via the museum-wide
    // DigitalMuseum.about* fields (edited alongside real rooms in
    // RoomsTab.tsx's "About ScriptOverNovel" card) rather than the row's own
    // columns, which stay at their defaults and go unused — keeps that
    // admin UI/API unchanged now that the row itself is real.
    wallColor: museum.aboutWallColor ?? DEFAULT_WALL_COLOR,
    floorColor: museum.aboutFloorColor ?? DEFAULT_FLOOR_COLOR,
    ceilingColor: museum.aboutCeilingColor ?? DEFAULT_CEILING_COLOR,
    wallTexture: museum.aboutWallTexture,
    floorTexture: museum.aboutFloorTexture,
    ceilingTexture: museum.aboutCeilingTexture,
    splashIcon: museum.aboutSplashIcon,
    splashTitle: museum.aboutSplashTitle,
    // Own DigitalMuseum field, not the row's own splashEnabled column —
    // same reasoning as its wall/floor/ceiling above.
    splashEnabled: museum.aboutSplashEnabled ?? true,
    aboutBlockOffsets,
    // The Contact Desk stands on the floor and is dragged freely, so unlike
    // the blocks above it travels as a real placement rather than a
    // wall-relative offset. Provisioned here as well as in the editor's
    // scene-objects route, so a visitor who reaches the room before an admin
    // has ever opened its scene still finds the desk.
    ...(aboutContactRow
      ? {
          aboutContact: {
            position: [
              aboutContactRow.positionX,
              aboutContactRow.positionY,
              aboutContactRow.positionZ,
            ] as [number, number, number],
            rotationY: aboutContactRow.rotationY,
            scale: aboutContactRow.scale ?? 1,
            config: parseContactDeskConfig(aboutContactRow.modelUrl),
          },
        }
      : {}),
    // The wall clock travels the same way, and for the same reason.
    ...(aboutClockRow
      ? {
          aboutClock: {
            position: [
              aboutClockRow.positionX,
              aboutClockRow.positionY,
              aboutClockRow.positionZ,
            ] as [number, number, number],
            rotationY: aboutClockRow.rotationY,
            scale: aboutClockRow.scale ?? 1,
            config: parseWallClockConfig(aboutClockRow.modelUrl),
          },
        }
      : {}),
  };

  // ── Freedom Wall room ──────────────────────────────────────────────────────
  // Provisioned once (like the About room), always sits at displayOrder
  // 999_998, one slot before the About capstone. Only included in the
  // corridor when the row's own `enabled` flag is true (admin-toggled in
  // RoomsTab's Freedom Wall card — same behaviour as any curated room).
  const [freedomWallRow, freedomWallSettings] = await Promise.all([
    ensureFreedomWallRoom(),
    prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: {
        isActive: true,
        activeEventId: true,
        // The event's name is painted on the wall inside the room
        // (FreedomWallRoomContents' banner) and shown in the note form, so
        // an admin rename shows up here on the next load — this page is
        // force-dynamic, so that's every load.
        activeEvent: { select: { title: true, isArchived: true } },
      },
    }).catch(() => null),
  ]);

  // Auto-provisions the banner scene object before the sceneObjects read
  // below, so it flows through mapRoomContent's customObjects exactly like
  // any admin-placed text label — no separate wiring needed. Ensures the
  // banner (and the active event's name on it) shows up even before an
  // admin has ever opened this room's Museum Scene Editor.
  await ensureFreedomWallBanner(freedomWallRow.id, getRoomSize("FREEDOM_WALL").depth);

  const freedomWallRoomContent = await prisma.museumRoom.findUnique({
    where: { id: freedomWallRow.id },
    select: ROOM_CONTENT_SELECT,
  });

  // Fetch non-archived notes for the active event — empty when no event is set.
  const freedomWallNotes: FreedomWallNotePublic[] =
    freedomWallSettings?.activeEventId
      ? await prisma.freedomWallNote
          .findMany({
            where: { eventId: freedomWallSettings.activeEventId, isArchived: false, deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              nickname: true,
              content: true,
              positionX: true,
              positionY: true,
              color: true,
              rotation: true,
              scale: true,
              wall: true,
              createdAt: true,
            },
          })
          .then((rows) => rows.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })))
          .catch(() => [])
      : [];

  const freedomWallRoom: MuseumRoomPublic = {
    ...(freedomWallRoomContent
      ? mapRoomContent(freedomWallRoomContent)
      : { floor: 0, customObjects: [], artworkPlacementOverrides: {}, artworks: [], stories: [], miniGames: [], cosplays: [] }),
    id: freedomWallRow.id,
    name: freedomWallRoomContent?.name ?? "Freedom Wall",
    slug: freedomWallRoomContent?.slug ?? "freedom-wall",
    description: freedomWallRoomContent?.description ?? "Leave a sticky note on the wall.",
    roomType: "FREEDOM_WALL",
    isEntryRoom: false,
    wallColor: freedomWallRoomContent?.wallColor ?? "#faf8f3",
    floorColor: freedomWallRoomContent?.floorColor ?? "#d6cfc2",
    ceilingColor: freedomWallRoomContent?.ceilingColor ?? "#f0ece4",
    wallTexture: freedomWallRoomContent?.wallTexture ?? null,
    floorTexture: freedomWallRoomContent?.floorTexture ?? null,
    ceilingTexture: freedomWallRoomContent?.ceilingTexture ?? null,
    splashIcon: freedomWallRoomContent?.splashIcon ?? null,
    splashTitle: freedomWallRoomContent?.splashTitle ?? "Freedom Wall",
    splashEnabled: freedomWallRoomContent?.splashEnabled ?? true,
  };

  const freedomWallEnabled = freedomWallRow.enabled;

  // Only surfaced when the room is on, the wall is active and the event
  // hasn't been archived out from under it — the same three conditions that
  // gate note submission below, so the banner never advertises an event
  // visitors can't actually write to.
  const freedomWallEventTitle =
    freedomWallEnabled &&
    freedomWallSettings?.isActive &&
    freedomWallSettings.activeEvent &&
    !freedomWallSettings.activeEvent.isArchived
      ? freedomWallSettings.activeEvent.title
      : null;

  // ── Second Floor + Stairs connector ─────────────────────────────────────
  // Any room (curated, Freedom Wall, or About ScriptOverNovel) can be assigned to
  // `floor: 1` from RoomsTab.tsx — see docs/SecondFloorStairs_Spec.md. The
  // corridor is every eligible room split into its floor-0 and floor-1
  // groups (each independently sorted by displayOrder, same as today), with
  // the auto-provisioned Stairs room spliced in between only when the
  // floor-1 group is actually non-empty — mirrors Freedom Wall's own
  // enabled-gated inclusion.
  // aboutEnabled defaults true — omit the About room only when explicitly disabled.
  const eligibleRooms: MuseumRoomPublic[] = [
    ...rooms,
    ...(freedomWallEnabled ? [freedomWallRoom] : []),
    ...(museum.aboutEnabled !== false ? [aboutRoom] : []),
  ];
  const floor0Rooms = eligibleRooms.filter((r) => r.floor !== 1);
  const floor1Rooms = eligibleRooms.filter((r) => r.floor === 1);

  let stairsRoom: MuseumRoomPublic | null = null;
  if (floor1Rooms.length > 0) {
    const stairsRow = await ensureStairsRoom();
    const stairsContent = await prisma.museumRoom.findUnique({
      where: { id: stairsRow.id },
      select: ROOM_CONTENT_SELECT,
    });
    stairsRoom = {
      ...(stairsContent
        ? mapRoomContent(stairsContent)
        : { customObjects: [], artworkPlacementOverrides: {}, artworks: [], stories: [], miniGames: [], cosplays: [] }),
      id: stairsRow.id,
      name: stairsContent?.name ?? "Stairs",
      slug: stairsContent?.slug ?? "stairs-connector",
      description: null,
      roomType: "STAIRS",
      isEntryRoom: false,
      floor: 0,
      wallColor: stairsContent?.wallColor ?? DEFAULT_WALL_COLOR,
      floorColor: stairsContent?.floorColor ?? DEFAULT_FLOOR_COLOR,
      ceilingColor: stairsContent?.ceilingColor ?? DEFAULT_CEILING_COLOR,
      wallTexture: stairsContent?.wallTexture ?? null,
      floorTexture: stairsContent?.floorTexture ?? null,
      ceilingTexture: stairsContent?.ceilingTexture ?? null,
      splashIcon: stairsContent?.splashIcon ?? null,
      splashTitle: stairsContent?.splashTitle ?? "Stairs",
      splashEnabled: stairsContent?.splashEnabled ?? true,
    };
  }

  const allRooms = [...floor0Rooms, ...(stairsRoom ? [stairsRoom] : []), ...floor1Rooms];
  // Entry room search stays scoped to curated ground-floor rooms (see
  // docs/SecondFloorStairs_Spec.md's open question #1 — spawning upstairs
  // before a visitor has ever walked the stairs is deliberately avoided).
  const entryRoomId = rooms.find((r) => r.isEntryRoom)?.id ?? floor0Rooms[0]?.id ?? aboutRoom.id;

  const chaseCompanions: MuseumChaseCompanion[] = chaseCompanionRows.map((c) => ({
    id: c.id,
    assetType: c.assetType as "model" | "image",
    assetUrl: c.assetUrl,
  }));

  const achievements: MuseumAchievementPublic[] = museum.achievementsEnabled
    ? achievementRows.map((a) => ({ ...a, category: a.category as MuseumAchievementPublic["category"] }))
    : [];

  return (
    // z-50 (up from z-40) so the site-wide BackgroundMusicPlayer (z-40)
    // is hidden behind the museum overlay — the museum has its own
    // soundtrack button in the HUD instead (see MuseumClient.tsx).
    <div className="fixed inset-0 z-50 bg-black">
      <MuseumClient
        rooms={allRooms}
        initialRoomId={entryRoomId}
        aboutRoomId={ABOUT_ROOM_ID}
        aboutData={aboutData}
        deepLinkRoom={deepLinkRoom}
        deepLinkRoomId={deepLinkRoomId}
        servicesRoomId={servicesRow.enabled ? servicesRow.id : null}
        storiesRoomId={storiesRow.enabled ? storiesRow.id : null}
        arcadeRoomId={arcadeRow.enabled ? arcadeRow.id : null}
        cosplayRoomId={cosplayRow.enabled ? cosplayRow.id : null}
        freedomWallRoomId={freedomWallEnabled ? freedomWallRoom.id : null}
        freedomWallNotes={freedomWallEnabled ? freedomWallNotes : []}
        freedomWallEventTitle={freedomWallEventTitle}
        freedomWallAcceptingNotes={Boolean(freedomWallEnabled && freedomWallSettings?.isActive && freedomWallSettings?.activeEventId)}
        chaseCompanions={chaseCompanions}
        achievementsEnabled={museum.achievementsEnabled}
        achievementsHudEnabled={museum.achievementsHudEnabled}
        minimapConfig={parseMinimapHudConfig(museum.minimapConfig)}
        achievements={achievements}
        splashEnabled={museum.splashEnabled}
        splashStyle={sanitizeSplashStyle(museum.splashStyle)}
        splashStyleMobile={sanitizeSplashStyle(museum.splashStyleMobile)}
        splashEffect={sanitizeSplashEffect(museum.splashEffect)}
        splashSpeedMs={clampSplashSpeed(museum.splashSpeedMs)}
        splashBgColor={sanitizeSplashBgColor(museum.splashBgColor)}
        splashTaglineFontSize={sanitizeSplashTaglineFontSize(museum.splashTaglineFontSize)}
        splashTaglineFontFamily={sanitizeSplashTaglineFontFamily(museum.splashTaglineFontFamily)}
        museumMusicUrl={museum.museumMusicEnabled && museum.museumMusicUrl ? museum.museumMusicUrl : null}
        museumMusicVolume={museum.museumMusicVolume ?? 50}
        brightnessLight={museum.museumBrightnessLight ?? 50}
        brightnessDark={museum.museumBrightnessDark ?? 50}
        // Resolved here rather than in the client: the config is a JSON blob
        // and the built-in definitions live server-side anyway, so the browser
        // receives a plain ordered list of {id,label,css} and never has to
        // know how a custom colour becomes a filter. An empty list is how
        // "switched off" travels — MuseumClient renders no [Q] handler and no
        // button for it.
        visionFilters={
          museum.visionFiltersEnabled
            ? resolveVisionFilters(parseVisionFilterConfig(museum.visionFilterConfig))
            : []
        }
      />
    </div>
  );
}
