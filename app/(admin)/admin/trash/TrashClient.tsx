"use client";

import { useState, useMemo } from "react";
import { productImage, productTitle } from "@/lib/store/product-display";
import { formatPrice } from "@/lib/utils";
import type { ReactNode } from "react";
import Image from "@/components/ui/SafeImage";
import {
  ChevronDown,
  Trash2,
  X,
  Eye,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  AlertTriangle,
  Search,
  ArrowUpDown,
  RotateCcw,
  ZoomIn,
  Megaphone,
  ScrollText,
  Bell,
  DoorOpen,
  MapPin,
  Film,
  ImageIcon,
  StickyNote,
  Calendar,
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { storyTypeLabel } from "@/lib/stories";

interface TrashedAnnouncement {
  id: string;
  title: string;
  message: string;
  isActive: boolean;
  deletedAt: string;
  createdAt: string;
}

interface TrashedMarquee {
  id: string;
  text: string;
  category: string;
  isActive: boolean;
  speed: number;
  deletedAt: string;
  createdAt: string;
}

interface TrashedArtwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  featured: boolean;
  published: boolean;
  status: string;
  sectionId: string | null;
  section: { id: string; name: string; slug: string } | null;
  product: { id: string; price: number } | null;
  deletedAt: string;
  createdAt: string;
}

interface TrashedStory {
  id: string;
  title: string;
  description: string;
  type: string;
  coverImageUrl: string;
  author: string | null;
  genre: string[];
  year: number | null;
  featured: boolean;
  published: boolean;
  slug: string | null;
  _count: { pages: number };
  deletedAt: string;
  createdAt: string;
}

// A cosplay — costume photography whose standee stands in the museum's
// Cosplay Room. Two images rather than one (the standee shot and the photo hung
// behind it), and the second is what the view modal has to be able to say is
// missing: an entry without it still shows fine, just against a bare panel.
interface TrashedCosplay {
  id: string;
  title: string;
  description: string | null;
  character: string | null;
  series: string | null;
  standeeImageUrl: string;
  backdropImageUrl: string | null;
  cosplayer: string | null;
  photographer: string | null;
  year: number | null;
  event: string | null;
  published: boolean;
  slug: string | null;
  deletedAt: string;
  createdAt: string;
}

interface TrashedProduct {
  id: string;
  artworkId: string | null;
  title: string | null;
  images: string[];
  category: string | null;
  price: number;
  stock: number;
  available: boolean;
  artwork: { id: string; title: string; imageUrl: string } | null;
  deletedAt: string;
  createdAt: string;
}

interface TrashedSection {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  coverImageUrl: string | null;
  isPublished: boolean;
  _count: { artworks: number };
  deletedAt: string;
  createdAt: string;
}

// Shared shape for the "Linked Artworks" viewer — sections and rooms both
// resolve to this same {id, title, imageUrl, published} list regardless of
// how each relates to Artwork underneath (Section has a direct one-to-many;
// MuseumRoom goes through a join table), since /api/sections/[id] and
// /api/digital-museum/rooms/[id] both flatten to it before responding.
interface LinkedArtwork {
  id: string;
  title: string;
  imageUrl: string;
  published: boolean;
}

/** Which trash categories have a "Linked Artworks" viewer at all. */
type LinkedArtworksCategory = "sections" | "rooms";

const LINKED_ARTWORKS_ENDPOINT: Record<LinkedArtworksCategory, (id: string) => string> = {
  sections: (id) => `/api/sections/${id}`,
  rooms: (id) => `/api/digital-museum/rooms/${id}`,
};

const LINKED_ARTWORKS_EMPTY_LABEL: Record<LinkedArtworksCategory, string> = {
  sections: "No artworks linked to this section",
  rooms: "No artworks linked to this room",
};

interface TrashedNotification {
  id: string;
  type: "ORDER" | "HIGHSCORE" | "CONTACT";
  title: string;
  body: string;
  metadata: { name?: string; email?: string; subjectLabel?: string; message?: string } | null;
  isSpam: boolean;
  deletedAt: string;
  createdAt: string;
}

interface TrashedRoom {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roomType: "MAIN_HALL" | "GALLERY" | "SPECIAL_EXHIBITION";
  enabled: boolean;
  isEntryRoom: boolean;
  _count: { artworks: number };
  deletedAt: string;
  createdAt: string;
}

interface TrashedEvent {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  eventDate: string | null;
  isNextEvent: boolean;
  enabled: boolean;
  media: { id: string; url: string; type: "IMAGE" | "VIDEO" }[];
  deletedAt: string;
  createdAt: string;
}

// A visitor-submitted Freedom Wall note. Unlike every other trashed row this
// one wasn't authored in the admin, so `event` (the folder it was pinned to)
// and its original `createdAt` are the two things an admin needs to judge
// whether to restore it — both are surfaced in the view modal.
interface TrashedFreedomWallNote {
  id: string;
  nickname: string;
  content: string;
  color: string;
  isArchived: boolean;
  eventId: string;
  event: { id: string; title: string } | null;
  deletedAt: string;
  createdAt: string;
}

// A whole Freedom Wall event (its folder of sticky notes), soft-deleted from
// the admin panel. Restoring brings it and every note back; purging it
// cascades the notes away for good. `_count.notes` is what comes back.
interface TrashedFreedomWallEvent {
  id: string;
  title: string;
  isArchived: boolean;
  _count: { notes: number };
  deletedAt: string;
  createdAt: string;
}

interface TrashedReleaseNote {
  id: string;
  title: string;
  body: string;
  category: string;
  version: string | null;
  isPublished: boolean;
  deletedAt: string;
  createdAt: string;
}

interface TrashedRelease {
  id: string;
  title: string;
  type: string;
  coverImageUrl: string;
  releaseDate: string | null;
  published: boolean;
  featured: boolean;
  _count: { tracks: number };
  deletedAt: string;
  createdAt: string;
}

interface TrashedVinyl {
  id: string;
  audioUrl: string;
  sideLabel: string | null;
  release: { id: string; title: string; coverImageUrl: string };
  published: boolean;
  deletedAt: string;
  createdAt: string;
}

interface TrashedVideo {
  id: string;
  title: string;
  kind: string;
  youtubeId: string;
  release: { id: string; title: string } | null;
  published: boolean;
  featured: boolean;
  deletedAt: string;
  createdAt: string;
}

interface TrashedBandMember {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  published: boolean;
  deletedAt: string;
  createdAt: string;
}

type Category =
  | "announcements"
  | "marquees"
  | "artworks"
  | "stories"
  | "cosplays"
  | "products"
  | "sections"
  | "notifications"
  | "rooms"
  | "events"
  | "freedom-wall-notes"
  | "freedom-wall-events"
  | "release-notes"
  | "releases"
  | "videos"
  | "vinyls"
  | "band-members";
