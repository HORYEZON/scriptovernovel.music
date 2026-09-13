// app/(admin)/admin/artworks/RoomsTab.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Images,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  Landmark,
  Image as ImageIcon,
  Sparkles,
  User,
  AlertTriangle,
  Move3d,
  StickyNote,
  ShoppingBag,
  BookOpen,
  Gamepad2,
  Shirt,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminAccordion } from "@/components/admin/AdminAccordion";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { MuseumRoomType } from "@/types";
import { Toggle, ColorField, TextureField } from "./museum-ui";
import { IconPicker } from "../settings/Preferences/IconPicker";
import { ArtworkPicker, type PickableArtwork, type PickerEntry } from "./ArtworkPicker";

// "ABOUT" and "FREEDOM_WALL" (see @/types) are never admin-created through
// this CRUD — About ScriptOverNovel is built straight in
// app/(public)/gallery/museum/page.tsx, and Freedom Wall/Stairs are each
// their own lazily-provisioned row (freedomWallRoom.ts, stairsRoom.ts).
// Narrowing them all out here (rather than importing the full public
// MuseumRoomType) is what lets ROOM_TYPE_ICON below index safely without
// needing a runtime fallback for a case that can't happen.
//
// "SERVICES" stays *in*: unlike the three above, the Services Room is a real
// entry in this reorderable list (see lib/museum/servicesRoom.ts) — it's the
// room's actions that are narrowed, not its presence. It's still never
// admin-*creatable*, which is why ROOM_TYPE_OPTIONS below (the "pick a type"
// dropdown) is a smaller set than this type.
export type AdminRoomType = Exclude<MuseumRoomType, "ABOUT" | "FREEDOM_WALL" | "STAIRS">;

/** The subset of AdminRoomType an admin can actually pick when creating a
 * room — everything except the provisioned mirror rooms (Services, Stories,
 * Arcade, Cosplay), each of which is its own singleton marker row. */
export type CreatableRoomType = Exclude<AdminRoomType, "SERVICES" | "STORIES" | "ARCADE" | "COSPLAY">;

export interface RoomConfig {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roomType: AdminRoomType;
  displayOrder: number;
  enabled: boolean;
  isEntryRoom: boolean;
  /** 0 = ground floor, 1 = second floor — see docs/SecondFloorStairs_Spec.md.
   * A plain two-way toggle in this admin UI even though the underlying
   * column is a general Int. */
  floor: number;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  // Optional tiled texture overriding the matching *Color above when set —
  // see MuseumRoom.tsx and roomConstants.ts's TEXTURE_TILE_METERS.
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
  // Room-entry splash overrides — see RoomSplashContent.tsx. Null icon
  // falls back to the glowing squid mark; null title falls back to `name`.
  splashIcon: string | null;
  splashTitle: string | null;
  /** Independent of DigitalMuseum.splashEnabled (the museum-wide master
   * switch) — both must be true for this room's splash to actually fire. */
  splashEnabled: boolean;
  artworks: PickerEntry[];
  /** Only ever non-empty on the Stories Room — one entry per podium, mirrored
   * from the published Stories library (lib/museum/storiesRoom.ts). Read-only
   * here: there's no picker, since membership isn't chosen. */
  stories?: RoomStoryEntry[];
  /** Only ever non-empty on the Cosplay Room — one entry per standee, mirrored
   * from the published Cosplays (lib/museum/cosplayRoom.ts). Read-only here for
   * the same reason `stories` is. */
  cosplays?: RoomCosplayEntry[];
}

/** One podium's worth of what RoomsTab needs to show — see RoomConfig.stories. */
export interface RoomStoryEntry {
  id: string;
  displayOrder: number;
  story: { id: string; title: string; coverImageUrl: string; type: string };
}

/** One standee's worth of what RoomsTab needs to show — see RoomConfig.cosplays. */
export interface RoomCosplayEntry {
  id: string;
  displayOrder: number;
  cosplay: { id: string; title: string; character: string | null; standeeImageUrl: string };
}

// Freedom Wall room's wall/floor/ceiling — a real MuseumRoom row (unlike
// About ScriptOverNovel which stores its visuals on DigitalMuseum), so its color
// fields live directly on the row and are patched via rooms/[id] PATCH.
// Kept as a separate interface (rather than reusing RoomConfig) so the
// fixed card below only exposes the surface it needs to manage.
export interface FreedomWallRoomVisuals {
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
}

// The auto-generated "About ScriptOverNovel" room's wall/floor/ceiling + splash
// icon/title — never a MuseumRoom row (see the fixed card below), so these
// live on DigitalMuseum instead and are edited through
// DigitalMuseumPanel.tsx's onUpdateAboutVisuals rather than updateRoom.
// Same shape/defaults as the matching MuseumRoom fields (name kept as
// "Visuals" even though splash icon/title joined it later, rather than
// rippling a rename through both files for a cosmetic gain).
export interface AboutRoomVisuals {
  aboutWallColor: string;
  aboutFloorColor: string;
  aboutCeilingColor: string;
  aboutWallTexture: string | null;
  aboutFloorTexture: string | null;
  aboutCeilingTexture: string | null;
  aboutSplashIcon: string | null;
  aboutSplashTitle: string | null;
  /** When false the About ScriptOverNovel room is hidden from the museum corridor. */
  aboutEnabled: boolean;
  /** Independent of DigitalMuseum.splashEnabled (the museum-wide master
   * switch) — both must be true for About ScriptOverNovel's splash to fire. */
  aboutSplashEnabled: boolean;
}

const DEFAULT_WALL_COLOR = "#ece7db";
const DEFAULT_FLOOR_COLOR = "#c9c0ad";
const DEFAULT_CEILING_COLOR = "#f4f2ec";

// Friendly names for updateRoom's success/failure toast — only these fields
// get a named confirmation (see updateRoom below); every other field this
// tab can patch (enabled, entry room) stays silent-on-success as before.
const TOASTED_FIELD_LABELS = {
  name: "Room Name",
  description: "Description",
  roomType: "Room Type",
  wallColor: "Wall Color",
  floorColor: "Floor Color",
  ceilingColor: "Ceiling Color",
  wallTexture: "Wall Texture",
  floorTexture: "Floor Texture",
  ceilingTexture: "Ceiling Texture",
  splashIcon: "Splash Icon",
  splashTitle: "Splash Title",
  floor: "Floor",
} as const;

