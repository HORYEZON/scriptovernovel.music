// app/api/digital-museum/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/lib/intro-splash";
import { MIN_SPLASH_SPEED, MAX_SPLASH_SPEED } from "@/lib/museum-splash";
import { sanitizeMinimapHudConfig, serializeMinimapHudConfig } from "@/lib/museum/minimapHud";
import { sanitizeArtworkShimmerConfig, serializeArtworkShimmerConfig } from "@/lib/museum/artworkShimmer";
import { parseVisionFilterConfig, serializeVisionFilterConfig } from "@/lib/museum/visionFilters";
import { ensureAboutRoom } from "@/lib/museum/aboutRoom";
import { ensureFreedomWallRoom } from "@/lib/museum/freedomWallRoom";
import { ensureStairsRoom } from "@/lib/museum/stairsRoom";
import { ensureServicesRoom, syncServicesRoomProducts } from "@/lib/museum/servicesRoom";
import { ensureStoriesRoom, syncStoriesRoomStories, ensureStoryPodiumModel } from "@/lib/museum/storiesRoom";
import { ensureArcadeRoom, syncArcadeRoomGames, ensureArcadeConfig } from "@/lib/museum/arcadeRoom";
import { ensureCosplayRoom, syncCosplayRoomEntries, ensureCosplayStandeeModel } from "@/lib/museum/cosplayRoom";
import { ensureVinylRoom, syncVinylRoomRecords, ensureVinylConfig } from "@/lib/museum/vinylRoom";
import { ensureRoomBanner } from "@/lib/museum/roomBannerProvision";