// "createdAt" sorts by when the item was originally made rather than when it
// was thrown away — the two orders diverge sharply for Freedom Wall notes,
// where a whole event's worth of notes shares one deletedAt from a bulk
// delete but spans weeks of createdAt.
type SortOption = "name" | "deletedAt" | "createdAt";
type SortDir = "asc" | "desc";
type AnyTrashedItem =
  | TrashedAnnouncement
  | TrashedMarquee
  | TrashedArtwork
  | TrashedStory
  | TrashedCosplay
  | TrashedProduct
  | TrashedSection
  | TrashedNotification
  | TrashedRoom
  | TrashedEvent
  | TrashedFreedomWallNote
  | TrashedFreedomWallEvent
  | TrashedReleaseNote
  | TrashedRelease
  | TrashedVideo
  | TrashedVinyl
  | TrashedBandMember;

const ROOM_TYPE_LABEL: Record<TrashedRoom["roomType"], string> = {
  MAIN_HALL: "Main Hall",
  GALLERY: "Gallery",
  SPECIAL_EXHIBITION: "Special Exhibition",
};

// How the category tabs cluster into related groups, each rendered as its
// own bordered pill (see the Category Tabs block below) — mirrors how these
// actually relate to each other in the admin: Gallery covers the Artworks
// module (Artworks + Sections + Stories), Digital Museum owns its Rooms,
// Announcements and Marquees share the Announcements module tab, Products
// is the Sales module, Events is the Timeline module, etc.
const CATEGORY_GROUPS: { label: string; keys: Category[] }[] = [
  { label: "Notifications", keys: ["notifications"] },
  { label: "Music", keys: ["releases", "videos", "vinyls"] },
  { label: "Museum & Archive", keys: ["artworks", "sections", "stories", "cosplays"] },
  { label: "Digital Museum", keys: ["rooms"] },
  { label: "Freedom Wall", keys: ["freedom-wall-events", "freedom-wall-notes"] },
  { label: "Announcements", keys: ["announcements", "marquees"] },
  { label: "Store", keys: ["products"] },
  { label: "Band", keys: ["band-members", "events"] },
  { label: "Settings", keys: ["release-notes"] },
];

const PAGE_SIZE = 10;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Full timestamp, used where the exact minute matters — a Freedom Wall note's
// submission time, which is the only ordering visitors and admins share.
function formatDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getItemName(item: AnyTrashedItem, cat: Category): string {
  switch (cat) {
    case "announcements":
      return (item as TrashedAnnouncement).title;
    case "marquees": {
      const t = (item as TrashedMarquee).text;
      return t.length > 60 ? t.slice(0, 60) + "…" : t;
    }
    case "artworks":
      return (item as TrashedArtwork).title;
    case "stories":
      return (item as TrashedStory).title;
    case "cosplays": {
      const c = item as TrashedCosplay;
      // The character is what the standee's plaque reads, so it is what an
      // admin recognises the row by; the title is the fallback.
      return c.character || c.title;
    }
    case "products":
      return productTitle(item as TrashedProduct) ?? "Untitled product";
    case "sections":
      return (item as TrashedSection).name;
    case "notifications":
      return (item as TrashedNotification).title;
    case "rooms":
      return (item as TrashedRoom).name;
    case "events":
      return (item as TrashedEvent).title;
    case "freedom-wall-notes": {
      // Notes have no title — the search box and the row heading both use
      // the note's own text, trimmed the same way marquees are.
      const c = (item as TrashedFreedomWallNote).content;
      return c.length > 60 ? c.slice(0, 60) + "…" : c;
    }
    case "freedom-wall-events":
      return (item as TrashedFreedomWallEvent).title;
    case "release-notes":
      return (item as TrashedReleaseNote).title;
    case "releases":
      return (item as TrashedRelease).title;
    case "videos":
      return (item as TrashedVideo).title;
    case "vinyls":
      return (item as TrashedVinyl).release.title;
    case "band-members":
      return (item as TrashedBandMember).name;
  }
}

function getItemSubtext(item: AnyTrashedItem, cat: Category): string {
  switch (cat) {
    case "announcements": {
      const m = (item as TrashedAnnouncement).message;
      return m.length > 60 ? m.slice(0, 60) + "…" : m;
    }
    case "marquees": {
      const m = item as TrashedMarquee;
      return `${m.category} · ${m.speed}s loop`;
    }
    case "artworks": {
      const a = item as TrashedArtwork;
      return a.section ? `Section: ${a.section.name}` : "No section";
    }
    case "stories": {
      const s = item as TrashedStory;
      return `${storyTypeLabel(s.type)} · ${s._count.pages} page${s._count.pages !== 1 ? "s" : ""}`;
    }
    case "cosplays": {
      const c = item as TrashedCosplay;
      return [c.series, c.event, c.year].filter(Boolean).join(" · ") || c.title;
    }
    case "products": {
      const p = item as TrashedProduct;
      return `${formatPrice(p.price)} · Stock: ${p.stock}${p.artwork ? " · from artwork" : ""}`;
    }
    case "sections": {
      const s = item as TrashedSection;
      return `${s._count.artworks} artwork${s._count.artworks !== 1 ? "s" : ""}`;
    }
    case "notifications": {
      const n = item as TrashedNotification;
      return n.type === "CONTACT" && n.metadata?.email
        ? `From ${n.metadata.email}`
        : n.body.length > 60
          ? n.body.slice(0, 60) + "…"
          : n.body;
    }
    case "rooms": {
      const r = item as TrashedRoom;
      return `${ROOM_TYPE_LABEL[r.roomType]} · ${r._count.artworks} artwork${r._count.artworks !== 1 ? "s" : ""}`;
    }
    case "events": {
      const e = item as TrashedEvent;
      const when = e.eventDate ? formatDate(e.eventDate) : "No date";
      return e.venueName ? `${e.venueName} · ${when}` : when;
    }
    case "freedom-wall-notes": {
      const n = item as TrashedFreedomWallNote;
      return `${n.event?.title ?? "Deleted event"} · ${n.nickname} · ${formatDateTime(n.createdAt)}`;
    }
    case "freedom-wall-events": {
      const e = item as TrashedFreedomWallEvent;
      const notes = `${e._count.notes} note${e._count.notes !== 1 ? "s" : ""}`;
      return e.isArchived ? `${notes} · Was archived` : notes;
    }
    case "release-notes": {
      const n = item as TrashedReleaseNote;
      // The category it was filed under plus its version, which is what
      // distinguishes two notes that happen to share a headline.
      return [n.category, n.version, n.isPublished ? null : "Draft"]
        .filter(Boolean)
        .join(" · ");
    }
    case "releases": {
      const r = item as TrashedRelease;
      const kind = r.type.charAt(0) + r.type.slice(1).toLowerCase();
      return `${kind} · ${r._count.tracks} track${r._count.tracks !== 1 ? "s" : ""}${r.releaseDate ? ` · ${formatDate(r.releaseDate)}` : ""}`;
    }
    case "videos": {
      const v = item as TrashedVideo;
      const kind = v.kind.replace(/_/g, " ").toLowerCase();
      return v.release ? `${kind} · ${v.release.title}` : kind;
    }
    case "vinyls": {
      const v = item as TrashedVinyl;
      return v.sideLabel ? `Vinyl · ${v.sideLabel}` : "Vinyl";
    }
    case "band-members":
      return (item as TrashedBandMember).role;
  }
}

