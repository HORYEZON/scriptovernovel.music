// lib/museum/roomStatus.ts
//
// Is a given "dedicated" museum room actually reachable by a visitor right
// now? The admin "Go to" menus (AdminGoToMenu) on /admin/about,
// /admin/products, /admin/stories, /admin/cosplays and /admin/freedom-wall
// use this to grey
// out the "Digital Museum / … Room" destination and show a "this room is
// currently inactive" note whenever that room — or the whole museum — is
// switched off. Mirrors the exact `enabled` gating app/(public)/gallery/
// museum/page.tsx applies before it puts each room in the corridor:
//   • whole museum ...... DigitalMuseum.enabled
//   • About ScriptOverNovel .... DigitalMuseum.aboutEnabled (defaults on)
//   • Freedom Wall ...... its MuseumRoom row's own `enabled`
//   • Services Room ..... its MuseumRoom row's own `enabled`
//   • Stories Room ...... its MuseumRoom row's own `enabled`
//   • Arcade Room ....... its MuseumRoom row's own `enabled`
//   • Cosplay Room ...... its MuseumRoom row's own `enabled`
// A row that has never been provisioned counts as inactive — that matches
// the `enabled: false` default the ensure* helpers create those rows with.
//
// The same query also hands back each room's MuseumRoom id, so those menus can
// offer a third destination: "Museum Scene Editor / … Room", the admin-side
// /admin/artworks/museum-editor/[roomId] page for that exact room (see
// museumEditorLink below). It's gated on the same `active` flag — an off room
// is blocked in the editor menu just like it is in the public one.
import { prisma } from "@/lib/prisma";
import type { AdminGoToGroup, AdminGoToLink } from "@/components/admin/AdminGoToMenu";

export type MuseumRoomKey = "about" | "freedom-wall" | "services" | "stories" | "arcade" | "cosplay";

const ROOM_TYPE_FOR: Record<
  Exclude<MuseumRoomKey, "about">,
  "FREEDOM_WALL" | "SERVICES" | "STORIES" | "ARCADE" | "COSPLAY"
> = {
  "freedom-wall": "FREEDOM_WALL",
  services: "SERVICES",
  stories: "STORIES",
  arcade: "ARCADE",
  cosplay: "COSPLAY",
};

export interface MuseumRoomStatus {
  /** The whole Digital Museum is switched off — every room link is inactive. */
  museumEnabled: boolean;
  /** Per-room reachability, museum-wide switch already folded in. */
  active: Record<MuseumRoomKey, boolean>;
  /** Per-room MuseumRoom.id, or null when that room has never been
   *  provisioned (the ensure* helpers create the row lazily). Without an id
   *  there is no /admin/artworks/museum-editor/[roomId] page to link to. */
  roomId: Record<MuseumRoomKey, string | null>;
}

export async function getMuseumRoomStatus(): Promise<MuseumRoomStatus> {
  const [museum, rooms] = await Promise.all([
    prisma.digitalMuseum
      .findUnique({
        where: { id: "singleton" },
        select: { enabled: true, aboutEnabled: true },
      })
      .catch(() => null),
    prisma.museumRoom
      .findMany({
        where: {
          roomType: {
            in: ["ABOUT", "FREEDOM_WALL", "SERVICES", "STORIES", "ARCADE", "COSPLAY"],
          },
          deletedAt: null,
        },
        select: { id: true, roomType: true, enabled: true },
      })
      .catch(() => [] as { id: string; roomType: string; enabled: boolean }[]),
  ]);

  const museumEnabled = museum?.enabled ?? false;
  const rowByType = new Map(rooms.map((r) => [r.roomType, r]));
  const roomActive = (key: Exclude<MuseumRoomKey, "about">) =>
    museumEnabled && (rowByType.get(ROOM_TYPE_FOR[key])?.enabled ?? false);
  const idFor = (type: string) => rowByType.get(type)?.id ?? null;

  return {
    museumEnabled,
    active: {
      about: museumEnabled && museum?.aboutEnabled !== false,
      "freedom-wall": roomActive("freedom-wall"),
      services: roomActive("services"),
      stories: roomActive("stories"),
      arcade: roomActive("arcade"),
      cosplay: roomActive("cosplay"),
    },
    roomId: {
      about: idFor("ABOUT"),
      "freedom-wall": idFor("FREEDOM_WALL"),
      services: idFor("SERVICES"),
      stories: idFor("STORIES"),
      arcade: idFor("ARCADE"),
      cosplay: idFor("COSPLAY"),
    },
  };
}

