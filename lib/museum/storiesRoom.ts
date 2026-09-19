// lib/museum/storiesRoom.ts
//
// The "Stories Room" — the Stories library inside the museum corridor. Same
// lazy-provision pattern as ensureAboutRoom/ensureFreedomWallRoom/
// ensureStairsRoom/ensureServicesRoom: a real MuseumRoom row (roomType
// "STORIES") so it has its own id, floor, enabled flag, wall/floor/ceiling
// colors + textures, and can carry Museum Scene Editor placements like any
// other room.
//
// It is modelled on the Services Room specifically (lib/museum/servicesRoom.ts
// — read that first), and shares its two defining traits:
//
//  1. It stays *inside* RoomsTab.tsx's reorderable list rather than being
//     pinned below it. Its displayOrder is a real value in the same 0..N
//     range as every curated room, so the admin moves it up and down the
//     corridor with the same arrows.
//  2. Its contents aren't hand-picked. syncStoriesRoomStories keeps its
//     MuseumRoomStory rows mirroring every published Story — publish one in
//     the Stories module and a podium appears here; unpublish or delete it
//     and the podium goes away.
//
// Where it differs from every other room, Services included: its contents
// don't hang on the walls. Each story stands on its own podium on the floor
// (podiumPlacement.ts computes the grid), because a book is something you
// walk up to and open rather than something you view from across a room.
// That's also why podiums need their own join model — MuseumRoomStory —
// rather than riding MuseumRoomArtwork: a Story isn't an Artwork. The reason
// they're real rows at all is the same reason the Services Room's frames are:
// a real row is what the Museum Scene Editor can select, drag and save onto.
//
// The room is never admin-creatable, never retypeable (rooms/[id]'s PATCH
// validTypes excludes STORIES) and never deletable (that same route's DELETE
// refuses it) — RoomsTab.tsx hides the Trash button for it to match.
import { prisma } from "@/lib/prisma";
import {
  STORY_PODIUM_MODEL_KIND,
  DEFAULT_PODIUM_MODEL_CONFIG,
  serializePodiumModelConfig,
} from "@/lib/museum/storyPodiumModel";

// Distinctive enough that no admin-typed curated room name could ever slugify
// into a collision — same reasoning as ABOUT_ROOM_SLUG / SERVICES_ROOM_SLUG.
const STORIES_ROOM_SLUG = "stories-library-room";

export async function ensureStoriesRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "STORIES" } });
  if (existing) return existing;

  // Lands at the end of the curated 0..N range (rooms/route.ts's POST assigns
  // displayOrder by that same count) so a museum that already has rooms gets
  // the library as its new last stop rather than silently jumping to the
  // front. The fixed 999_xxx orders ABOUT/FREEDOM_WALL/STAIRS use are
  // excluded from the count for exactly that reason.
  const curatedCount = await prisma.museumRoom.count({
    where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
  });

  return prisma.museumRoom.create({
    data: {
      name: "Tales Room",
      slug: STORIES_ROOM_SLUG,
      roomType: "STORIES",
      description: "Books, novels, comics and manga — step up to a podium to read.",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: curatedCount,
    },
  });
}

/**
 * Reconciles the Stories Room's podiums with the published Stories library.
 *
 * "Published" is exactly what app/(public)/stories/page.tsx shows: a Story
 * that is `published` and not soft-deleted. Nothing else — the room is a
 * mirror of that shelf, so any extra filtering here would make the two
 * disagree.
 *
 * Called from both the public museum page and the admin config GET, so the
 * floor is correct on the next load after any story change without needing
 * StoriesClient.tsx to know this room exists. Writes only when something
 * actually differs, so the common "nothing changed" case is two reads.
 *
 * Note: unpublishing a story removes its row, and with it any Scene Editor
 * placement that row was carrying. Re-publishing it later brings the podium
 * back at its auto-computed grid slot, not where it used to stand. Keeping
 * orphaned rows around to preserve that would mean carrying podiums the
 * library no longer has, which is the worse of the two — same trade-off, and
 * for the same reason, as syncServicesRoomProducts.
 */
export async function syncStoriesRoomStories(roomId: string) {
  const [publishedStories, existing] = await Promise.all([
    prisma.story.findMany({
      where: { published: true, deletedAt: null },
      // Matches the public shelf's own ordering so podium displayOrder (and
      // with it the auto-computed grid slots) reads left-to-right in the same
      // sequence a visitor saw on /stories.
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
    prisma.museumRoomStory.findMany({
      where: { roomId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, storyId: true },
    }),
  ]);

  const publishedIds = new Set(publishedStories.map((s) => s.id));
  const standingIds = new Set(existing.map((e) => e.storyId));

  const toAdd = publishedStories.filter((s) => !standingIds.has(s.id));
  const toRemove = existing.filter((e) => !publishedIds.has(e.storyId));

  if (toAdd.length > 0) {
    await prisma.museumRoomStory.createMany({
      data: toAdd.map((s, i) => ({
        roomId,
        storyId: s.id,
        displayOrder: existing.length + i,
      })),
      // Two concurrent requests can both decide to add the same story; the
      // [roomId, storyId] unique constraint makes the loser a no-op instead
      // of a 500.
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await prisma.museumRoomStory.deleteMany({
      where: { id: { in: toRemove.map((e) => e.id) } },
    });
  }
}

/**
 * Provisions the room's single podium-model config row (see
 * storyPodiumModel.ts) so the Museum Scene Editor always has something to
 * show an Upload control for, rather than needing a "create it first" step.
 *
 * Provisioned holding the *default* config — no URL — which means "use the
 * procedural pedestal". Nothing renders differently until an admin actually
 * uploads a .glb, so this is free to call on every load.
 */
export async function ensureStoryPodiumModel(roomId: string) {
  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: STORY_PODIUM_MODEL_KIND, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: STORY_PODIUM_MODEL_KIND,
      modelUrl: serializePodiumModelConfig(DEFAULT_PODIUM_MODEL_CONFIG),
      // Position columns are unused for this row — it's configuration, not a
      // placement (see storyPodiumModel.ts's header).
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });
}