function getItemImage(item: AnyTrashedItem, cat: Category): string | null {
  switch (cat) {
    case "artworks":
      return (item as TrashedArtwork).imageUrl || null;
    case "vinyls":
      return (item as TrashedVinyl).release.coverImageUrl || null;
    case "stories":
      return (item as TrashedStory).coverImageUrl || null;
    case "cosplays":
      return (item as TrashedCosplay).standeeImageUrl || null;
    case "products":
      return productImage(item as TrashedProduct);
    case "sections":
      return (item as TrashedSection).coverImageUrl;
    case "events":
      return (item as TrashedEvent).media.find((m) => m.type === "IMAGE")?.url ?? null;
    default:
      return null;
  }
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-ink-400 shrink-0">{label}:</span>
      <span className="text-right font-medium text-ink dark:text-cream max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

function ViewModalFields({
  item,
  category,
  onViewArtworks,
  onViewEventMedia,
}: {
  item: AnyTrashedItem;
  category: Category;
  onViewArtworks: (category: LinkedArtworksCategory, id: string, name: string) => void;
  onViewEventMedia: (event: TrashedEvent) => void;
}) {
  switch (category) {
    case "announcements": {
      const a = item as TrashedAnnouncement;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{a.title}</span>}
          />
          <FieldRow
            label="Message"
            value={<span className="text-xs">{a.message}</span>}
          />
          <FieldRow label="Status" value={a.isActive ? "Active" : "Inactive"} />
        </>
      );
    }
    case "marquees": {
      const m = item as TrashedMarquee;
      return (
        <>
          <FieldRow
            label="Text"
            value={<span className="font-semibold">{m.text}</span>}
          />
          <FieldRow label="Category" value={m.category} />
          <FieldRow label="Speed" value={`${m.speed}s per loop`} />
          <FieldRow label="Status" value={m.isActive ? "Active" : "Inactive"} />
        </>
      );
    }
    case "artworks": {
      const a = item as TrashedArtwork;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{a.title}</span>}
          />
          <FieldRow label="Section" value={a.section?.name ?? "None"} />
          {a.medium && <FieldRow label="Medium" value={a.medium} />}
          {a.year && <FieldRow label="Year" value={a.year} />}
          {a.dimensions && <FieldRow label="Dimensions" value={a.dimensions} />}
          <FieldRow label="Status" value={a.status} />
          <FieldRow label="Published" value={a.published ? "Yes" : "No"} />
          {a.product && (
            <FieldRow
              label="Listed Price"
              value={`$${a.product.price.toFixed(2)}`}
            />
          )}
        </>
      );
    }
    case "stories": {
      const s = item as TrashedStory;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{s.title}</span>}
          />
          <FieldRow label="Type" value={storyTypeLabel(s.type)} />
          {s.author && <FieldRow label="Author" value={s.author} />}
          {s.year && <FieldRow label="Year" value={s.year} />}
          <FieldRow
            label="Pages"
            value={`${s._count.pages} page${s._count.pages !== 1 ? "s" : ""}`}
          />
          {s.genre.length > 0 && <FieldRow label="Genre" value={s.genre.join(", ")} />}
          <FieldRow label="Published" value={s.published ? "Yes" : "No"} />
          {s.featured && <FieldRow label="Featured" value="Yes" />}
        </>
      );
    }
    case "cosplays": {
      const c = item as TrashedCosplay;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{c.title}</span>}
          />
          {c.character && <FieldRow label="Character" value={c.character} />}
          {c.series && <FieldRow label="Series" value={c.series} />}
          {c.event && <FieldRow label="Event" value={c.event} />}
          {c.year && <FieldRow label="Year" value={c.year} />}
          {c.cosplayer && <FieldRow label="Cosplayer" value={c.cosplayer} />}
          {c.photographer && <FieldRow label="Photographer" value={c.photographer} />}
          <FieldRow
            label="Backdrop Photo"
            value={c.backdropImageUrl ? "Yes" : "None"}
          />
          <FieldRow label="Published" value={c.published ? "Yes" : "No"} />
        </>
      );
    }
    case "products": {
      const p = item as TrashedProduct;
      return (
        <>
          <FieldRow
            label="Artwork"
            value={
              <span className="font-semibold">
                {p.artwork?.title ?? "Unknown"}
              </span>
            }
          />
          <FieldRow label="Price" value={`$${p.price.toFixed(2)}`} />
          <FieldRow label="Stock" value={p.stock} />
          <FieldRow label="Available" value={p.available ? "Yes" : "No"} />
        </>
      );
    }
    case "sections": {
      const s = item as TrashedSection;
      return (
        <>
          <FieldRow
            label="Name"
            value={<span className="font-semibold">{s.name}</span>}
          />
          <FieldRow
            label="Slug"
            value={<span className="font-jakarta text-xs">{s.slug}</span>}
          />
          <FieldRow label="Display Order" value={`#${s.displayOrder}`} />
          <FieldRow
            label="Linked Artworks"
            value={
              <button
                type="button"
                onClick={() => onViewArtworks("sections", s.id, s.name)}
                className="font-semibold text-sepia hover:underline underline-offset-2 transition-colors"
                title="View linked artworks"
              >
                {s._count.artworks} item(s)
              </button>
            }
          />
          <FieldRow
            label="Visibility"
            value={s.isPublished ? "Published" : "Hidden"}
          />
        </>
      );
    }
    case "notifications": {
      const n = item as TrashedNotification;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{n.title}</span>}
          />
          <FieldRow label="Category" value={n.type} />
          {n.type === "CONTACT" && n.metadata?.name && (
            <FieldRow label="From" value={n.metadata.name} />
          )}
          {n.type === "CONTACT" && n.metadata?.email && (
            <FieldRow label="Email" value={n.metadata.email} />
          )}
          {n.type === "CONTACT" && n.metadata?.subjectLabel && (
            <FieldRow label="Subject" value={n.metadata.subjectLabel} />
          )}
          <FieldRow
            label="Message"
            value={
              <span className="text-xs whitespace-pre-line">
                {n.type === "CONTACT" && n.metadata?.message ? n.metadata.message : n.body}
              </span>
            }
          />
          {n.isSpam && <FieldRow label="Flagged" value="Spam" />}
        </>
      );
    }
    case "rooms": {
      const r = item as TrashedRoom;
      return (
        <>
          <FieldRow
            label="Name"
            value={<span className="font-semibold">{r.name}</span>}
          />
          <FieldRow label="Type" value={ROOM_TYPE_LABEL[r.roomType]} />
          <FieldRow
            label="Linked Artworks"
            value={
              <button
                type="button"
                onClick={() => onViewArtworks("rooms", r.id, r.name)}
                className="font-semibold text-sepia hover:underline underline-offset-2 transition-colors"
                title="View linked artworks"
              >
                {r._count.artworks} item(s)
              </button>
            }
          />
          <FieldRow label="Was Enabled" value={r.enabled ? "Yes" : "No"} />
          {r.isEntryRoom && <FieldRow label="Entry Room" value="Yes" />}
        </>
      );
    }
    case "events": {
      const e = item as TrashedEvent;
      return (
        <>
          <FieldRow
            label="Title"
            value={<span className="font-semibold">{e.title}</span>}
          />
          <FieldRow label="Venue" value={e.venueName ?? "—"} />
          <FieldRow label="Date" value={e.eventDate ? formatDate(e.eventDate) : "—"} />
          {e.description && (
            <FieldRow label="Description" value={<span className="text-xs">{e.description}</span>} />
          )}
          <FieldRow
            label="Media"
            value={
              e.media.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onViewEventMedia(e)}
                  className="font-semibold text-sepia hover:underline underline-offset-2 transition-colors"
                  title="View media"
                >
                  {e.media.length} item(s)
                </button>
              ) : (
                "0 item(s)"
              )
            }
          />
          <FieldRow label="Was Enabled" value={e.enabled ? "Yes" : "No"} />
          {e.isNextEvent && <FieldRow label="Next Event" value="Yes" />}
        </>
      );
    }
    case "freedom-wall-notes": {
      const n = item as TrashedFreedomWallNote;
      return (
        <>
          <FieldRow
            label="Note"
            value={<span className="text-xs whitespace-pre-wrap">{n.content}</span>}
          />
          <FieldRow label="Nickname" value={n.nickname} />
          <FieldRow
            label="Event"
            value={
              n.event ? (
                <span className="font-semibold">{n.event.title}</span>
              ) : (
                // The event row is gone (purged from Trash), but the note
                // survived because FreedomWallNote cascades only on a real
                // delete — say so rather than showing a blank.
                <span className="text-ink-400">Event no longer exists</span>
              )
            }
          />
          <FieldRow label="Colour" value={<span className="capitalize">{n.color}</span>} />
          <FieldRow label="Submitted" value={formatDateTime(n.createdAt)} />
          {n.isArchived && <FieldRow label="Was Archived" value="Yes" />}
        </>
      );
    }
    case "freedom-wall-events": {
      const e = item as TrashedFreedomWallEvent;
      return (
        <>
          <FieldRow label="Title" value={<span className="font-semibold">{e.title}</span>} />
          <FieldRow
            label="Notes"
            value={`${e._count.notes} note${e._count.notes !== 1 ? "s" : ""} — restored with the event`}
          />
          <FieldRow label="Created" value={formatDate(e.createdAt)} />
          {e.isArchived && <FieldRow label="Was Archived" value="Yes" />}
        </>
      );
    }
    case "release-notes": {
      // The note as it was written — headline, where it was filed, its
      // version, whether visitors had seen it, and the body in full. This
      // case was missing, so View showed only the id and the deleted date.
      const n = item as TrashedReleaseNote;
      return (
        <>
          <FieldRow label="Title" value={<span className="font-semibold">{n.title}</span>} />
          <FieldRow label="Category" value={n.category} />
          {n.version && <FieldRow label="Version" value={n.version} />}
          <FieldRow label="Status" value={n.isPublished ? "Published" : "Draft"} />
          <FieldRow label="Created" value={formatDate(n.createdAt)} />
          <div className="pt-2">
            <p className="text-ink-400 mb-1">Body:</p>
            <p className="font-medium text-ink dark:text-cream whitespace-pre-wrap break-words leading-relaxed">
              {n.body}
            </p>
          </div>
        </>
      );
    }
    case "releases": {
      const r = item as TrashedRelease;
      return (
        <>
          <FieldRow label="Title" value={<span className="font-semibold">{r.title}</span>} />
          <FieldRow label="Type" value={r.type.charAt(0) + r.type.slice(1).toLowerCase()} />
          {r.releaseDate && <FieldRow label="Released" value={formatDate(r.releaseDate)} />}
          <FieldRow label="Tracks" value={String(r._count.tracks)} />
          <FieldRow label="Status" value={r.published ? (r.featured ? "Published · Featured" : "Published") : "Hidden"} />
          <FieldRow label="Created" value={formatDate(r.createdAt)} />
        </>
      );
    }
    case "videos": {
      const v = item as TrashedVideo;
      return (
        <>
          <FieldRow label="Title" value={<span className="font-semibold">{v.title}</span>} />
          <FieldRow label="Kind" value={v.kind.replace(/_/g, " ").toLowerCase()} />
          {v.release && <FieldRow label="Release" value={v.release.title} />}
          <FieldRow label="YouTube" value={<a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer" className="underline">{v.youtubeId}</a>} />
          <FieldRow label="Status" value={v.published ? (v.featured ? "Published · Featured" : "Published") : "Hidden"} />
          <FieldRow label="Created" value={formatDate(v.createdAt)} />
        </>
      );
    }
    case "vinyls": {
      const v = item as TrashedVinyl;
      return (
        <>
          <FieldRow label="Release" value={<span className="font-semibold">{v.release.title}</span>} />
          {v.sideLabel && <FieldRow label="Side" value={v.sideLabel} />}
          <FieldRow label="Audio" value={<a href={v.audioUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">{v.audioUrl.split("/").pop()}</a>} />
          <FieldRow label="Status" value={v.published ? "Published" : "Hidden"} />
          <FieldRow label="Created" value={formatDate(v.createdAt)} />
        </>
      );
    }
    case "band-members": {
      const m = item as TrashedBandMember;
      return (
        <>
          <FieldRow label="Name" value={<span className="font-semibold">{m.name}</span>} />
          <FieldRow label="Role" value={m.role} />
          <FieldRow label="Status" value={m.published ? "Shown" : "Hidden"} />
          <FieldRow label="Created" value={formatDate(m.createdAt)} />
        </>
      );
    }
  }
}

export function TrashClient({
  initialAnnouncements,
  initialMarquees,
  initialArtworks,
  initialStories,
  initialCosplays,
  initialProducts,
  initialSections,
  initialNotifications,
  initialRooms,
  initialEvents,
  initialFreedomWallNotes,
  initialFreedomWallEvents,
  initialReleaseNotes,
  initialReleases,
  initialVideos,
  initialVinyls,
  initialBandMembers,
}: {
  initialAnnouncements: TrashedAnnouncement[];
  initialMarquees: TrashedMarquee[];
  initialArtworks: TrashedArtwork[];
  initialStories: TrashedStory[];
  initialCosplays: TrashedCosplay[];
  initialProducts: TrashedProduct[];
  initialSections: TrashedSection[];
  initialNotifications: TrashedNotification[];
  initialRooms: TrashedRoom[];
  initialEvents: TrashedEvent[];
  initialFreedomWallNotes: TrashedFreedomWallNote[];
  initialFreedomWallEvents: TrashedFreedomWallEvent[];
  initialReleaseNotes: TrashedReleaseNote[];
  initialReleases: TrashedRelease[];
  initialVideos: TrashedVideo[];
  initialVinyls: TrashedVinyl[];
  initialBandMembers: TrashedBandMember[];
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [marquees, setMarquees] = useState(initialMarquees);
  const [artworks, setArtworks] = useState(initialArtworks);
  const [stories, setStories] = useState(initialStories);
  const [cosplays, setCosplays] = useState(initialCosplays);
  const [products, setProducts] = useState(initialProducts);
  const [sections, setSections] = useState(initialSections);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [rooms, setRooms] = useState(initialRooms);
  const [events, setEvents] = useState(initialEvents);
  const [freedomWallNotes, setFreedomWallNotes] = useState(initialFreedomWallNotes);
  const [freedomWallEvents, setFreedomWallEvents] = useState(initialFreedomWallEvents);
  const [releaseNotes, setReleaseNotes] = useState(initialReleaseNotes);
  const [releases, setReleases] = useState(initialReleases);
  const [videos, setVideos] = useState(initialVideos);
  const [vinyls, setVinyls] = useState(initialVinyls);
  const [bandMembers, setBandMembers] = useState(initialBandMembers);

  const [activeCategory, setActiveCategory] = useState<Category>("artworks");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("deletedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);

  const [viewingItem, setViewingItem] = useState<AnyTrashedItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AnyTrashedItem | null>(
    null
  );
  function openDeleteConfirm(item: AnyTrashedItem) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(item);
  }
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Linked Artworks Modal State — opened from the "Linked Artworks" field of
  // a trashed section or room (see LinkedArtworksCategory).
  const [artworksModal, setArtworksModal] = useState<{
    category: LinkedArtworksCategory;
    id: string;
    name: string;
  } | null>(null);
  const [linkedArtworks, setLinkedArtworks] = useState<LinkedArtwork[]>([]);
  const [loadingLinkedArtworks, setLoadingLinkedArtworks] = useState(false);

  // Event Media Modal — same "clickable count opens a viewer" idea as the
  // Linked Artworks modal above, but for a trashed event's photos/videos.
  // No fetch needed (unlike Linked Artworks) — the media list already
  // travels with the trashed event row from GET /api/trash.
  const [eventMediaModal, setEventMediaModal] = useState<TrashedEvent | null>(null);
  // "Empty this tab" confirmation. Holds the category rather than a boolean so
  // the modal can name what is about to go and can't be left pointing at a tab
  // the admin has since switched away from.
  const [emptyConfirm, setEmptyConfirm] = useState<Category | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useLockBodyScroll(
    Boolean(viewingItem) ||
      Boolean(deleteConfirm) ||
      Boolean(previewImage) ||
      Boolean(artworksModal) ||
      Boolean(eventMediaModal) ||
      Boolean(emptyConfirm)
  );

  // Fetch and display the artworks linked to a (possibly trashed) section
  // or room — same GET-by-id endpoint each already has for its own admin
  // tab, which resolves fine regardless of deletedAt (a plain findUnique by
  // id, no enabled/deletedAt filter), so this works from the Trash module
  // exactly as it would from the live tab.
  async function openLinkedArtworks(category: LinkedArtworksCategory, id: string, name: string) {
    setArtworksModal({ category, id, name });
    setLinkedArtworks([]);
    setLoadingLinkedArtworks(true);
    try {
      const res = await fetch(LINKED_ARTWORKS_ENDPOINT[category](id));
      if (!res.ok) throw new Error("Failed to load artworks");
      const data = await res.json();
      setLinkedArtworks(data.artworks || []);
    } catch {
      toast.error("Failed to load linked artworks");
    } finally {
      setLoadingLinkedArtworks(false);
    }
  }

  const currentItems: AnyTrashedItem[] = useMemo(() => {
    switch (activeCategory) {
      case "announcements":
        return announcements;
      case "marquees":
        return marquees;
      case "artworks":
        return artworks;
      case "stories":
        return stories;
      case "cosplays":
        return cosplays;
      case "products":
        return products;
      case "sections":
        return sections;
      case "notifications":
        return notifications;
      case "rooms":
        return rooms;
      case "events":
        return events;
      case "freedom-wall-notes":
        return freedomWallNotes;
      case "freedom-wall-events":
        return freedomWallEvents;
      case "release-notes":
        return releaseNotes;
      case "releases":
        return releases;
      case "videos":
        return videos;
      case "vinyls":
        return vinyls;
      case "band-members":
        return bandMembers;
    }
  }, [activeCategory, announcements, marquees, artworks, stories, cosplays, products, sections, notifications, rooms, events, freedomWallNotes, freedomWallEvents, releaseNotes, releases, videos, vinyls, bandMembers]);

  const processedItems = useMemo(() => {
    return currentItems
      .filter((item) => {
        if (!searchQuery.trim()) return true;
        return getItemName(item, activeCategory)
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        let cmp: number;
        if (sortBy === "name") {
          cmp = getItemName(a, activeCategory).localeCompare(
            getItemName(b, activeCategory)
          );
        } else {
          const key = sortBy === "createdAt" ? "createdAt" : "deletedAt";
          cmp = new Date(a[key]).getTime() - new Date(b[key]).getTime();
        }
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [currentItems, searchQuery, sortBy, sortDir, activeCategory]);

  const totalPages = Math.ceil(processedItems.length / PAGE_SIZE);
  const paginatedItems = processedItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  function switchCategory(cat: Category) {
    setActiveCategory(cat);
    setCurrentPage(1);
    setSearchQuery("");
  }

  function removeFromState(id: string) {
    switch (activeCategory) {
      case "announcements":
        setAnnouncements((p) => p.filter((i) => i.id !== id));
        break;
      case "marquees":
        setMarquees((p) => p.filter((i) => i.id !== id));
        break;
      case "artworks":
        setArtworks((p) => p.filter((i) => i.id !== id));
        break;
      case "stories":
        setStories((p) => p.filter((i) => i.id !== id));
        break;
      case "cosplays":
        setCosplays((p) => p.filter((i) => i.id !== id));
        break;
      case "products":
        setProducts((p) => p.filter((i) => i.id !== id));
        break;
      case "sections":
        setSections((p) => p.filter((i) => i.id !== id));
        break;
      case "notifications":
        setNotifications((p) => p.filter((i) => i.id !== id));
        break;
      case "rooms":
        setRooms((p) => p.filter((i) => i.id !== id));
        break;
      case "events":
        setEvents((p) => p.filter((i) => i.id !== id));
        break;
      case "freedom-wall-notes":
        setFreedomWallNotes((p) => p.filter((i) => i.id !== id));
        break;
      case "freedom-wall-events":
        setFreedomWallEvents((p) => p.filter((i) => i.id !== id));
        break;
      case "release-notes":
        setReleaseNotes((p) => p.filter((i) => i.id !== id));
        break;
      case "releases":
        setReleases((p) => p.filter((i) => i.id !== id));
        break;
      case "videos":
        setVideos((p) => p.filter((i) => i.id !== id));
        break;
      case "vinyls":
        setVinyls((p) => p.filter((i) => i.id !== id));
        break;
      case "band-members":
        setBandMembers((p) => p.filter((i) => i.id !== id));
        break;
    }
  }

  /** Empties the active tab's list in one go — the local half of the bulk
   *  actions below, so the table clears without a refetch. */
  function clearCategoryState(cat: Category) {
    switch (cat) {
      case "announcements": setAnnouncements([]); break;
      case "marquees": setMarquees([]); break;
      case "artworks": setArtworks([]); break;
      case "stories": setStories([]); break;
      case "cosplays": setCosplays([]); break;
      case "products": setProducts([]); break;
      case "sections": setSections([]); break;
      case "notifications": setNotifications([]); break;
      case "rooms": setRooms([]); break;
      case "events": setEvents([]); break;
      case "freedom-wall-notes": setFreedomWallNotes([]); break;
      case "freedom-wall-events": setFreedomWallEvents([]); break;
      case "release-notes": setReleaseNotes([]); break;
      case "releases": setReleases([]); break;
      case "videos": setVideos([]); break;
      case "vinyls": setVinyls([]); break;
      case "band-members": setBandMembers([]); break;
    }
  }

  async function handleRestore(item: AnyTrashedItem) {
    setActionLoading(`restore-${item.id}`);
    try {
      const res = await fetch(`/api/trash/${activeCategory}/${item.id}`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error();
      removeFromState(item.id);
      setViewingItem(null);
      toast.success(`"${getItemName(item, activeCategory)}" restored`);
    } catch {
      toast.error("Failed to restore item");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePermanentDelete(item: AnyTrashedItem) {
    setActionLoading(`delete-${item.id}`);
    try {
      const res = await fetch(`/api/trash/${activeCategory}/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      removeFromState(item.id);
      setDeleteConfirm(null);
      setViewingItem(null);
      toast.success(
        `"${getItemName(item, activeCategory)}" permanently deleted`
      );
    } catch {
      toast.error("Failed to permanently delete item");
    } finally {
      setActionLoading(null);
    }
  }

  /** Restore every row in the active tab. Non-destructive — anything restored
   *  can simply be deleted again — so it acts on click rather than behind a
   *  confirmation, the way the per-row Restore button already does. */
  async function handleRestoreAll() {
    const label = CATEGORY_LABEL[activeCategory].toLowerCase();
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/trash/${activeCategory}`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      const { done, failed } = (await res.json()) as { done: number; failed: number };
      clearCategoryState(activeCategory);
      setViewingItem(null);
      toast.success(
        failed > 0
          ? `Restored ${done} ${label} — ${failed} could not be restored`
          : `Restored ${done} ${label}`
      );
    } catch {
      toast.error("Failed to restore items");
    } finally {
      setBulkBusy(false);
    }
  }

  /** Destroy every row in the active tab. Irreversible, so this only runs from
   *  the confirmation modal below. */
  async function handleEmptyCategory() {
    const cat = emptyConfirm;
    if (!cat) return;
    const label = CATEGORY_LABEL[cat].toLowerCase();
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/trash/${cat}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const { done, failed } = (await res.json()) as { done: number; failed: number };
      clearCategoryState(cat);
      setViewingItem(null);
      setEmptyConfirm(null);
      toast.success(
        failed > 0
          ? `Permanently deleted ${done} ${label} — ${failed} were already gone`
          : `Permanently deleted ${done} ${label}`
      );
    } catch {
      toast.error("Failed to empty this tab");
    } finally {
      setBulkBusy(false);
    }
  }

  const CATEGORY_LABEL: Record<Category, string> = {
    notifications: "Notifications",
    artworks: "Museum Pieces",
    stories: "Tales",
    cosplays: "Cosplays",
    rooms: "Rooms",
    sections: "Sections",
    products: "Products",
    announcements: "Announcements",
    marquees: "Marquees",
    events: "Events",
    "freedom-wall-notes": "Sticky Notes",
    "freedom-wall-events": "Events",
    "release-notes": "Release Notes",
    releases: "Releases",
    videos: "Videos",
    vinyls: "Vinyls",
    "band-members": "Band Members",
  };

  // Singular noun for the row-detail heading and the permanent-delete copy —
  // the hyphenated slugs don't survive a bare `.slice(0, -1)`.
  const CATEGORY_SINGULAR: Record<Category, string> = {
    notifications: "notification",
    artworks: "piece",
    stories: "tale",
    cosplays: "cosplay",
    rooms: "room",
    sections: "section",
    products: "product",
    announcements: "announcement",
    marquees: "marquee",
    events: "event",
    "freedom-wall-notes": "sticky note",
    "freedom-wall-events": "event",
    "release-notes": "release note",
    releases: "release",
    videos: "video",
    vinyls: "vinyl",
    "band-members": "band member",
  };

  const CATEGORY_COUNT: Record<Category, number> = {
    notifications: notifications.length,
    artworks: artworks.length,
    stories: stories.length,
    cosplays: cosplays.length,
    rooms: rooms.length,
    sections: sections.length,
    products: products.length,
    announcements: announcements.length,
    marquees: marquees.length,
    events: events.length,
    "freedom-wall-notes": freedomWallNotes.length,
    "freedom-wall-events": freedomWallEvents.length,
    "release-notes": releaseNotes.length,
    releases: releases.length,
    videos: videos.length,
    vinyls: vinyls.length,
    "band-members": bandMembers.length,
  };

  return (
    <>
      {/* Category Tabs — grouped into related clusters (each its own
          bordered/segmented pill) rather than one flat row of buttons, so
          e.g. Rooms reads as "part of the Digital Museum" instead of
          sitting unexplained next to Products. On mobile each group pill
          spans the full width and its buttons split the row evenly, so the
          rows stay a consistent height with no ragged empty gaps; from sm
          up they shrink to content and flow inline. */}
      <div className="mb-6 flex flex-wrap gap-2 sm:gap-3">
        {CATEGORY_GROUPS.map((group) => (
          <div
            key={group.label}
            className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.02] w-full sm:w-auto"
          >
            <span className="pl-1.5 pr-2 font-body text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-300 select-none shrink-0">
              {group.label}
            </span>
            {group.keys.map((key) => (
              <button
                key={key}
                onClick={() => switchCategory(key)}
                className={`font-body text-xs px-3 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 flex-1 sm:flex-none ${
                  activeCategory === key
                    ? "bg-sepia text-white font-medium"
                    : "text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5 hover:text-ink dark:hover:text-cream"
                }`}
              >
                {CATEGORY_LABEL[key]}
                {/* The count was the one number in the admin set in font-mono,
                    which read as a code value rather than a tally. Jakarta +
                    tabular-nums is what every other count here uses (the Sales
                    step badges, the dashboard stats), and the fixed-width
                    digits stop the tab jumping as a count crosses 9 to 10. */}
                <span
                  className={`font-jakarta text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                    activeCategory === key
                      ? "bg-white/20"
                      : "bg-black/5 dark:bg-white/10"
                  }`}
                >
                  {CATEGORY_COUNT[key]}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center backdrop-blur-md shadow-sm">
        <div className="relative flex-1 sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={`Search ${activeCategory}...`}
            className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto">
          <div className="relative flex flex-1 sm:flex-none items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5">
            <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="flex-1 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
            >
              <option value="deletedAt" className="bg-white dark:bg-ink-900">
                Date Deleted
              </option>
              <option value="createdAt" className="bg-white dark:bg-ink-900">
                Date Created
              </option>
              <option value="name" className="bg-white dark:bg-ink-900">
                Name
              </option>
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className="p-2 rounded-xl admin-input border text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )}
          </button>
        </div>
      </div>

      {/* Bulk actions — scoped to the tab on screen, never the whole Trash.
          Hidden when the tab is empty: two disabled buttons over an empty
          table is just clutter. Restore All acts straight away (anything
          restored can be deleted again); Empty goes through the confirmation
          below, because that one cannot be undone. */}
      {CATEGORY_COUNT[activeCategory] > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRestoreAll}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl admin-input border text-ink dark:text-cream font-jakarta text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Restore All {CATEGORY_LABEL[activeCategory]}
          </button>
          <button
            type="button"
            onClick={() => {
              playSoundEffect("admin.deleteConfirm");
              setEmptyConfirm(activeCategory);
            }}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500 font-jakarta text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            Empty {CATEGORY_LABEL[activeCategory]}
          </button>
          <span className="font-body text-[11px] text-ink-400 dark:text-ink-300">
            Applies to this tab only.
          </span>
        </div>
      )}

      {/* Count line */}
      <div className="mb-4 font-body text-xs text-ink-400 dark:text-ink-300 px-1">
        Showing{" "}
        <strong className="text-ink dark:text-cream">
          {processedItems.length}
        </strong>{" "}
        of{" "}
        <strong className="text-ink dark:text-cream">
          {currentItems.length}
        </strong>{" "}
        trashed {activeCategory}
      </div>

      {/* Table / Empty State */}
      {processedItems.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <Trash2 className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-jakarta font-medium text-ink dark:text-cream mb-1">
              {currentItems.length === 0
                ? `No trashed ${activeCategory}`
                : "No matching items"}
            </h3>
            <p className="text-sm font-body text-ink-400 dark:text-ink-300 max-w-md mx-auto">
              {currentItems.length === 0
                ? `Deleted ${activeCategory} will appear here for recovery.`
                : "Try adjusting your search query."}
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold">Preview</th>
                  <th className="py-4 px-6 font-semibold">Name / Details</th>
                  <th className="py-4 px-6 font-semibold">Deleted On</th>
                  <th className="py-4 px-6 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {paginatedItems.map((item) => {
                  const name = getItemName(item, activeCategory);
                  const imgUrl = getItemImage(item, activeCategory);
                  const isRestoring = actionLoading === `restore-${item.id}`;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-6 w-24">
                        {imgUrl ? (
                          <div
                            onClick={() => setViewingItem(item)}
                            className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                          >
                            <Image
                              src={imgUrl}
                              alt={name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => setViewingItem(item)}
                            className="w-14 h-14 rounded-lg border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0 cursor-pointer"
                          >
                            {activeCategory === "announcements" ? (
                              <Megaphone size={18} />
                            ) : activeCategory === "marquees" ? (
                              <ScrollText size={18} />
                            ) : activeCategory === "notifications" ? (
                              <Bell size={18} />
                            ) : activeCategory === "rooms" ? (
                              <DoorOpen size={18} />
                            ) : activeCategory === "events" ? (
                              <MapPin size={18} />
                            ) : activeCategory === "freedom-wall-notes" ? (
                              <StickyNote size={18} />
                            ) : activeCategory === "freedom-wall-events" ? (
                              <Calendar size={18} />
                            ) : (
                              <FolderOpen size={18} />
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6 max-w-xs">
                        <div
                          onClick={() => setViewingItem(item)}
                          className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                        >
                          {name}
                        </div>
                        <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                          {getItemSubtext(item, activeCategory)}
                        </p>
                      </td>

                      <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300 whitespace-nowrap">
                        {formatDate(item.deletedAt)}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingItem(item)}
                            title="View details"
                            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleRestore(item)}
                            disabled={!!actionLoading}
                            title="Restore"
                            className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw
                              size={16}
                              className={isRestoring ? "animate-spin" : ""}
                            />
                          </button>
                          <button
                            onClick={() => openDeleteConfirm(item)}
                            disabled={!!actionLoading}
                            title="Permanently delete"
                            className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {paginatedItems.map((item) => {
              const name = getItemName(item, activeCategory);
              const imgUrl = getItemImage(item, activeCategory);
              const isRestoring = actionLoading === `restore-${item.id}`;

              return (
                <div key={item.id} className="p-4">
                  <div className="flex gap-3">
                    {imgUrl ? (
                      <div
                        onClick={() => setViewingItem(item)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer"
                      >
                        <Image
                          src={imgUrl}
                          alt={name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setViewingItem(item)}
                        className="w-16 h-16 rounded-lg border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0 cursor-pointer"
                      >
                        {activeCategory === "announcements" ? (
                          <Megaphone size={20} />
                        ) : activeCategory === "marquees" ? (
                          <ScrollText size={20} />
                        ) : activeCategory === "notifications" ? (
                          <Bell size={20} />
                        ) : activeCategory === "rooms" ? (
                          <DoorOpen size={20} />
                        ) : activeCategory === "events" ? (
                          <MapPin size={20} />
                        ) : activeCategory === "freedom-wall-notes" ? (
                          <StickyNote size={20} />
                        ) : activeCategory === "freedom-wall-events" ? (
                          <Calendar size={20} />
                        ) : (
                          <FolderOpen size={20} />
                        )}
                      </div>
                    )}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => setViewingItem(item)}
                    >
                      <div className="font-semibold text-sm text-ink dark:text-cream truncate">
                        {name}
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                        {getItemSubtext(item, activeCategory)}
                      </p>
                      <p className="text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                        Deleted {formatDate(item.deletedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => setViewingItem(item)}
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={!!actionLoading}
                      className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw
                        size={16}
                        className={isRestoring ? "animate-spin" : ""}
                      />
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(item)}
                      disabled={!!actionLoading}
                      className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &larr; Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${
                page === currentPage
                  ? "bg-sepia text-white shadow-sm"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next &rarr;
          </button>
        </div>
      )}

      {/* FULL IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={22} />
          </button>
          <div
            className="relative w-full max-w-4xl flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[75vh]">
              <Image
                src={previewImage.url}
                alt={previewImage.title || "Full image preview"}
                fill
                className="object-contain"
                priority
              />
            </div>
            {previewImage.title && (
              <p className="text-cream font-jakarta text-sm text-center">{previewImage.title}</p>
            )}
          </div>
        </div>
      )}

      {/* LINKED ARTWORKS MODAL — lists artworks belonging to a (trashed) section/room/exhibition */}
      {artworksModal && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setArtworksModal(null)}
        >
          <div
            className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">
                  Linked Artworks
                </h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  {artworksModal.name}
                </p>
              </div>
              <button
                onClick={() => setArtworksModal(null)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {loadingLinkedArtworks ? (
                <div className="flex items-center justify-center py-16 text-ink-400 dark:text-ink-300 font-body text-sm">
                  Loading artworks…
                </div>
              ) : linkedArtworks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-ink-400 dark:text-ink-300 gap-2">
                  <FolderOpen size={32} className="opacity-50" />
                  <p className="font-body text-xs">
                    {LINKED_ARTWORKS_EMPTY_LABEL[artworksModal.category]}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {linkedArtworks.map((artwork) => (
                    <button
                      key={artwork.id}
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: artwork.imageUrl,
                          title: artwork.title,
                        })
                      }
                      className="group text-left"
                    >
                      <div className="relative w-full aspect-square rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/50 overflow-hidden">
                        <Image
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn size={18} className="text-cream" />
                        </div>
                        {!artwork.published && (
                          <span className="absolute top-1.5 right-1.5 font-body text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-black/80 text-cream">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs text-ink dark:text-cream mt-1.5 truncate">
                        {artwork.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EVENT MEDIA MODAL — lists the photos/videos belonging to a trashed
          event, same "clickable count opens a viewer" idea as the Linked
          Artworks modal above. No fetch/loading state needed — the media
          array already came down with the trashed event row. */}
      {eventMediaModal && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setEventMediaModal(null)}
        >
          <div
            className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">Event Media</h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">{eventMediaModal.title}</p>
              </div>
              <button
                onClick={() => setEventMediaModal(null)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              {eventMediaModal.media.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-ink-400 dark:text-ink-300 gap-2">
                  <MapPin size={32} className="opacity-50" />
                  <p className="font-body text-xs">No photos or videos on this event</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {eventMediaModal.media.map((m) =>
                    m.type === "IMAGE" ? (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPreviewImage({ url: m.url, title: eventMediaModal.title })}
                        className="group text-left"
                      >
                        <div className="relative w-full aspect-square rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/50 overflow-hidden">
                          <Image
                            src={m.url}
                            alt={eventMediaModal.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn size={18} className="text-cream" />
                          </div>
                          <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/70 text-cream">
                            <ImageIcon size={11} />
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div key={m.id} className="relative">
                        <div className="relative w-full aspect-square rounded-xl border border-black/10 dark:border-white/15 bg-black overflow-hidden">
                          <video src={m.url} controls className="w-full h-full object-cover" />
                          <span className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/70 text-cream pointer-events-none">
                            <Film size={11} />
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW ITEM DETAILS MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream capitalize">
                  {CATEGORY_SINGULAR[activeCategory]} Details
                </h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  ID: {viewingItem.id}
                </p>
              </div>
              <button
                onClick={() => setViewingItem(null)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 font-jakarta">
              {/* Image preview */}
              {(() => {
                const imgUrl = getItemImage(viewingItem, activeCategory);
                const name = getItemName(viewingItem, activeCategory);
                return imgUrl ? (
                  <div
                    onClick={() =>
                      setPreviewImage({ url: imgUrl, title: name })
                    }
                    className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 cursor-pointer group"
                  >
                    <Image
                      src={imgUrl}
                      alt={name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                        <ZoomIn size={14} /> View Full Image
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Fields */}
              <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                <ViewModalFields
                  item={viewingItem}
                  category={activeCategory}
                  onViewArtworks={openLinkedArtworks}
                  onViewEventMedia={setEventMediaModal}
                />
                <FieldRow
                  label="Deleted"
                  value={formatDate(viewingItem.deletedAt)}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleRestore(viewingItem)}
                  disabled={!!actionLoading}
                  className="flex-1 py-2 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCcw
                    size={14}
                    className={
                      actionLoading === `restore-${viewingItem.id}`
                        ? "animate-spin"
                        : ""
                    }
                  />
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openDeleteConfirm(viewingItem);
                    setViewingItem(null);
                  }}
                  disabled={!!actionLoading}
                  className="flex-1 py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={14} /> Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirm Modal */}
      {/* Empty-this-tab confirmation. Same shape and wording pattern as the
          single-item one below, but it names the count and the tab rather than
          one item, because that is the thing an admin can still get wrong
          here: which tab they are standing in. */}
      {emptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream">
              Permanently delete all {CATEGORY_COUNT[emptyConfirm]}{" "}
              {CATEGORY_LABEL[emptyConfirm].toLowerCase()}?
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-6">
              This action{" "}
              <strong className="text-vermillion">cannot be undone</strong>. Everything in the{" "}
              <strong className="text-ink dark:text-cream">
                {CATEGORY_LABEL[emptyConfirm]}
              </strong>{" "}
              tab will be erased forever, along with any images those rows own. Other tabs are
              left alone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEmptyConfirm(null)}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream font-jakarta text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyCategory}
                disabled={bulkBusy}
                className="flex-1 px-4 py-2.5 rounded-xl bg-vermillion text-white font-jakarta text-sm font-medium hover:bg-vermillion/90 transition-colors disabled:opacity-50"
              >
                {bulkBusy ? "Deleting…" : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream">
              Permanently delete &quot;
              {getItemName(deleteConfirm, activeCategory)}&quot;?
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-2">
              This action{" "}
              <strong className="text-vermillion">cannot be undone</strong>. The
              item will be erased forever.
            </p>
            <div className="bg-vermillion/10 border border-vermillion/20 p-3 mb-6 text-left">
              <p className="font-body text-sm text-vermillion font-medium mb-1">
                This will permanently destroy:
              </p>
              <ul className="font-body text-xs text-ink-500 dark:text-ink-300 space-y-1 list-disc list-inside">
                <li>
                  The {CATEGORY_SINGULAR[activeCategory]} record from the database
                </li>
                {(activeCategory === "artworks" ||
                  activeCategory === "sections" ||
                  activeCategory === "stories" ||
                  activeCategory === "cosplays") && (
                  <li>Associated image files from storage</li>
                )}
                {activeCategory === "sections" && (
                  <li>All artworks belonging to this section</li>
                )}
                {activeCategory === "stories" && (
                  <li>Every page of this tale</li>
                )}
                {activeCategory === "cosplays" && (
                  <li>Its standee photo and the photo hung behind it</li>
                )}
                {activeCategory === "freedom-wall-events" && (
                  <li>Every sticky note in this event, including any already in Trash</li>
                )}
              </ul>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => handlePermanentDelete(deleteConfirm)}
                disabled={!!actionLoading}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {actionLoading === `delete-${deleteConfirm.id}`
                  ? "Deleting..."
                  : "Delete Forever"}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={!!actionLoading}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
