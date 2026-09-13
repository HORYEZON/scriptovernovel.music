// app/api/digital-museum/rooms/[id]/scene-objects/route.ts
//
// Backs the Museum Scene Editor (Docs/MuseumSceneEditor_Spec.md) — GET
// lists a room's placed objects (custom decorative props, plus the About
// room's own 3 movable content blocks), lazily provisioning the About
// room's blocks the first time its editor is opened, so there's always
// something to select/drag rather than an empty scene. POST adds a new
// custom decorative object (Phase 2 — an admin-uploaded .glb prop, see
// app/api/upload/model/route.ts).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ABOUT_BLOCK_KINDS, ABOUT_CONTACT_KIND, ABOUT_CLOCK_KIND } from "@/lib/museum/aboutRoomBlocks";
import { ensureFreedomWallBanner } from "@/lib/museum/freedomWallRoom";
import { FREEDOM_WALL_BANNER_KIND } from "@/lib/museum/freedomWallBanner";
import { STORY_PODIUM_MODEL_KIND } from "@/lib/museum/storyPodiumModel";
import { COSPLAY_STANDEE_MODEL_KIND } from "@/lib/museum/cosplayStandee";
import { ensureAboutContactDesk } from "@/lib/museum/aboutRoom";
import { ensureWallClock } from "@/lib/museum/wallClock";
import { ensureStoryPodiumModel } from "@/lib/museum/storiesRoom";
import { ensureCosplayStandeeModel } from "@/lib/museum/cosplayRoom";
import { ARCADE_CONFIG_KIND } from "@/lib/museum/arcadeConfig";
import { DIVIDER_KIND, DEFAULT_DIVIDER_CONFIG } from "@/lib/museum/wallDivider";
import { BANNER_KIND, DEFAULT_BANNER_CONFIG } from "@/lib/museum/sceneBanner";
import { ensureArcadeConfig } from "@/lib/museum/arcadeRoom";
import { ensureRoomBanner, roomTypeHasBanner } from "@/lib/museum/roomBannerProvision";
import { ROOM_BANNER_KIND } from "@/lib/museum/roomBanner";
import { getRoomSize } from "@/app/(public)/gallery/museum/components/roomConstants";