// Digital Museum config lives on a single well-known row — no separate
// "which row is active" lookup is ever needed.
const MUSEUM_ID = "singleton";
const SPLASH_EFFECTS = ["fade", "slide-up", "slide-down", "portrait-half", "landscape-half"];
const SPLASH_STYLES = ["full-page", "side-popup"];

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// GET /api/digital-museum — admin config: enabled/title/description + the
// room list (with each room's artwork count) for DigitalMuseumPanel.tsx's
// Rooms tab. Room *contents* are fetched separately per-room on demand
// (see rooms/[id]/route.ts) — this stays a lightweight overview fetch.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    // Provisioned (and, for Services, reconciled against the live shop
    // listing) *before* the museum query below rather than alongside it —
    // the Services Room is the one fixed room that appears in that query's
    // `rooms` result, so it has to exist, and its frames have to be current,
    // for RoomsTab.tsx to render it with an accurate product count.
    const [aboutRoom, freedomWallRoom, stairsRoom, servicesRoom, storiesRoom, arcadeRoom, cosplayRoom, vinylRoom] = await Promise.all([
      ensureAboutRoom(),
      ensureFreedomWallRoom(),
      ensureStairsRoom(),
      ensureServicesRoom(),
      ensureStoriesRoom(),
      ensureArcadeRoom(),
      ensureCosplayRoom(),
      ensureVinylRoom(),
    ]);
    // Every mirror room reconciles here for the same reason: they appear in
    // the `rooms` result below, so RoomsTab.tsx needs their contents current
    // to render an accurate count.
    await Promise.all([
      syncServicesRoomProducts(servicesRoom.id),
      syncStoriesRoomStories(storiesRoom.id),
      ensureStoryPodiumModel(storiesRoom.id),
      syncArcadeRoomGames(arcadeRoom.id),
      ensureArcadeConfig(arcadeRoom.id),
      syncCosplayRoomEntries(cosplayRoom.id),
      ensureCosplayStandeeModel(cosplayRoom.id),
      syncVinylRoomRecords(vinylRoom.id),
      ensureVinylConfig(vinylRoom.id),
      // The room-wide plaque style each of these rooms' labels reads (see
      // lib/museum/roomBanner.ts). The About room provisions here too — it is
      // the one banner room with no sync/config pass of its own.
      ensureRoomBanner(aboutRoom.id, "ABOUT"),
      ensureRoomBanner(servicesRoom.id, "SERVICES"),
      ensureRoomBanner(storiesRoom.id, "STORIES"),
      ensureRoomBanner(arcadeRoom.id, "ARCADE"),
      ensureRoomBanner(cosplayRoom.id, "COSPLAY"),
    ]);

    const museum = await prisma.digitalMuseum.upsert({
      where: { id: MUSEUM_ID },
      update: {},
      create: { id: MUSEUM_ID },
      select: {
        id: true,
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
        aboutWallColor: true,
        aboutFloorColor: true,
        aboutCeilingColor: true,
        aboutWallTexture: true,
        aboutFloorTexture: true,
        aboutCeilingTexture: true,
        aboutSplashIcon: true,
        aboutSplashTitle: true,
        aboutSplashEnabled: true,
        aboutEnabled: true,
        achievementsEnabled: true,
        achievementsHudEnabled: true,
        minimapConfig: true,
        artworkShimmerConfig: true,
        visionFiltersEnabled: true,
        visionFilterConfig: true,
        museumMusicUrl: true,
        museumMusicEnabled: true,
        museumMusicVolume: true,
        museumBrightnessLight: true,
        museumBrightnessDark: true,
        museumBrightnessDim: true,
        // ABOUT is excluded — that's the auto-generated "About ScriptOverNovel"
        // capstone room (see lib/museum/aboutRoom.ts), rendered as its own
        // fixed card at the bottom of RoomsTab.tsx rather than in this
        // reorderable list. Its real id is fetched separately below via
        // ensureAboutRoom, for that card's "Edit Scene" link.
        //
        // SERVICES is deliberately *not* excluded: unlike the other three
        // fixed rooms it has a real displayOrder among the curated rooms and
        // is reordered with the same arrows, so it belongs in this list (see
        // lib/museum/servicesRoom.ts). RoomsTab.tsx recognises it by roomType
        // and drops the actions it doesn't have (rename type, delete, pick
        // artworks) rather than getting a separate payload.
        rooms: {
          where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            roomType: true,
            displayOrder: true,
            enabled: true,
            isEntryRoom: true,
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
            // Full entries (not just a count) — expected room/artwork
            // volume is small enough that fetching everything once up
            // front is simpler than a second round-trip whenever the admin
            // opens "Manage Artworks" for a room.
            artworks: {
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                displayOrder: true,
                createdAt: true,
                artwork: {
                  select: { id: true, title: true, imageUrl: true, published: true, slug: true },
                },
              },
            },
            // Only ever non-empty on the STORIES room. A count would do for
            // the card's "N stories" line, but RoomsTab also lists the titles
            // standing in the room (there's no picker to open — membership is
            // mirrored, not chosen), so the admin can see *what* is in there.
            stories: {
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                displayOrder: true,
                story: {
                  select: { id: true, title: true, coverImageUrl: true, type: true },
                },
              },
            },
            // Only ever non-empty on the COSPLAY room, and read for the same
            // reason `stories` is: RoomsTab lists what is standing in the room
            // (there's no picker to open — membership is mirrored, not chosen).
            cosplays: {
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                displayOrder: true,
                cosplay: {
                  select: { id: true, title: true, character: true, standeeImageUrl: true },
                },
              },
            },
            // Only ever non-empty on the VINYL room — RoomsTab lists the
            // records hanging in it (mirrored from Music → Vinyls).
            vinyls: {
              orderBy: { displayOrder: "asc" },
              select: {
                id: true,
                displayOrder: true,
                vinyl: {
                  select: { id: true, sideLabel: true, release: { select: { id: true, title: true, coverImageUrl: true } } },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      ...museum,
      // Like Services, the Stories Room is *in* the reorderable `rooms` list
      // above — this id is only here so callers that need to address it
      // directly (e.g. its Edit Scene link) don't have to scan for roomType.
      storiesRoomId: storiesRoom.id,
      // Same as Stories — the Arcade Room is in the reorderable `rooms` list
      // above; this id is only for callers that address it directly.
      arcadeRoomId: arcadeRoom.id,
      // And the Cosplay Room, on the same terms again.
      cosplayRoomId: cosplayRoom.id,
      // And the Vinyl Room.
      vinylRoomId: vinylRoom.id,
      aboutRoomId: aboutRoom.id,
      // About's own `floor` column (0/1 — see docs/SecondFloorStairs_Spec.md)
      // is a real MuseumRoom field, unlike its wall/floor/ceiling visuals
      // which live on this DigitalMuseum row instead (about* fields above) —
      // so it's patched through rooms/[id]/route.ts using aboutRoomId, same
      // as any curated room's Floor toggle, not through this PATCH.
      aboutFloor: aboutRoom.floor,
      freedomWallRoomId: freedomWallRoom.id,
      freedomWallEnabled: freedomWallRoom.enabled,
      freedomWallFloor: freedomWallRoom.floor,
      freedomWallSplashEnabled: freedomWallRoom.splashEnabled,
      freedomWallVisuals: {
        wallColor: freedomWallRoom.wallColor,
        floorColor: freedomWallRoom.floorColor,
        ceilingColor: freedomWallRoom.ceilingColor,
        wallTexture: freedomWallRoom.wallTexture,
        floorTexture: freedomWallRoom.floorTexture,
        ceilingTexture: freedomWallRoom.ceilingTexture,
      },
      // Stairs connector room (see lib/museum/stairsRoom.ts) — no `enabled`
      // toggle of its own (it's spliced into the corridor automatically
      // whenever any room has floor: 1, never admin-toggled) and no
      // `floor` toggle either (it doesn't belong to either floor). Only its
      // Floor/Wall/Ceiling Color + Texture are admin-editable, same PATCH
      // pattern as Freedom Wall's visuals above.
      stairsRoomId: stairsRoom.id,
      stairsSplashEnabled: stairsRoom.splashEnabled,
      stairsVisuals: {
        wallColor: stairsRoom.wallColor,
        floorColor: stairsRoom.floorColor,
        ceilingColor: stairsRoom.ceilingColor,
        wallTexture: stairsRoom.wallTexture,
        floorTexture: stairsRoom.floorTexture,
        ceilingTexture: stairsRoom.ceilingTexture,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch museum config" }, { status: 500 });
  }
}

// PATCH /api/digital-museum — museum-wide settings only (enabled/title/
// description/splash*). Room-level settings (name/type/colors/etc.) go
// through rooms/[id]/route.ts instead.
export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const {
      enabled,
      title,
      description,
      splashEnabled,
      splashEffect,
      splashSpeedMs,
      splashBgColor,
      splashTaglineFontSize,
      splashTaglineFontFamily,
      splashStyle,
      splashStyleMobile,
      aboutWallColor,
      aboutFloorColor,
      aboutCeilingColor,
      aboutWallTexture,
      aboutFloorTexture,
      aboutCeilingTexture,
      aboutSplashIcon,
      aboutSplashTitle,
      aboutSplashEnabled,
      aboutEnabled,
      achievementsEnabled,
      achievementsHudEnabled,
      museumMusicUrl,
      museumMusicEnabled,
      museumMusicVolume,
      museumBrightnessLight,
      museumBrightnessDark,
      museumBrightnessDim,
      minimapConfig,
      artworkShimmerConfig,
      visionFiltersEnabled,
      visionFilterConfig,
    } = body;

    const data: Record<string, unknown> = {};

    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.enabled = enabled;
    }
    if (title !== undefined) {
      if (title !== null && typeof title !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.title = title?.trim() || null;
    }
    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.description = description?.trim() || null;
    }
    if (splashEnabled !== undefined) {
      if (typeof splashEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashEnabled = splashEnabled;
    }
    if (splashEffect !== undefined) {
      if (typeof splashEffect !== "string" || !SPLASH_EFFECTS.includes(splashEffect)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashEffect = splashEffect;
    }
    // "full-page" (original fullscreen reveal) or "side-popup" (slide-in
    // card — see RoomSplashPopup.tsx and MuseumSplashSection.tsx's Style
    // selector).
    if (splashStyle !== undefined) {
      if (typeof splashStyle !== "string" || !SPLASH_STYLES.includes(splashStyle)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashStyle = splashStyle;
    }
    // Same as splashStyle above, applied on touch devices instead — its
    // own independent choice (RoomSplash.tsx), not a fallback of the one
    // above.
    if (splashStyleMobile !== undefined) {
      if (typeof splashStyleMobile !== "string" || !SPLASH_STYLES.includes(splashStyleMobile)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashStyleMobile = splashStyleMobile;
    }
    if (splashSpeedMs !== undefined) {
      if (
        typeof splashSpeedMs !== "number" ||
        splashSpeedMs < MIN_SPLASH_SPEED ||
        splashSpeedMs > MAX_SPLASH_SPEED
      ) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashSpeedMs = Math.round(splashSpeedMs);
    }
    if (splashBgColor !== undefined) {
      if (typeof splashBgColor !== "string" || !isHexColor(splashBgColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashBgColor = splashBgColor.trim();
    }
    if (splashTaglineFontSize !== undefined) {
      if (typeof splashTaglineFontSize !== "string" || !splashTaglineFontSize.trim()) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashTaglineFontSize = splashTaglineFontSize.trim();
    }
    if (splashTaglineFontFamily !== undefined) {
      if (typeof splashTaglineFontFamily !== "string" || !splashTaglineFontFamily.trim()) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.splashTaglineFontFamily = splashTaglineFontFamily;
    }
    // "About ScriptOverNovel" room's wall/floor/ceiling — same validation as the
    // matching fields on a real MuseumRoom (rooms/[id]/route.ts), just
    // living here since that room is never an actual MuseumRoom row.
    if (aboutWallColor !== undefined) {
      if (typeof aboutWallColor !== "string" || !isHexColor(aboutWallColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutWallColor = aboutWallColor;
    }
    if (aboutFloorColor !== undefined) {
      if (typeof aboutFloorColor !== "string" || !isHexColor(aboutFloorColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutFloorColor = aboutFloorColor;
    }
    if (aboutCeilingColor !== undefined) {
      if (typeof aboutCeilingColor !== "string" || !isHexColor(aboutCeilingColor)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutCeilingColor = aboutCeilingColor;
    }
    if (aboutWallTexture !== undefined) {
      if (aboutWallTexture !== null && typeof aboutWallTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutWallTexture = aboutWallTexture?.trim() || null;
    }
    if (aboutFloorTexture !== undefined) {
      if (aboutFloorTexture !== null && typeof aboutFloorTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutFloorTexture = aboutFloorTexture?.trim() || null;
    }
    if (aboutCeilingTexture !== undefined) {
      if (aboutCeilingTexture !== null && typeof aboutCeilingTexture !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutCeilingTexture = aboutCeilingTexture?.trim() || null;
    }
    // Same "About ScriptOverNovel" room-splash overrides as a real MuseumRoom's
    // splashIcon/splashTitle (rooms/[id]/route.ts) — see RoomSplashContent.tsx.
    if (aboutSplashIcon !== undefined) {
      if (aboutSplashIcon !== null && typeof aboutSplashIcon !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutSplashIcon = aboutSplashIcon?.trim() || null;
    }
    if (aboutSplashTitle !== undefined) {
      if (aboutSplashTitle !== null && typeof aboutSplashTitle !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutSplashTitle = aboutSplashTitle?.trim() || null;
    }
    if (aboutEnabled !== undefined) {
      if (typeof aboutEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutEnabled = aboutEnabled;
    }
    // Per-room "show entry splash" toggle for About ScriptOverNovel — mirrors
    // aboutSplashIcon/aboutSplashTitle above (About has no dedicated
    // MuseumRoom.splashEnabled row to carry this on — see that column's
    // comment). Independent of aboutEnabled (whether the room exists in
    // the corridor at all) and of splashEnabled (the museum-wide master
    // switch) above.
    if (aboutSplashEnabled !== undefined) {
      if (typeof aboutSplashEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.aboutSplashEnabled = aboutSplashEnabled;
    }
    // "Chase Companion" toggle/asset — see prisma/schema.prisma's
    // DigitalMuseum comment and ChaseCompanion.tsx.
    // Digital Museum Achievements toggles — see prisma/schema.prisma's
    // DigitalMuseum comment.
    if (achievementsEnabled !== undefined) {
      if (typeof achievementsEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.achievementsEnabled = achievementsEnabled;
    }
    if (achievementsHudEnabled !== undefined) {
      if (typeof achievementsHudEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.achievementsHudEnabled = achievementsHudEnabled;
    }
    // Museum-specific soundtrack — separate from the site-wide Profile music.
    if (museumMusicUrl !== undefined) {
      if (museumMusicUrl !== null && typeof museumMusicUrl !== "string") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumMusicUrl = museumMusicUrl?.trim() || null;
    }
    if (museumMusicEnabled !== undefined) {
      if (typeof museumMusicEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumMusicEnabled = museumMusicEnabled;
    }
    if (museumMusicVolume !== undefined) {
      const vol = Number(museumMusicVolume);
      if (!Number.isFinite(vol) || vol < 0 || vol > 100) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumMusicVolume = Math.round(vol);
    }
    // Scene brightness sliders — 0-100 where 50 = baseline. Clamped but never
    // rejected so a slightly out-of-range drag value just gets clamped.
    if (museumBrightnessLight !== undefined) {
      const b = Number(museumBrightnessLight);
      if (!Number.isFinite(b)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumBrightnessLight = Math.round(Math.min(100, Math.max(0, b)));
    }
    if (museumBrightnessDark !== undefined) {
      const b = Number(museumBrightnessDark);
      if (!Number.isFinite(b)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumBrightnessDark = Math.round(Math.min(100, Math.max(0, b)));
    }
    if (museumBrightnessDim !== undefined) {
      const b = Number(museumBrightnessDim);
      if (!Number.isFinite(b)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.museumBrightnessDim = Math.round(Math.min(100, Math.max(0, b)));
    }
    // Minimap HUD look — the radar card's size, the colour of every mark on
    // it, and the counters' size/icons, as one JSON blob (see
    // lib/museum/minimapHud.ts for why it isn't a column per knob). Accepted
    // as the object the admin panel holds and re-serialized here through the
    // same sanitizer the renderers read it back with, so a bad colour or an
    // out-of-range size is bounded on the way in rather than reaching a
    // canvas. Null clears it back to the shipped look.
    if (minimapConfig !== undefined) {
      if (minimapConfig === null) {
        data.minimapConfig = null;
      } else if (typeof minimapConfig === "object") {
        data.minimapConfig = serializeMinimapHudConfig(sanitizeMinimapHudConfig(minimapConfig));
      } else {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    }
    // Filter Vision (lib/museum/visionFilters.ts). The config is re-parsed
    // through the very function the museum reads it back with, so an
    // out-of-range strength, a bad hex or a made-up built-in id is bounded on
    // the way in rather than reaching a visitor's screen as an invalid CSS
    // filter — which fails silently, showing them nothing at all.
    if (visionFiltersEnabled !== undefined) {
      if (typeof visionFiltersEnabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.visionFiltersEnabled = visionFiltersEnabled;
    }
    // Artwork shimmer — same JSON-blob handling as the minimap above; null
    // goes back to the defaults (the sweep on, as designed).
    if (artworkShimmerConfig !== undefined) {
      if (artworkShimmerConfig === null) {
        data.artworkShimmerConfig = null;
      } else if (typeof artworkShimmerConfig === "object") {
        data.artworkShimmerConfig = serializeArtworkShimmerConfig(sanitizeArtworkShimmerConfig(artworkShimmerConfig));
      } else {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    }
    if (visionFilterConfig !== undefined) {
      if (visionFilterConfig === null) {
        data.visionFilterConfig = null;
      } else if (typeof visionFilterConfig === "object") {
        data.visionFilterConfig = serializeVisionFilterConfig(
          parseVisionFilterConfig(JSON.stringify(visionFilterConfig))
        );
      } else {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const museum = await prisma.digitalMuseum.upsert({
      where: { id: MUSEUM_ID },
      update: data,
      create: { id: MUSEUM_ID, ...data },
      select: {
        id: true,
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
        aboutWallColor: true,
        aboutFloorColor: true,
        aboutCeilingColor: true,
        aboutWallTexture: true,
        aboutFloorTexture: true,
        aboutCeilingTexture: true,
        aboutSplashIcon: true,
        aboutSplashTitle: true,
        aboutSplashEnabled: true,
        aboutEnabled: true,
        achievementsEnabled: true,
        achievementsHudEnabled: true,
        minimapConfig: true,
        artworkShimmerConfig: true,
        visionFiltersEnabled: true,
        visionFilterConfig: true,
        museumMusicUrl: true,
        museumMusicEnabled: true,
        museumMusicVolume: true,
        museumBrightnessLight: true,
        museumBrightnessDark: true,
        museumBrightnessDim: true,
      },
    });

    revalidateMuseumPaths();

    void logActivity({
      category: "CONTENT",
      action: "museum.settings.updated",
      summary: "Updated the Digital Museum's general settings.",
      entityType: "digital-museum",
      entityId: museum.id,
      // The museum settings PATCH accepts ~40 optional fields; listing the
      // ones actually sent is the difference between a useful trail entry
      // and forty identical "settings updated" lines.
      metadata: { changed: Object.keys(body ?? {}) },
      request,
    });

    return NextResponse.json(museum);
  } catch {
    return NextResponse.json({ error: "Failed to update museum config" }, { status: 500 });
  }
}