// The "Room Type" dropdown's options — only the types an admin can actually
// create or switch a room to (rooms/[id]'s PATCH validates against this same
// three). SERVICES is absent on purpose; ROOM_TYPE_LABEL below is what the
// card headers read from instead, so the Services Room still gets a name.
const ROOM_TYPE_OPTIONS: { value: CreatableRoomType; label: string }[] = [
  { value: "MAIN_HALL", label: "Main Hall" },
  { value: "GALLERY", label: "Gallery" },
  { value: "SPECIAL_EXHIBITION", label: "Special Exhibition" },
];

const ROOM_TYPE_LABEL: Record<AdminRoomType, string> = {
  MAIN_HALL: "Main Hall",
  GALLERY: "Gallery",
  SPECIAL_EXHIBITION: "Special Exhibition",
  SERVICES: "Services",
  STORIES: "Stories",
  ARCADE: "Arcade",
  COSPLAY: "Cosplay",
};

const ROOM_TYPE_ICON: Record<AdminRoomType, typeof Landmark> = {
  MAIN_HALL: Landmark,
  GALLERY: ImageIcon,
  SPECIAL_EXHIBITION: Sparkles,
  SERVICES: ShoppingBag,
  STORIES: BookOpen,
  ARCADE: Gamepad2,
  COSPLAY: Shirt,
};

/** The provisioned mirror rooms — real corridor rooms an admin can reorder and
 *  restyle, but never create, retype or delete, so the "Fixed Rooms" group is
 *  where they belong even though they live in the same `rooms` list as the
 *  curated ones. */
const MIRROR_ROOM_TYPES: AdminRoomType[] = ["SERVICES", "STORIES", "ARCADE", "COSPLAY"];

/** Freedom Wall + About ScriptOverNovel + Stairs — the three fixed cards written
 *  straight into the Fixed Rooms group rather than coming from `rooms`, and so
 *  the part of that group's count no filter can produce. */
const FIXED_CARD_COUNT = 3;

/** Remembers which groups are folded, so an admin who has hidden the fixed
 *  rooms doesn't have to hide them again on every visit to this tab. */
const ROOM_GROUPS_STORAGE_KEY = "admin_rooms_tab_groups";

// The rooms list's collapsible sections are the shared AdminAccordion — the
// same component General Settings uses, so the two tabs can't drift apart.
// Display grouping only: the corridor order the reorder arrows write is still
// the single flat list (see renderRoomCard's `index`), and folding decides
// nothing but which cards are on screen, so a museum with a long curated list
// can fold the provisioned rooms away without changing anything a visitor sees.
function RoomGroup({
  title,
  subtitle,
  icon,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <AdminAccordion
      title={title}
      subtitle={subtitle}
      icon={icon}
      badge={count}
      open={open}
      onToggle={onToggle}
    >
      {children}
    </AdminAccordion>
  );
}