// GET /api/digital-museum/rooms/[id]/scene-objects — list a room's placed
// objects, auto-provisioning the About room's 3 movable content blocks
// the first time its editor is opened.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const room = await prisma.museumRoom.findUnique({
      where: { id },
      // isEntryRoom because the wall clock hangs in the visitor's respawn
      // room as well as the About room — see lib/museum/wallClock.ts.
      select: { roomType: true, isEntryRoom: true },
    });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    let objects = await prisma.museumSceneObject.findMany({
      where: { roomId: id, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    // The About room's 3 movable content blocks (Photo Slideshow, Bio &
    // Skills Plaque, Certificates Strip — see lib/museum/aboutRoomBlocks
    // .ts) always exist once its editor is opened — every About room has
    // these unconditionally.
    if (room.roomType === "ABOUT") {
      const missingKinds = ABOUT_BLOCK_KINDS.filter((kind) => !objects.some((o) => o.kind === kind));
      if (missingKinds.length > 0) {
        await prisma.museumSceneObject.createMany({
          data: missingKinds.map((kind) => ({ roomId: id, kind, positionX: 0, positionY: 0, positionZ: 0, rotationY: 0 })),
        });
        objects = await prisma.museumSceneObject.findMany({
          where: { roomId: id, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });
      }
    }

    // The About room's Contact Desk — the one interactive prop in that room.
    // Same lazy-provision pattern as the blocks above, but a real placement
    // rather than a wall-relative offset, so it is seeded standing against a
    // wall (see ensureAboutContactDesk) instead of at the origin.
    if (room.roomType === "ABOUT" && !objects.some((o) => o.kind === ABOUT_CONTACT_KIND)) {
      await ensureAboutContactDesk(id);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The digital wall clock — provisioned exactly like the desk above, and
    // placed the same free way (see lib/museum/wallClock.ts). Hangs in two
    // rooms: the About room, and whichever room a visitor respawns into,
    // since that is the first wall anyone sees on arrival. Everything below
    // this point — the object list, its Room Fixtures entry, its config
    // panel — is keyed on the row's kind, not on the room, so the editor
    // needs nothing else to make it editable here.
    if (
      (room.roomType === "ABOUT" || room.isEntryRoom) &&
      !objects.some((o) => o.kind === ABOUT_CLOCK_KIND)
    ) {
      await ensureWallClock(id, room.roomType);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The Freedom Wall room's single event-title plaque (see
    // lib/museum/freedomWallBanner.ts) — same lazy-provision pattern as the
    // About blocks above, so it's always there to select/drag the first
    // time this room's editor is opened.
    if (room.roomType === "FREEDOM_WALL" && !objects.some((o) => o.kind === FREEDOM_WALL_BANNER_KIND)) {
      await ensureFreedomWallBanner(id, getRoomSize(room.roomType).depth);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The Stories Room's single podium-model config row (see
    // lib/museum/storyPodiumModel.ts) — same lazy-provision pattern again, so
    // the editor always has a row to hang its Upload control on. Unlike the
    // two above this one is configuration rather than a placement: it holds
    // no URL until an admin uploads a .glb, and nothing renders from it while
    // the procedural pedestal is in use.
    if (room.roomType === "STORIES" && !objects.some((o) => o.kind === STORY_PODIUM_MODEL_KIND)) {
      await ensureStoryPodiumModel(id);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The Arcade Room's single display-mode config row (see
    // lib/museum/arcadeConfig.ts) — same lazy-provision + "config, not a
    // placement" pattern as the Stories pedestal model above.
    if (room.roomType === "ARCADE" && !objects.some((o) => o.kind === ARCADE_CONFIG_KIND)) {
      await ensureArcadeConfig(id);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The Cosplay Room's single standee/backdrop config row (see
    // lib/museum/cosplayStandee.ts) — same lazy-provision + "config, not a
    // placement" pattern as the two above.
    if (room.roomType === "COSPLAY" && !objects.some((o) => o.kind === COSPLAY_STANDEE_MODEL_KIND)) {
      await ensureCosplayStandeeModel(id);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    // The room-wide plaque style every one of this room's labels reads (see
    // lib/museum/roomBanner.ts) — same lazy-provision + "config, not a
    // placement" pattern as the three above, for the five room types that
    // actually draw a plaque.
    if (roomTypeHasBanner(room.roomType) && !objects.some((o) => o.kind === ROOM_BANNER_KIND)) {
      await ensureRoomBanner(id, room.roomType);
      objects = await prisma.museumSceneObject.findMany({
        where: { roomId: id, deletedAt: null },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json(objects);
  } catch {
    return NextResponse.json({ error: "Failed to fetch scene objects" }, { status: 500 });
  }
}

// POST /api/digital-museum/rooms/[id]/scene-objects — add a new scene
// object. Two supported kinds:
//   "custom" — an uploaded .glb decorative prop; requires a `modelUrl`
//              (Supabase public URL). Capped at 10 per room.
//   "text"   — an admin-authored text label; `modelUrl` is a JSON blob
//              (TextObjectConfig). No upload needed — created instantly
//              with sensible defaults that the admin then edits in the
//              side panel. Capped at 10 per room.
//   "divider" — a freestanding partition wall (lib/museum/wallDivider.ts);
//              `modelUrl` is a WallDividerConfig JSON blob. Same "created
//              instantly with defaults, then edited in the panel" flow as
//              a text label.
//   "banner"  — a titled plaque (lib/museum/sceneBanner.ts); `modelUrl` is a
//              SceneBannerConfig JSON blob. Same instant-create flow again.
// Position/rotation are optional and default to room center for both.
// The "Duplicate" action reuses this endpoint, passing the original's
// position/rotation (offset slightly so the copy isn't on top).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { kind: rawKind, modelUrl, label, positionX, positionY, positionZ, rotationY, scale, solid, colliderRadius, colliderOffsetX, colliderOffsetZ, colliderHeight, colliderBaseY } = body;

    const kind: string =
      rawKind === "text"
        ? "text"
        : rawKind === DIVIDER_KIND
          ? DIVIDER_KIND
          : rawKind === BANNER_KIND
            ? BANNER_KIND
            : "custom";
    // Optional admin-chosen name — only kept for "custom" .glb props, trimmed
    // and capped so the editor's list/dialogs stay legible.
    const resolvedLabel =
      kind === "custom" && typeof label === "string" && label.trim()
        ? label.trim().slice(0, 80)
        : null;
    const numberOr = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isFinite(value) ? value : fallback;

    // For "custom" kind a real modelUrl is required; for "text" we generate
    // the default JSON config when none is supplied.
    let resolvedModelUrl: string;
    if (kind === BANNER_KIND) {
      // Same instant-create flow as a divider — a banner is code-drawn, so it
      // needs no upload to exist and its wording is typed in the panel after.
      resolvedModelUrl =
        typeof modelUrl === "string" && modelUrl ? modelUrl : JSON.stringify(DEFAULT_BANNER_CONFIG);
    } else if (kind === DIVIDER_KIND) {
      // Same "created instantly, then tuned in the panel" flow as a text
      // label — a divider needs no upload to exist, and its optional surface
      // texture is added later through the same panel.
      resolvedModelUrl =
        typeof modelUrl === "string" && modelUrl ? modelUrl : JSON.stringify(DEFAULT_DIVIDER_CONFIG);
    } else if (kind === "text") {
      resolvedModelUrl = typeof modelUrl === "string" && modelUrl
        ? modelUrl
        : JSON.stringify({ text: "Text Label", fontSize: 0.2, fontFamily: "/fonts/DMSans-Bold.woff", color: "#ffffff", maxWidth: 3.0 });
    } else {
      if (!modelUrl || typeof modelUrl !== "string") {
        return NextResponse.json({ error: "Missing modelUrl" }, { status: 400 });
      }
      resolvedModelUrl = modelUrl;
    }

    const room = await prisma.museumRoom.findUnique({ where: { id }, select: { id: true } });
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

    // Soft per-room cap (shared across custom+text) — flagged as a real
    // risk in Docs/MuseumSceneEditor_Spec.md (every object is more GPU load).
    const objectCount = await prisma.museumSceneObject.count({
      where: { roomId: id, kind: { in: ["custom", "text", DIVIDER_KIND, BANNER_KIND] }, deletedAt: null },
    });
    if (objectCount >= 15) {
      return NextResponse.json(
        { error: "This room already has 15 scene objects — remove one before adding another" },
        { status: 409 }
      );
    }

    const object = await prisma.museumSceneObject.create({
      data: {
        roomId: id,
        kind,
        label: resolvedLabel,
        modelUrl: resolvedModelUrl,
        positionX: numberOr(positionX, 0),
        positionY: numberOr(positionY, 0),
        positionZ: numberOr(positionZ, 0),
        rotationY: numberOr(rotationY, 0),
        // Uniform scale for "custom" props — "Duplicate" passes the
        // original's value through; a fresh upload defaults to 1.
        scale: numberOr(scale, 1),
        // Player-collision flag + footprint for "custom" props — "Duplicate"
        // carries them over, a fresh upload is walk-through by default.
        solid: kind === "custom" && solid === true,
        colliderRadius:
          kind === "custom" && typeof colliderRadius === "number" && Number.isFinite(colliderRadius)
            ? colliderRadius
            : null,
        // Where that footprint sits on the model (model units, the prop's own
        // rotated frame). A copy has to bring these along with the radius —
        // a duplicate whose collision snapped back to the original's origin
        // would be the very bug the offset exists to fix.
        colliderOffsetX: kind === "custom" ? numberOr(colliderOffsetX, 0) : 0,
        colliderOffsetZ: kind === "custom" ? numberOr(colliderOffsetZ, 0) : 0,
        // ...and how tall it stands. Null means floor-to-ceiling, so a copy
        // that dropped this would quietly become solid at every height while
        // the original let visitors walk under it.
        colliderHeight:
          kind === "custom" && typeof colliderHeight === "number" && Number.isFinite(colliderHeight)
            ? colliderHeight
            : null,
        // 0 rather than null when absent — "not lifted" is a real position,
        // and the column defaults to standing on the prop's own base.
        colliderBaseY:
          kind === "custom" && typeof colliderBaseY === "number" && Number.isFinite(colliderBaseY)
            ? colliderBaseY
            : 0,
      },
    });

    return NextResponse.json(object, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add object" }, { status: 500 });
  }
}