/** The public "Digital Museum / … Room" destination for an AdminGoToMenu —
 *  greyed out with a reason whenever the room (or the whole museum) is off. */
export function museumRoomLink(
  status: MuseumRoomStatus,
  key: MuseumRoomKey,
  label: string,
): AdminGoToLink {
  return {
    label,
    href: `/gallery/museum?room=${key}`,
    inactive: !status.active[key],
    inactiveReason: status.museumEnabled
      ? "This room is currently inactive"
      : "The Digital Museum is currently closed",
  };
}

/** The admin-side "Museum Scene Editor / … Room" destination. Blocked on the
 *  same conditions as the public link — an admin can't lay out a room that
 *  isn't switched on — plus the case where the room row doesn't exist yet, in
 *  which case there is no [roomId] page at all. */
export function museumEditorLink(
  status: MuseumRoomStatus,
  key: MuseumRoomKey,
  label: string,
): AdminGoToLink {
  const id = status.roomId[key];
  const blocked = !status.active[key] || !id;
  return {
    label,
    // Kept non-empty even when blocked: AdminGoToMenu keys its menu items off
    // `href`, so two blocked rooms on one page would collide on "".
    href: id ? `/admin/artworks/museum-editor/${id}` : `#museum-editor-${key}`,
    inactive: blocked,
    inactiveReason: !id
      ? "This room hasn't been set up yet"
      : status.museumEnabled
        ? "This room is currently inactive"
        : "The Digital Museum is currently closed",
  };
}

// ─── The Scene Editor's own "Go to" menu ──────────────────────────────────
//
// Every room in the museum, so an admin laying out one room can jump straight
// into another's editor instead of walking back out to Digital Museum ▸ Rooms
// and hunting for the row. The helpers above answer "is this one module's
// room reachable"; these answer "what rooms are there", which is a different
// question and needs every row rather than the six dedicated ones.

export interface MuseumRoomDirectoryEntry {
  id: string;
  name: string;
  roomType: string;
  floor: number;
  /** Reachable by a visitor right now — the museum-wide switch folded in,
   *  and the About room's own `aboutEnabled` read from the singleton rather
   *  than its (unused) row column, exactly as the public corridor does. */
  active: boolean;
}

export interface MuseumRoomDirectory {
  museumEnabled: boolean;
  rooms: MuseumRoomDirectoryEntry[];
}

/** Every non-deleted room, in corridor order, each marked with whether a
 *  visitor can currently reach it. Disabled rooms are deliberately *listed* —
 *  the editor opens a switched-off room perfectly well (that is how a room is
 *  laid out before it goes live), so they are shown greyed rather than hidden,
 *  which is also what the module pages' menus do with an off room. */
export async function getMuseumRoomDirectory(): Promise<MuseumRoomDirectory> {
  const [museum, rooms] = await Promise.all([
    prisma.digitalMuseum
      .findUnique({
        where: { id: "singleton" },
        select: { enabled: true, aboutEnabled: true },
      })
      .catch(() => null),
    prisma.museumRoom
      .findMany({
        where: { deletedAt: null },
        orderBy: [{ floor: "asc" }, { displayOrder: "asc" }],
        select: { id: true, name: true, roomType: true, floor: true, enabled: true },
      })
      .catch(() => [] as { id: string; name: string; roomType: string; floor: number; enabled: boolean }[]),
  ]);

  const museumEnabled = museum?.enabled ?? false;
  const aboutEnabled = museum?.aboutEnabled !== false;
  // The Stairs connector is spliced into the corridor only when there is an
  // upstairs to reach (see the public page.tsx's chain) — so an enabled
  // Stairs row with nothing on floor 1 is still a room no visitor can walk
  // into, and saying otherwise here would be the menu's own fiction.
  const hasUpstairs = rooms.some((r) => r.floor === 1 && r.enabled && r.roomType !== "STAIRS");

  return {
    museumEnabled,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      roomType: r.roomType,
      floor: r.floor,
      active:
        museumEnabled &&
        (r.roomType === "ABOUT" ? aboutEnabled : r.enabled) &&
        (r.roomType !== "STAIRS" || hasUpstairs),
    })),
  };
}