// Rooms tab of DigitalMuseumPanel.tsx — create/edit/enable/reorder rooms
// and manage each room's artwork selection (via the shared ArtworkPicker).
// Keeps admin UX to "Room Name / Description / Type / Enabled / Order, then
// Manage Artworks" per the V2 plan — no raw Three.js concepts ever surface
// here (room size/lighting are fixed presets derived from roomType, not
// admin-editable — see roomConstants.ts).
export function RoomsTab({
  rooms,
  setRooms,
  allArtworks,
  aboutVisuals,
  onUpdateAboutVisuals,
  aboutRoomId,
  aboutFloor,
  onUpdateAboutFloor,
  freedomWallRoomId,
  freedomWallEnabled,
  onToggleFreedomWall,
  freedomWallVisuals,
  onUpdateFreedomWallVisuals,
  freedomWallFloor,
  onUpdateFreedomWallFloor,
  freedomWallSplashEnabled,
  onUpdateFreedomWallSplashEnabled,
  stairsRoomId,
  stairsVisuals,
  onUpdateStairsVisuals,
  stairsSplashEnabled,
  onUpdateStairsSplashEnabled,
}: {
  rooms: RoomConfig[];
  setRooms: (rooms: RoomConfig[]) => void;
  allArtworks: PickableArtwork[];
  /** Null until DigitalMuseumPanel.tsx's initial fetch resolves. */
  aboutVisuals: AboutRoomVisuals | null;
  onUpdateAboutVisuals: (patch: Partial<AboutRoomVisuals>) => void;
  /** The auto-generated "About ScriptOverNovel" room's real MuseumRoom id (see
   * lib/museum/aboutRoom.ts) — null until the initial fetch resolves.
   * Only used to link its "Edit Scene" button below; nothing else about
   * this tab's admin CRUD (name/type/reorder/delete) applies to it. */
  aboutRoomId: string | null;
  /** About's own `floor` column (0/1 — see docs/SecondFloorStairs_Spec.md).
   * Unlike its wall/floor/ceiling visuals, this is a real MuseumRoom field
   * patched via aboutRoomId, not through onUpdateAboutVisuals. */
  aboutFloor: number;
  onUpdateAboutFloor: (floor: number) => void;
  /** The Freedom Wall room's real MuseumRoom id — null until the initial
   * fetch resolves. Used for the fixed Freedom Wall card's enabled toggle
   * and Edit Scene link. */
  freedomWallRoomId: string | null;
  freedomWallEnabled: boolean;
  onToggleFreedomWall: (enabled: boolean) => void;
  /** Null until DigitalMuseumPanel.tsx's initial fetch resolves. */
  freedomWallVisuals: FreedomWallRoomVisuals | null;
  onUpdateFreedomWallVisuals: (patch: Partial<FreedomWallRoomVisuals>) => void;
  freedomWallFloor: number;
  onUpdateFreedomWallFloor: (floor: number) => void;
  /** Independent of DigitalMuseum.splashEnabled — both must be true for
   * Freedom Wall's splash to fire. */
  freedomWallSplashEnabled: boolean;
  onUpdateFreedomWallSplashEnabled: (enabled: boolean) => void;
  /** The auto-generated Stairs connector room's real MuseumRoom id (see
   * lib/museum/stairsRoom.ts) — null until the initial fetch resolves. No
   * enabled/floor toggle of its own (see the fixed card below); only its
   * Floor/Wall/Ceiling Color + Texture (and its own splash toggle) are
   * admin-editable. */
  stairsRoomId: string | null;
  stairsVisuals: FreedomWallRoomVisuals | null;
  onUpdateStairsVisuals: (patch: Partial<FreedomWallRoomVisuals>) => void;
  stairsSplashEnabled: boolean;
  onUpdateStairsSplashEnabled: (enabled: boolean) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<{ id: string; mode: "edit" | "artworks" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CreatableRoomType>("GALLERY");
  const [saving, setSaving] = useState(false);
  const [pendingArtworkId, setPendingArtworkId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RoomConfig | null>(null);
  function openDeleteConfirm(room: RoomConfig) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(room);
  }
  const [deleting, setDeleting] = useState(false);

  // Both groups start open, so this tab looks exactly as it did before the
  // accordions existed until an admin folds one. Restored after mount rather
  // than in the initializer: the stored value doesn't exist on the server, and
  // reading it during the first render would hydrate a different tree.
  const [openGroups, setOpenGroups] = useState({ created: true, fixed: true });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ROOM_GROUPS_STORAGE_KEY);
      if (raw) setOpenGroups((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // Private mode / disabled storage — the groups just don't remember.
    }
  }, []);

  function toggleGroup(key: "created" | "fixed") {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(ROOM_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Same as above — folding still works for this visit.
      }
      return next;
    });
  }

  useLockBodyScroll(Boolean(deleteConfirm));

  const orderedRooms = [...rooms].sort((a, b) => a.displayOrder - b.displayOrder);

  function patchRoom(id: string, patch: Partial<RoomConfig>) {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function createRoom() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/digital-museum/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), roomType: newType }),
      });
      if (!res.ok) throw new Error();
      const room = await res.json();
      setRooms([...rooms, { ...room, artworks: [] }]);
      setNewName("");
      setNewType("GALLERY");
      setCreating(false);
      toast.success("Room created");
      router.refresh();
    } catch {
      toast.error("Failed to create room");
    } finally {
      setSaving(false);
    }
  }

  async function updateRoom(id: string, patch: Record<string, unknown>) {
    const previous = rooms;
    if (patch.isEntryRoom) {
      // Exclusive across the museum — reflect that locally too so the UI
      // doesn't show two "entry room" stars while the request is in flight.
      setRooms(rooms.map((r) => ({ ...r, isEntryRoom: r.id === id, ...(r.id === id ? patch : {}) })));
    } else {
      patchRoom(id, patch);
    }
    // Name/Description/Room Type, Wall/Floor/Ceiling color+texture, and
    // Splash Icon/Title changes get a named confirmation toast (success and
    // failure); `enabled` and `isEntryRoom` get their own worded ones below,
    // since "Entry Room updated" says less than naming the room it moved to.
    const toastLabel = TOASTED_FIELD_LABELS[Object.keys(patch)[0] as keyof typeof TOASTED_FIELD_LABELS];
    try {
      const res = await fetch(`/api/digital-museum/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        // The API's own message (e.g. the entry-room/Second-Floor conflict
        // guard) is far clearer than a generic "Failed to update X" —
        // surface it verbatim when present.
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || undefined);
      }
      if ("enabled" in patch) {
        const room = rooms.find((r) => r.id === id);
        const name = room?.name ?? "Room";
        toast.success(patch.enabled ? `${name} enabled` : `${name} disabled`);
      } else if ("splashEnabled" in patch) {
        // Named the same way the enabled toggle above is: this checkbox sits
        // inside a room's own edit panel, and "Entry splash on" alone doesn't
        // say which room it was turned on for.
        const name = rooms.find((r) => r.id === id)?.name ?? "this room";
        toast.success(
          patch.splashEnabled ? `Entry splash on for ${name}` : `Entry splash off for ${name}`
        );
      } else if (patch.isEntryRoom) {
        // Names the room, because ticking this also silently took the entry
        // star off whichever room held it — exactly one room in the museum can
        // have it, and the checkbox that lost it may be scrolled out of sight.
        const name = rooms.find((r) => r.id === id)?.name ?? "This room";
        toast.success(`Visitors now spawn in ${name}`);
      } else if (toastLabel) {
        toast.success(`${toastLabel} updated`);
      }
      router.refresh();
    } catch (e) {
      setRooms(previous);
      const message = e instanceof Error && e.message ? e.message : undefined;
      toast.error(message ?? (toastLabel ? `Failed to update ${toastLabel}` : "Failed to update room"));
    }
  }

  async function deleteRoom(room: RoomConfig) {
    setDeleting(true);
    const previous = rooms;
    setRooms(rooms.filter((r) => r.id !== room.id));
    if (expanded?.id === room.id) setExpanded(null);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${room.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete room");
      }
      setDeleteConfirm(null);
      toast.success(`"${room.name}" moved to Trash`);
      router.refresh();
    } catch (e) {
      setRooms(previous);
      toast.error(e instanceof Error ? e.message : "Failed to delete room");
    } finally {
      setDeleting(false);
    }
  }

  async function moveRoom(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= orderedRooms.length) return;
    const reordered = [...orderedRooms];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = reordered.map((r, i) => ({ id: r.id, displayOrder: i }));
    const previous = rooms;
    setRooms(reordered.map((r, i) => ({ ...r, displayOrder: i })));
    try {
      const res = await fetch("/api/digital-museum/rooms/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setRooms(previous);
      toast.error("Failed to reorder rooms");
    }
  }

  async function addArtwork(roomId: string, artworkId: string) {
    setPendingArtworkId(artworkId);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${roomId}/artworks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId }),
      });
      if (!res.ok) throw new Error();
      const entry: PickerEntry = await res.json();
      const room = rooms.find((r) => r.id === roomId);
      if (room) {
        patchRoom(roomId, { artworks: [...room.artworks.filter((e) => e.artwork.id !== artworkId), entry] });
      }
      toast.success(`"${entry.artwork.title}" added to room`);
      router.refresh();
    } catch {
      toast.error("Failed to add artwork");
    } finally {
      setPendingArtworkId(null);
    }
  }

  async function removeArtwork(roomId: string, artworkId: string) {
    setPendingArtworkId(artworkId);
    const room = rooms.find((r) => r.id === roomId);
    const previous = room?.artworks;
    const title = previous?.find((e) => e.artwork.id === artworkId)?.artwork.title;
    if (room) patchRoom(roomId, { artworks: room.artworks.filter((e) => e.artwork.id !== artworkId) });
    try {
      const res = await fetch(`/api/digital-museum/rooms/${roomId}/artworks?artworkId=${artworkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(title ? `"${title}" removed from room` : "Artwork removed from room");
      router.refresh();
    } catch {
      if (previous) patchRoom(roomId, { artworks: previous });
      toast.error("Failed to remove artwork");
    } finally {
      setPendingArtworkId(null);
    }
  }

  async function moveArtwork(roomId: string, index: number, direction: "up" | "down") {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;
    const ordered = [...room.artworks].sort((a, b) => a.displayOrder - b.displayOrder);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const order = ordered.map((entry, i) => ({ id: entry.id, displayOrder: i }));
    const previous = room.artworks;
    patchRoom(roomId, { artworks: ordered.map((e, i) => ({ ...e, displayOrder: i })) });
    try {
      const res = await fetch(`/api/digital-museum/rooms/${roomId}/artworks/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
      const data: PickerEntry[] = await res.json();
      patchRoom(roomId, { artworks: data });
      router.refresh();
    } catch {
      patchRoom(roomId, { artworks: previous });
      toast.error("Failed to reorder");
    }
  }

  // One room's card. Extracted out of the render body so the same markup can
  // be listed under either accordion group below without being written twice.
  // `index` stays the room's position in `orderedRooms` — the one real
  // corridor order — so the reorder arrows still walk a room through that
  // whole order even though the groups display it split in two.
  function renderRoomCard(room: RoomConfig, index: number) {
    const Icon = ROOM_TYPE_ICON[room.roomType] ?? ImageIcon;
    const isExpanded = expanded?.id === room.id;
    // The provisioned shop-wall room (lib/museum/servicesRoom.ts). It
    // keeps every action a curated room has — reorder, enable/disable,
    // edit colors/textures/splash, Ground/Second Floor, Edit Scene — and
    // loses only the three that can't apply to it: changing its type
    // (it's the marker for its own row), picking artworks (its frames
    // mirror the live shop listing, nothing to hand-pick) and deleting it
    // (rooms/[id]'s DELETE refuses it too).
    const isServices = room.roomType === "SERVICES";
    // The provisioned library room (lib/museum/storiesRoom.ts). Exactly
    // the same deal as the Services Room above — every action a curated
    // room has except retyping, picking contents and deleting — just
    // mirroring the published Stories library instead of the live shop.
    const isStories = room.roomType === "STORIES";
    // The provisioned arcade room (lib/museum/arcadeRoom.ts). Same deal as
    // the other two mirror rooms — every action except retyping, picking
    // contents and deleting — mirroring the playable mini games instead.
    const isArcade = room.roomType === "ARCADE";
    // The provisioned cosplay room (lib/museum/cosplayRoom.ts). Same deal as
    // the other three mirror rooms — every action except retyping, picking
    // contents and deleting — mirroring the published Cosplays instead.
    const isCosplay = room.roomType === "COSPLAY";
    // Every mirror room: contents are synced, not chosen, so none gets
    // the artwork picker or the Trash button.
    const isMirrorRoom = isServices || isStories || isArcade || isCosplay;
    const storyCount = room.stories?.length ?? 0;
    const cosplayCount = room.cosplays?.length ?? 0;
    // Standees line the walls, each with a photo panel hung behind it (see
    // standeePlacement.ts), so what runs out here is wall run rather than floor
    // area. Past roughly this many the perimeter starts to feel shoulder-to-
    // shoulder — the admin is told rather than silently truncated to fit, since
    // every published cosplay is meant to get a standee.
    const STANDEE_COMFORT_LIMIT = 14;
    // Podiums stand on the floor and need walking room between them (see
    // podiumPlacement.ts). Past roughly this many, the grid starts to feel
    // packed — the admin is told rather than silently truncated to fit,
    // since every published story is meant to get a podium.
    const PODIUM_COMFORT_LIMIT = 18;

    return (
      <div key={room.id} className="admin-card border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div
            className={cn(
              "shrink-0 p-2 rounded-xl",
              isMirrorRoom
                ? "bg-sepia/10 text-sepia"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">{room.name}</p>
              {isServices && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Shop Wall
                </span>
              )}
              {isStories && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Library
                </span>
              )}
              {isArcade && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Arcade
                </span>
              )}
              {isCosplay && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Cosplay
                </span>
              )}
              {room.isEntryRoom && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Star size={9} fill="currentColor" />
                  Entry
                </span>
              )}
              {room.floor === 1 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  Second Floor
                </span>
              )}
            </div>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">
              {ROOM_TYPE_LABEL[room.roomType] ?? "Gallery"} ·{" "}
              {isServices ? (
                <>
                  {room.artworks.length} live product{room.artworks.length === 1 ? "" : "s"}
                </>
              ) : isStories ? (
                // Podiums, not wall frames — `artworks` is always empty
                // here, so counting it would read "0 artworks".
                <>
                  {storyCount} podium{storyCount === 1 ? "" : "s"}
                </>
              ) : isArcade ? (
                // Cabinets mirror the playable mini games — nothing to count
                // off `artworks` (always empty here).
                <>auto-synced with your mini games</>
              ) : isCosplay ? (
                // Standees, not wall frames — `artworks` is always empty here.
                <>
                  {cosplayCount} standee{cosplayCount === 1 ? "" : "s"}
                </>
              ) : (
                <>
                  {room.artworks.length} artwork{room.artworks.length === 1 ? "" : "s"}
                </>
              )}
            </p>
            {isServices && (
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                Hangs every product you&apos;ve made visible in the{" "}
                <strong>Products</strong> module — no picking needed. Hide or delete a product
                and its frame leaves this wall.
              </p>
            )}
            {isArcade && (
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                Stands every <strong>enabled &amp; playable</strong> mini game from the{" "}
                <strong>Minigames</strong> module on its own arcade cabinet — no picking
                needed. Turn a game off (or leave it without a valid artwork) and its
                cabinet leaves the room. Switch a game to a wall poster, or change the
                room-wide default, in <strong>Edit Scene</strong>.
              </p>
            )}
            {isStories && (
              <>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                  Stands every <strong>published</strong> story from the{" "}
                  <strong>Stories</strong> module on its own podium — no picking needed.
                  Unpublish or delete a story and its podium leaves the floor.
                </p>
                {storyCount > PODIUM_COMFORT_LIMIT && (
                  <p className="flex items-start gap-1.5 font-body text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {storyCount} podiums in a room sized for about{" "}
                      {PODIUM_COMFORT_LIMIT}. Every story still gets one, but
                      they&apos;ll be tightly packed — consider drafting a few.
                    </span>
                  </p>
                )}
                {storyCount > 0 && (
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5 truncate">
                    {room.stories?.map((entry) => entry.story.title).join(" · ")}
                  </p>
                )}
              </>
            )}
            {isCosplay && (
              <>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                  Stands every <strong>published</strong> cosplay from the{" "}
                  <strong>Cosplays</strong> module on its own standee, with that
                  cosplay&rsquo;s second photo hung on the panel behind it — no picking
                  needed. Unpublish or delete a cosplay and its standee leaves the room.
                  Change the standee body or the backdrop panel in <strong>Edit Scene</strong>.
                </p>
                {cosplayCount > STANDEE_COMFORT_LIMIT && (
                  <p className="flex items-start gap-1.5 font-body text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    <span>
                      {cosplayCount} standees along walls sized for about{" "}
                      {STANDEE_COMFORT_LIMIT}. Every cosplay still gets one, but
                      they&apos;ll stand shoulder-to-shoulder — consider unpublishing a
                      few.
                    </span>
                  </p>
                )}
                {cosplayCount > 0 && (
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5 truncate">
                    {room.cosplays
                      ?.map((entry) => entry.cosplay.character || entry.cosplay.title)
                      .join(" · ")}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => moveRoom(index, "up")}
              disabled={index === 0}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              onClick={() => moveRoom(index, "down")}
              disabled={index === orderedRooms.length - 1}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
            <Toggle
              checked={room.enabled}
              onChange={(enabled) => updateRoom(room.id, { enabled })}
              label={`Toggle ${room.name}`}
            />
            <button
              onClick={() => setExpanded(isExpanded && expanded?.mode === "edit" ? null : { id: room.id, mode: "edit" })}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isExpanded && expanded?.mode === "edit"
                  ? "bg-sepia/10 text-sepia"
                  : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
              )}
              title="Edit room"
            >
              <Pencil size={14} />
            </button>
            {/* Not for either mirror room — the Services Room's frames
                mirror the live shop listing and the Stories Room's podiums
                mirror the published library, so neither has a hand-picked
                selection for this picker to manage. */}
            {!isMirrorRoom && (
              <button
                onClick={() =>
                  setExpanded(isExpanded && expanded?.mode === "artworks" ? null : { id: room.id, mode: "artworks" })
                }
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  isExpanded && expanded?.mode === "artworks"
                    ? "bg-sepia/10 text-sepia"
                    : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title="Manage artworks"
              >
                <Images size={14} />
              </button>
            )}
            {/* Ground Floor / Second Floor — see docs/SecondFloorStairs_Spec.md.
                A Stairs connector room is auto-inserted at the boundary
                the moment any room is on floor 1 (page.tsx). */}
            <button
              onClick={() => updateRoom(room.id, { floor: room.floor === 1 ? 0 : 1 })}
              className={cn(
                "px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-colors",
                room.floor === 1
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
              )}
              title={room.floor === 1 ? "On the Second Floor — click to move to Ground Floor" : "On the Ground Floor — click to move to Second Floor"}
            >
              {room.floor === 1 ? "2F" : "1F"}
            </button>
            {/* Museum Scene Editor (Docs/MuseumSceneEditor_Spec.md) —
                drag-to-place the artwork frames already hung in this
                room and any custom decorative objects. */}
            <Link
              href={`/admin/artworks/museum-editor/${room.id}`}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Edit scene (artwork placement)"
            >
              <Move3d size={14} />
            </Link>
            {/* Both mirror rooms are provisioned, not created, so neither
                has a Trash action — turning one off with the toggle above
                is the way to take it out of the corridor. Their API route
                refuses a DELETE for the same reason. */}
            {!isMirrorRoom && (
              <button
                onClick={() => openDeleteConfirm(room)}
                className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Delete room"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {isExpanded && expanded?.mode === "edit" && (
          <div className="border-t border-black/5 dark:border-white/5 p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Name
                </label>
                <input
                  type="text"
                  defaultValue={room.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== room.name && updateRoom(room.id, { name: e.target.value.trim() })}
                  className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                />
              </div>
              {/* Room Type is what marks each mirror room's own row (see
                  lib/museum/servicesRoom.ts, storiesRoom.ts) — retyping
                  one would orphan the shop wall or the library, so it
                  reads as a fixed value there instead of a dropdown. The
                  API rejects the change too. */}
              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Room Type
                </label>
                {isMirrorRoom ? (
                  <div className="admin-input w-full px-3 py-2 rounded-xl text-sm opacity-60 flex items-center gap-2">
                    {isServices ? <ShoppingBag size={14} /> : isStories ? <BookOpen size={14} /> : isArcade ? <Gamepad2 size={14} /> : <Shirt size={14} />}
                    {isServices
                      ? "Services — fixed"
                      : isStories
                        ? "Stories — fixed"
                        : isArcade
                          ? "Arcade — fixed"
                          : "Cosplay — fixed"}
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={room.roomType}
                      onChange={(e) => updateRoom(room.id, { roomType: e.target.value })}
                      className="admin-input w-full pl-3 pr-9 py-2 rounded-xl text-sm cursor-pointer appearance-none"
                    >
                      {ROOM_TYPE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Description
              </label>
              <textarea
                defaultValue={room.description ?? ""}
                onBlur={(e) => updateRoom(room.id, { description: e.target.value })}
                rows={2}
                className="admin-input w-full px-3 py-2 rounded-xl text-sm resize-none"
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ColorField
                label="Floor Color"
                value={room.floorColor}
                defaultValue={DEFAULT_FLOOR_COLOR}
                onChange={(value) => updateRoom(room.id, { floorColor: value })}
              />
              <ColorField
                label="Wall Color"
                value={room.wallColor}
                defaultValue={DEFAULT_WALL_COLOR}
                onChange={(value) => updateRoom(room.id, { wallColor: value })}
              />
              <ColorField
                label="Ceiling Color"
                value={room.ceilingColor}
                defaultValue={DEFAULT_CEILING_COLOR}
                onChange={(value) => updateRoom(room.id, { ceilingColor: value })}
              />
            </div>
            {/* Optional textures — each overrides its matching color
                above when uploaded (concrete, wood, ...), tiled across
                the surface rather than stretched. See MuseumRoom.tsx. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextureField
                label="Floor Texture"
                value={room.floorTexture}
                onChange={(url) => updateRoom(room.id, { floorTexture: url })}
              />
              <TextureField
                label="Wall Texture"
                value={room.wallTexture}
                onChange={(url) => updateRoom(room.id, { wallTexture: url })}
              />
              <TextureField
                label="Ceiling Texture"
                value={room.ceilingTexture}
                onChange={(url) => updateRoom(room.id, { ceilingTexture: url })}
              />
            </div>
            {/* Room-entry splash overrides — see RoomSplashContent.tsx.
                Both optional: an unset icon shows the glowing squid
                mark, an unset title shows this room's own Name above. */}
            <div>
              <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
                Room Splash
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <IconPicker
                  label="Splash Icon"
                  helpText="Shown on this room's entry splash — defaults to the glowing squid mark."
                  value={room.splashIcon ?? ""}
                  onChange={(v) => updateRoom(room.id, { splashIcon: v || null })}
                  defaultLabel="Using the default glowing squid"
                />
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Splash Title
                  </label>
                  <input
                    type="text"
                    defaultValue={room.splashTitle ?? ""}
                    placeholder={room.name}
                    onBlur={(e) =>
                      e.target.value !== (room.splashTitle ?? "") &&
                      updateRoom(room.id, { splashTitle: e.target.value.trim() || null })
                    }
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                    Optional — defaults to this room&apos;s Name above.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer w-fit mt-3">
                <input
                  type="checkbox"
                  checked={room.splashEnabled}
                  onChange={(e) => updateRoom(room.id, { splashEnabled: e.target.checked })}
                  className="rounded border-black/20 dark:border-white/20"
                />
                <span className="font-body text-xs text-ink dark:text-cream">
                  Show entry splash for this room
                </span>
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={room.isEntryRoom}
                onChange={(e) => e.target.checked && updateRoom(room.id, { isEntryRoom: true })}
                disabled={room.isEntryRoom}
                className="rounded"
              />
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                Visitors spawn here first
              </span>
            </label>
          </div>
        )}

        {isExpanded && expanded?.mode === "artworks" && (
          <div className="border-t border-black/5 dark:border-white/5 p-4">
            <ArtworkPicker
              allArtworks={allArtworks}
              entries={room.artworks}
              pendingId={pendingArtworkId}
              onAdd={(artworkId) => addArtwork(room.id, artworkId)}
              onRemove={(artworkId) => removeArtwork(room.id, artworkId)}
              onMove={(index, direction) => moveArtwork(room.id, index, direction)}
              orderedLabel="Room Order"
            />
          </div>
        )}
      </div>
    );
  }

  // The two groups the accordions fold independently: the rooms an admin
  // created, and the provisioned ones they can't create or delete. The mirror
  // rooms (Services/Stories/Arcade) are real corridor rooms sitting at their
  // own displayOrder among the curated ones, so they're split out of that same
  // `orderedRooms` list rather than tracked separately — their index in it is
  // exactly what renderRoomCard needs for the reorder arrows.
  const withIndex = orderedRooms.map((room, index) => ({ room, index }));
  const createdRooms = withIndex.filter(({ room }) => !MIRROR_ROOM_TYPES.includes(room.roomType));
  const fixedMirrorRooms = withIndex.filter(({ room }) => MIRROR_ROOM_TYPES.includes(room.roomType));

  return (
    <div className="space-y-3">
      <RoomGroup
        title="Created Rooms"
        subtitle="Rooms you added yourself — reorder, edit or move any of them to Trash."
        icon={<Images size={14} />}
        count={createdRooms.length}
        open={openGroups.created}
        onToggle={() => toggleGroup("created")}
      >
        {createdRooms.length === 0 ? (
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 px-1 pb-1">
            No rooms of your own yet — use <strong>New Room</strong> below to add one.
          </p>
        ) : (
          createdRooms.map(({ room, index }) => renderRoomCard(room, index))
        )}
      </RoomGroup>

      <RoomGroup
        title="Fixed Rooms"
        subtitle="Provisioned by the museum — always present, and never deletable."
        icon={<Lock size={14} />}
        count={fixedMirrorRooms.length + FIXED_CARD_COUNT}
        open={openGroups.fixed}
        onToggle={() => toggleGroup("fixed")}
      >
        {fixedMirrorRooms.map(({ room, index }) => renderRoomCard(room, index))}

        {/* ── Fixed "Freedom Wall" card ──────────────────────────────────── */}
        {/* A special MuseumRoom row (roomType FREEDOM_WALL) — not part of the
            regular CRUD list. Visitors pin sticky notes while inside; content
            comes from FreedomWallNote rows, not from artworks. Manage events
            and notes in the Freedom Wall sub-tab. */}
        <div className="admin-card border rounded-2xl overflow-hidden opacity-90">
          <div className="flex items-center gap-3 p-4">
            <div className="shrink-0 p-2 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
              <StickyNote size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Freedom Wall</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Interactive
                </span>
              </div>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                Sticky-note wall · Visitors pin notes directly inside the museum
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                Manage events &amp; notes in the <strong>Freedom Wall</strong> tab.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Toggle
                checked={freedomWallEnabled}
                onChange={onToggleFreedomWall}
                label="Toggle Freedom Wall room"
              />
              {/* Ground Floor / Second Floor — see docs/SecondFloorStairs_Spec.md. */}
              <button
                onClick={() => onUpdateFreedomWallFloor(freedomWallFloor === 1 ? 0 : 1)}
                className={cn(
                  "px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-colors",
                  freedomWallFloor === 1
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={freedomWallFloor === 1 ? "On the Second Floor — click to move to Ground Floor" : "On the Ground Floor — click to move to Second Floor"}
              >
                {freedomWallFloor === 1 ? "2F" : "1F"}
              </button>
              {freedomWallVisuals && (
                <button
                  onClick={() =>
                    setExpanded(expanded?.id === "freedom-wall" ? null : { id: "freedom-wall", mode: "edit" })
                  }
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    expanded?.id === "freedom-wall"
                      ? "bg-sepia/10 text-sepia"
                      : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  title="Edit wall/floor/ceiling"
                >
                  <Pencil size={14} />
                </button>
              )}
              {freedomWallRoomId && (
                <Link
                  href={`/admin/artworks/museum-editor/${freedomWallRoomId}`}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Edit scene (decorative objects)"
                >
                  <Move3d size={14} />
                </Link>
              )}
            </div>
          </div>

          {expanded?.id === "freedom-wall" && freedomWallVisuals && (
            <div className="border-t border-black/5 dark:border-white/5 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ColorField
                  label="Floor Color"
                  value={freedomWallVisuals.floorColor}
                  defaultValue={DEFAULT_FLOOR_COLOR}
                  onChange={(value) => onUpdateFreedomWallVisuals({ floorColor: value })}
                />
                <ColorField
                  label="Wall Color"
                  value={freedomWallVisuals.wallColor}
                  defaultValue={DEFAULT_WALL_COLOR}
                  onChange={(value) => onUpdateFreedomWallVisuals({ wallColor: value })}
                />
                <ColorField
                  label="Ceiling Color"
                  value={freedomWallVisuals.ceilingColor}
                  defaultValue={DEFAULT_CEILING_COLOR}
                  onChange={(value) => onUpdateFreedomWallVisuals({ ceilingColor: value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextureField
                  label="Floor Texture"
                  value={freedomWallVisuals.floorTexture}
                  onChange={(url) => onUpdateFreedomWallVisuals({ floorTexture: url })}
                />
                <TextureField
                  label="Wall Texture"
                  value={freedomWallVisuals.wallTexture}
                  onChange={(url) => onUpdateFreedomWallVisuals({ wallTexture: url })}
                />
                <TextureField
                  label="Ceiling Texture"
                  value={freedomWallVisuals.ceilingTexture}
                  onChange={(url) => onUpdateFreedomWallVisuals({ ceilingTexture: url })}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={freedomWallSplashEnabled}
                  onChange={(e) => onUpdateFreedomWallSplashEnabled(e.target.checked)}
                  className="rounded border-black/20 dark:border-white/20"
                />
                <span className="font-body text-xs text-ink dark:text-cream">
                  Show entry splash for this room
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Auto-generated "About ScriptOverNovel" room — every visitor's corridor
            always ends here (see app/(public)/gallery/museum/page.tsx +
            roomLayout.ts, which appends it after every admin-managed room,
            always last). It IS a real MuseumRoom row now (roomType "ABOUT" —
            lib/museum/aboutRoom.ts), lazily provisioned so it can carry
            Museum Scene Editor decorative-object placements, but that's the
            only thing this admin CRUD ever does with the row directly —
            there's still no name/type/description/artworks/reorder/delete
            here. Its actual content (bio, photos, skills, certificates,
            socials) is the Profile/Certificates/Skills/Social Links data
            edited on the About tab instead (same explainer as the General
            sub-tab's card). Its wall/floor/ceiling *are* editable though,
            same controls as a real room, just backed by DigitalMuseum.about*
            (aboutVisuals) rather than the row's own color columns, which go
            unused — see AboutRoomVisuals above. Rendered fixed at the bottom
            so this list actually matches the room a visitor walks through
            rather than silently omitting it. */}
        <div className="admin-card border rounded-2xl overflow-hidden opacity-90">
          <div className="flex items-center gap-3 p-4">
            <div className="shrink-0 p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <User size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">About ScriptOverNovel</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Last Room
                </span>
              </div>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                About · Auto-generated, always at the end of the corridor
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                Meet the artist behind the collection.
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {aboutVisuals && (
                <Toggle
                  checked={aboutVisuals.aboutEnabled}
                  onChange={(enabled) => onUpdateAboutVisuals({ aboutEnabled: enabled })}
                  label="Toggle About ScriptOverNovel room"
                />
              )}
              {/* Ground Floor / Second Floor — see docs/SecondFloorStairs_Spec.md.
                  Recommended to keep the visitor spawn point off the second
                  floor; this admin UI doesn't currently block it since About
                  is never the entry room anyway. */}
              <button
                onClick={() => onUpdateAboutFloor(aboutFloor === 1 ? 0 : 1)}
                className={cn(
                  "px-2 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-colors",
                  aboutFloor === 1
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={aboutFloor === 1 ? "On the Second Floor — click to move to Ground Floor" : "On the Ground Floor — click to move to Second Floor"}
              >
                {aboutFloor === 1 ? "2F" : "1F"}
              </button>
              {aboutVisuals && (
                <button
                  onClick={() =>
                    setExpanded(expanded?.id === "about" ? null : { id: "about", mode: "edit" })
                  }
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    expanded?.id === "about"
                      ? "bg-sepia/10 text-sepia"
                      : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  title="Edit wall/floor/ceiling"
                >
                  <Pencil size={14} />
                </button>
              )}
              {/* Museum Scene Editor for this room — a real MuseumRoom row
                  (roomType "ABOUT") now, so it can carry custom decorative-
                  object placements plus its own 3 movable content blocks
                  (Photo Slideshow, Bio & Skills Plaque, Certificates Strip
                  — see lib/museum/aboutRoomBlocks.ts). It never gets hung
                  artwork frames (no Manage Artworks button here). */}
              {aboutRoomId && (
                <Link
                  href={`/admin/artworks/museum-editor/${aboutRoomId}`}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Edit scene (decorative objects)"
                >
                  <Move3d size={14} />
                </Link>
              )}
              <Link
                href="/admin/about"
                className="px-3 py-1.5 rounded-lg text-xs font-jakarta text-sepia hover:bg-sepia/10 transition-colors whitespace-nowrap"
              >
                Edit content
              </Link>
            </div>
          </div>

          {expanded?.id === "about" && aboutVisuals && (
            <div className="border-t border-black/5 dark:border-white/5 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ColorField
                  label="Floor Color"
                  value={aboutVisuals.aboutFloorColor}
                  defaultValue={DEFAULT_FLOOR_COLOR}
                  onChange={(value) => onUpdateAboutVisuals({ aboutFloorColor: value })}
                />
                <ColorField
                  label="Wall Color"
                  value={aboutVisuals.aboutWallColor}
                  defaultValue={DEFAULT_WALL_COLOR}
                  onChange={(value) => onUpdateAboutVisuals({ aboutWallColor: value })}
                />
                <ColorField
                  label="Ceiling Color"
                  value={aboutVisuals.aboutCeilingColor}
                  defaultValue={DEFAULT_CEILING_COLOR}
                  onChange={(value) => onUpdateAboutVisuals({ aboutCeilingColor: value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextureField
                  label="Floor Texture"
                  value={aboutVisuals.aboutFloorTexture}
                  onChange={(url) => onUpdateAboutVisuals({ aboutFloorTexture: url })}
                />
                <TextureField
                  label="Wall Texture"
                  value={aboutVisuals.aboutWallTexture}
                  onChange={(url) => onUpdateAboutVisuals({ aboutWallTexture: url })}
                />
                <TextureField
                  label="Ceiling Texture"
                  value={aboutVisuals.aboutCeilingTexture}
                  onChange={(url) => onUpdateAboutVisuals({ aboutCeilingTexture: url })}
                />
              </div>
              {/* Same Room Splash controls as a real room's edit form above —
                  unset icon falls back to the glowing squid mark, unset title
                  falls back to "About ScriptOverNovel". */}
              <div>
                <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
                  Room Splash
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <IconPicker
                    label="Splash Icon"
                    helpText="Shown on this room's entry splash — defaults to the glowing squid mark."
                    value={aboutVisuals.aboutSplashIcon ?? ""}
                    onChange={(v) => onUpdateAboutVisuals({ aboutSplashIcon: v || null })}
                    defaultLabel="Using the default glowing squid"
                  />
                  <div>
                    <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                      Splash Title
                    </label>
                    <input
                      type="text"
                      defaultValue={aboutVisuals.aboutSplashTitle ?? ""}
                      placeholder="About ScriptOverNovel"
                      onBlur={(e) =>
                        e.target.value !== (aboutVisuals.aboutSplashTitle ?? "") &&
                        onUpdateAboutVisuals({ aboutSplashTitle: e.target.value.trim() || null })
                      }
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                      Optional — defaults to &quot;About ScriptOverNovel&quot;.
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer w-fit mt-3">
                  <input
                    type="checkbox"
                    checked={aboutVisuals.aboutSplashEnabled}
                    onChange={(e) => onUpdateAboutVisuals({ aboutSplashEnabled: e.target.checked })}
                    className="rounded border-black/20 dark:border-white/20"
                  />
                  <span className="font-body text-xs text-ink dark:text-cream">
                    Show entry splash for this room
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed "Stairs" card ────────────────────────────────────────── */}
        {/* A special MuseumRoom row (roomType STAIRS) — auto-inserted into the
            corridor by page.tsx whenever any room above sits on the Second
            Floor, and omitted otherwise (see docs/SecondFloorStairs_Spec.md).
            No enabled/floor toggle of its own — the system decides where it
            goes, not the admin — only its Floor/Wall/Ceiling Color + Texture
            are editable, same as the request that motivated this feature. */}
        <div className="admin-card border rounded-2xl overflow-hidden opacity-90">
          <div className="flex items-center gap-3 p-4">
            <div className="shrink-0 p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Landmark size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Stairs</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                  Fixed · Auto-Placed
                </span>
              </div>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                Connects Ground Floor to the Second Floor — appears only once a room is on the Second Floor
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {stairsVisuals && (
                <button
                  onClick={() => setExpanded(expanded?.id === "stairs" ? null : { id: "stairs", mode: "edit" })}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    expanded?.id === "stairs"
                      ? "bg-sepia/10 text-sepia"
                      : "text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                  title="Edit wall/floor/ceiling"
                >
                  <Pencil size={14} />
                </button>
              )}
              {stairsRoomId && (
                <Link
                  href={`/admin/artworks/museum-editor/${stairsRoomId}`}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Edit scene (decorative objects)"
                >
                  <Move3d size={14} />
                </Link>
              )}
            </div>
          </div>

          {expanded?.id === "stairs" && stairsVisuals && (
            <div className="border-t border-black/5 dark:border-white/5 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ColorField
                  label="Floor Color"
                  value={stairsVisuals.floorColor}
                  defaultValue={DEFAULT_FLOOR_COLOR}
                  onChange={(value) => onUpdateStairsVisuals({ floorColor: value })}
                />
                <ColorField
                  label="Wall Color"
                  value={stairsVisuals.wallColor}
                  defaultValue={DEFAULT_WALL_COLOR}
                  onChange={(value) => onUpdateStairsVisuals({ wallColor: value })}
                />
                <ColorField
                  label="Ceiling Color"
                  value={stairsVisuals.ceilingColor}
                  defaultValue={DEFAULT_CEILING_COLOR}
                  onChange={(value) => onUpdateStairsVisuals({ ceilingColor: value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextureField
                  label="Floor Texture"
                  value={stairsVisuals.floorTexture}
                  onChange={(url) => onUpdateStairsVisuals({ floorTexture: url })}
                />
                <TextureField
                  label="Wall Texture"
                  value={stairsVisuals.wallTexture}
                  onChange={(url) => onUpdateStairsVisuals({ wallTexture: url })}
                />
                <TextureField
                  label="Ceiling Texture"
                  value={stairsVisuals.ceilingTexture}
                  onChange={(url) => onUpdateStairsVisuals({ ceilingTexture: url })}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={stairsSplashEnabled}
                  onChange={(e) => onUpdateStairsSplashEnabled(e.target.checked)}
                  className="rounded border-black/20 dark:border-white/20"
                />
                <span className="font-body text-xs text-ink dark:text-cream">
                  Show entry splash for this room
                </span>
              </label>
            </div>
          )}
        </div>
      </RoomGroup>

      {creating ? (
        <div className="admin-card border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Room name"
              autoFocus
              className="admin-input w-full px-3 py-2 rounded-xl text-sm"
            />
            <div className="relative">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as CreatableRoomType)}
                className="admin-input w-full pl-3 pr-9 py-2 rounded-xl text-sm cursor-pointer appearance-none"
              >
                {ROOM_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={createRoom}
              disabled={!newName.trim() || saving}
              className="px-4 py-2 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
            >
              Create Room
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-4 py-2 rounded-xl text-ink-400 dark:text-ink-300 font-jakarta text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:border-black/30 dark:hover:border-white/30 transition-colors font-jakarta text-sm"
        >
          <Plus size={16} />
          New Room
        </button>
      )}

      {/* Move to Trash Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream text-center">
              Move &quot;{deleteConfirm.name}&quot; to Trash?
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-2 text-center">
              You can restore it from the Trash module at any time.
            </p>
            <div className="bg-vermillion/10 border border-vermillion/20 p-3 mb-6 text-left">
              <p className="font-body text-sm text-vermillion font-medium mb-1">
                The following will be moved to Trash:
              </p>
              <ul className="font-body text-xs text-ink-500 dark:text-ink-300 space-y-1 list-disc list-inside">
                <li>The room &quot;{deleteConfirm.name}&quot;</li>
                <li>
                  <strong>{deleteConfirm.artworks.length}</strong> artwork
                  {deleteConfirm.artworks.length !== 1 ? "s" : ""} stay in your library — only their
                  placement in this room goes away
                </li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => deleteRoom(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "Moving…" : "Move to Trash"}
              </button>
              <button
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
    </div>
  );
}