/**
 * The Scene Editor header's "Go to" menu as two tabs.
 *
 * The flat version this replaces listed every room's editor
 * and then, at the very bottom, one entry for the public museum. That made
 * the most-wanted destination — "show me the room I just laid out, as a
 * visitor sees it" — the hardest one to find, and offered no way at all to
 * walk into a room *other* than the one being edited.
 *
 * Both halves are now the same list of rooms, addressed two ways:
 *
 *   • **Scene Editor** — /admin/artworks/museum-editor/[id], to lay a room out
 *   • **In the Museum** — /gallery/museum?roomId=[id], to walk into it
 *
 * Deep-linked by id rather than by one of the six ?room= slugs, since a
 * curated room like Collections has no slug.
 *
 * The room being edited is listed in both. In the editor tab it is blocked
 * ("You're editing this room") rather than hidden, because its absence would
 * read as a missing room; in the museum tab it is a perfectly good link and
 * sits first, being the one this menu is asked for most.
 */
export function museumEditorRoomLinkGroups(
  directory: MuseumRoomDirectory,
  currentRoomId: string,
): AdminGoToGroup[] {
  const inactiveReason = (active: boolean) =>
    active
      ? undefined
      : directory.museumEnabled
        ? "This room is currently inactive"
        : "The Digital Museum is currently closed";

  // Both tabs use the same order, and it is the same order in both: the room
  // being edited first, then every other room in the order the Rooms tab
  // declares (corridor order — floor, then displayOrder; see
  // getMuseumRoomDirectory's own orderBy).
  //
  // The two tabs used to disagree — the editor tab left the current room
  // wherever corridor order put it while the museum tab pulled it to the top —
  // so the same list read differently depending on which tab you were on, and
  // the room you are actually working on could be sixth in one and first in
  // the other. Whichever room's editor you have open is the one this menu is
  // about, so it leads in both.
  const ordered = [
    ...directory.rooms.filter((r) => r.id === currentRoomId),
    ...directory.rooms.filter((r) => r.id !== currentRoomId),
  ];

  const label = (room: MuseumRoomDirectoryEntry) =>
    room.floor === 1 ? `${room.name} · 2F` : room.name;

  const editorLinks: AdminGoToLink[] = ordered.map((room) => ({
    // Marked rather than renamed, so the row still reads as the room it is.
    label: room.id === currentRoomId ? `${label(room)} · editing now` : label(room),
    href:
      room.id === currentRoomId
        ? `#current-room`
        : `/admin/artworks/museum-editor/${room.id}`,
    // Listed but blocked: its absence would read as a missing room rather than
    // as "you are already here".
    inactive: room.id === currentRoomId || !room.active,
    inactiveReason:
      room.id === currentRoomId ? "You're editing this room" : inactiveReason(room.active),
  }));

  const museumLinks: AdminGoToLink[] = ordered.map((room) => ({
    label: room.id === currentRoomId ? `${label(room)} · this room` : label(room),
    href: `/gallery/museum?roomId=${room.id}`,
    inactive: !room.active,
    inactiveReason: inactiveReason(room.active),
  }));

  return [
    { id: "editor", label: "Scene Editor", links: editorLinks },
    {
      id: "museum",
      label: "In the Museum",
      links: [
        ...museumLinks,
        {
          label: "Museum entrance",
          href: "/gallery/museum",
          inactive: !directory.museumEnabled,
          inactiveReason: "The Digital Museum is currently closed",
        },
      ],
    },
  ];
}
