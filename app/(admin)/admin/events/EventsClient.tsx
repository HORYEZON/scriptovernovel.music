// app/(admin)/admin/events/EventsClient.tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "@/components/ui/SafeImage";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Star,
  Upload,
  Loader2,
  Film,
  ImageIcon,
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  MAX_SHOW_LINEUP,
  MAX_SHOW_TICKET_NOTE,
  SHOW_STATUSES,
  SHOW_STATUS_LABELS,
  type ShowStatus,
} from "@/lib/shows";

export interface EventMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  order: number;
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  city: string | null;
  lineup: string | null;
  latitude: number;
  longitude: number;
  eventDate: string | null;
  ticketUrl: string | null;
  ticketPrice: number | null;
  ticketNote: string | null;
  status: ShowStatus;
  isNextEvent: boolean;
  displayOrder: number;
  enabled: boolean;
  media: EventMedia[];
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  title: string;
  description: string;
  venueName: string;
  city: string;
  lineup: string;
  latitude: number | null;
  longitude: number | null;
  eventDate: string;
  ticketUrl: string;
  /** Text, not a number: an empty field has to stay empty rather than
   *  becoming 0, and "250" is typed a character at a time. */
  ticketPrice: string;
  ticketNote: string;
  status: ShowStatus;
  enabled: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  venueName: "",
  city: "",
  lineup: "",
  latitude: null,
  longitude: null,
  eventDate: "",
  ticketUrl: "",
  ticketPrice: "",
  ticketNote: "",
  status: "SCHEDULED",
  enabled: true,
};

const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842]; // Manila — just a starting viewport

// Cursor-following hover preview sizing — kept in sync with
// ChaseCompanionsSection.tsx's own copy of these same two constants.
const PREVIEW_SIZE = 224;
const PREVIEW_OFFSET = 20;

/**
 * A stored ISO instant → the picker's `YYYY-MM-DDTHH:mm`, in the admin's own
 * timezone.
 *
 * This used to be `iso.slice(0, 10)`, which is also why every show on the
 * public site claimed it started at 8:00 AM: a date-only value was stored as
 * midnight UTC and read back in Manila. The field carries a time now, so the
 * conversion has to go through Date rather than string arithmetic — slicing a
 * UTC string would show 8:00 PM Manila as 12:00.
 */
function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Loaded as ONE dynamic(..., { ssr: false }) component rather than
// dynamic-importing MapContainer/TileLayer/Marker individually — see
// EventLocationPickerLeaflet.tsx's header comment (and
// components/public/EventsMapLeaflet.tsx's) for why that split let
// Leaflet's internal panes escape their overflow-hidden wrapper and render
// full-bleed over the rest of the page instead of staying inside this box.
const EventLocationPickerLeaflet = dynamic(() => import("./EventLocationPickerLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="h-72 rounded-xl admin-input border flex items-center justify-center text-ink-400">
      <Loader2 size={20} className="animate-spin" />
    </div>
  ),
});

// Debounced text buffer for one coordinate input. Committing straight to
// the parent's `latitude`/`longitude` state on every keystroke was the
// cause of the lag-then-crash reported when typing coordinates: each
// commit re-rendered LocationPicker with a brand-new `center` array,
// which re-ran EventLocationPickerLeaflet's RecenterOnChange effect and
// called map.setView() — on every single character. Typing a full
// coordinate could fire dozens of map resets in under a second. Buffering
// locally and only committing ~400ms after typing stops cuts that down to
// one, and also fixes a smaller annoyance where a trailing "." was
// stripped mid-type because the controlled input's value round-tripped
// through parseFloat() before the user finished typing the decimal part.
function useDebouncedCoordinateInput(value: number | null, onCommit: (parsed: number) => void, delayMs = 400) {
  const [text, setText] = useState(value !== null ? String(value) : "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync when the value changes from elsewhere (a map click, or
  // switching which event is being edited) — but never while the debounce
  // timer from the user's own typing is still pending, or their in-progress
  // keystrokes would get overwritten out from under them.
  useEffect(() => {
    if (timerRef.current) return;
    setText(value !== null ? String(value) : "");
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleChange(raw: string) {
    setText(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const parsed = parseFloat(raw);
      if (!Number.isNaN(parsed)) onCommit(parsed);
    }, delayMs);
  }

  return [text, handleChange] as const;
}

/** Click-to-drop-a-pin location picker, used by the create/edit form.
 * OpenStreetMap tiles via Leaflet — no API key, no billing account. */
function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  // Only changes reference when the actual values change, not on every
  // unrelated keystroke elsewhere in the form (e.g. typing the title) —
  // RecenterOnChange (EventLocationPickerLeaflet.tsx) depends on this array's
  // identity to decide whether to re-pan the map.
  const center = useMemo(
    (): [number, number] => (latitude !== null && longitude !== null ? [latitude, longitude] : DEFAULT_CENTER),
    [latitude, longitude]
  );

  const [latText, setLatText] = useDebouncedCoordinateInput(latitude, (v) => onChange(v, longitude ?? DEFAULT_CENTER[1]));
  const [lngText, setLngText] = useDebouncedCoordinateInput(longitude, (v) => onChange(latitude ?? DEFAULT_CENTER[0], v));

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        Location <span className="text-red-500 dark:text-red-400">*</span>{" "}
        <span className="normal-case font-normal text-ink-400">
          — click the map to drop a pin, or paste exact coordinates below
        </span>
      </label>

      {/* Manual entry — e.g. pasted straight from a Google Maps share link
          ("14.762233, 121.049143") — for when eyeballing a click on the
          small embedded map below isn't precise enough. Typing here also
          recenters the map and moves the pin (EventLocationPickerLeaflet's
          RecenterOnChange) ~400ms after you stop typing, not per keystroke. */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1">
            Latitude
          </label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 14.762233"
            value={latText}
            onChange={(e) => setLatText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg admin-input border text-ink dark:text-cream text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1">
            Longitude
          </label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 121.049143"
            value={lngText}
            onChange={(e) => setLngText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg admin-input border text-ink dark:text-cream text-xs font-mono"
          />
        </div>
      </div>

      {/* isolate + [contain:layout_paint]: keeps Leaflet's internal panes/
          controls (z-index up to 1000 by default) fully boxed in here
          instead of escaping over the rest of the modal/page. */}
      <div className="isolate w-full h-72 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 [contain:layout_paint]">
        <EventLocationPickerLeaflet
          center={center}
          zoom={latitude !== null ? 13 : 4}
          latitude={latitude}
          longitude={longitude}
          onChange={onChange}
        />
      </div>
      {latitude !== null && longitude !== null && (
        <p className="mt-2 font-body text-[11px] text-ink-400 dark:text-ink-300 font-mono">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}

export function EventsClient({ initialEvents }: { initialEvents: EventItem[] }) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>(initialEvents);

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EventItem | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  // Full-image lightbox on click — same pattern as TrashClient.tsx.
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Drag-to-reorder media thumbnails — see handleMediaDragStart etc. below.
  const [draggedMediaIndex, setDraggedMediaIndex] = useState<number | null>(null);
  const [dragOverMediaIndex, setDragOverMediaIndex] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Cursor-following hover preview — same pattern as
  // ChaseCompanionsSection.tsx / ArtworkPicker.tsx's Room Order list, so
  // the full image floats next to the cursor instead of only being
  // reachable via the click-to-open lightbox. Shared between the table's
  // row thumbnails and the create/edit modal's media thumbnails below.
  const [hoverPreview, setHoverPreview] = useState<{ url: string; label: string; x: number; y: number } | null>(
    null
  );
  function showPreview(e: React.MouseEvent, url: string, label: string) {
    setHoverPreview({ url, label, x: e.clientX, y: e.clientY });
  }
  function movePreview(e: React.MouseEvent) {
    setHoverPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p));
  }
  function hidePreview() {
    setHoverPreview(null);
  }
  let previewLeft = 0;
  let previewTop = 0;
  if (hoverPreview) {
    previewLeft = hoverPreview.x + PREVIEW_OFFSET;
    previewTop = hoverPreview.y - PREVIEW_SIZE / 2;
    if (typeof window !== "undefined") {
      previewLeft = Math.min(previewLeft, window.innerWidth - PREVIEW_SIZE - 12);
      previewTop = Math.max(12, Math.min(previewTop, window.innerHeight - PREVIEW_SIZE - 44));
    }
  }

  function openDeleteConfirm(item: EventItem) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(item);
  }

  const isReorderingAllowed = searchQuery.trim() === "";

  const processedEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.displayOrder - b.displayOrder);
    if (searchQuery.trim() === "") return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.venueName ?? "").toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q)
    );
  }, [events, searchQuery]);

  useLockBodyScroll(showModal || Boolean(deleteConfirm));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setValidationError(null);
    setShowModal(true);
  }

  function openEdit(item: EventItem) {
    setEditing(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      venueName: item.venueName ?? "",
      city: item.city ?? "",
      lineup: item.lineup ?? "",
      latitude: item.latitude,
      longitude: item.longitude,
      eventDate: toDateInputValue(item.eventDate),
      ticketUrl: item.ticketUrl ?? "",
      ticketPrice: item.ticketPrice !== null ? String(item.ticketPrice) : "",
      ticketNote: item.ticketNote ?? "",
      status: item.status ?? "SCHEDULED",
      enabled: item.enabled,
    });
    setValidationError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!form.title.trim()) {
      setValidationError("Title is required.");
      return;
    }
    if (form.latitude === null || form.longitude === null) {
      setValidationError("Pick a location on the map (or enter coordinates).");
      return;
    }
    if (form.ticketPrice.trim() && !Number.isFinite(Number(form.ticketPrice))) {
      setValidationError("The ticket price has to be a number (or left blank).");
      return;
    }

    const payload = {
      title: form.title,
      description: form.description,
      venueName: form.venueName,
      city: form.city,
      lineup: form.lineup,
      latitude: form.latitude,
      longitude: form.longitude,
      // The picker's value is local wall-clock time with no offset, which the
      // server would otherwise read in *its* timezone (UTC on Vercel). Fixing
      // the instant here is the same thing ReleaseNotesClient does.
      eventDate: form.eventDate ? new Date(form.eventDate).toISOString() : null,
      ticketUrl: form.ticketUrl,
      ticketPrice: form.ticketPrice.trim() ? Number(form.ticketPrice) : null,
      ticketNote: form.ticketNote,
      status: form.status,
      enabled: form.enabled,
    };

    setLoading(true);
    try {
      if (editing) {
        const res = await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update event");
        }
        const data = await res.json();
        setEvents((prev) => prev.map((ev) => (ev.id === editing.id ? data : ev)));
        // Editing an existing event has nothing left to wait for (unlike
        // create, below, there's no eventId dependency keeping the modal
        // open for media upload) — close it, matching every other CRUD
        // modal in the admin (e.g. FaqsClient's Save Changes).
        setShowModal(false);
        toast.success("Event updated");
      } else {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create event");
        }
        const data = await res.json();
        setEvents((prev) => [...prev, data]);
        setShowModal(false);
        toast.success('Event created — reopen it from the ✎ Edit button to add photos/videos.');
      }
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleEnabled(item: EventItem) {
    const updated = !item.enabled;
    setEvents((prev) => prev.map((ev) => (ev.id === item.id ? { ...ev, enabled: updated } : ev)));
    try {
      const res = await fetch(`/api/events/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: updated }),
      });
      if (!res.ok) throw new Error();
      toast.success(updated ? "Event enabled" : "Event disabled");
      router.refresh();
    } catch {
      setEvents((prev) => prev.map((ev) => (ev.id === item.id ? { ...ev, enabled: item.enabled } : ev)));
      toast.error("Failed to update status");
    }
  }

  // Only one event is ever "next" — the server unsets every other row in
  // the same transaction (see app/api/events/[id]/route.ts), so this just
  // reflects that back into local state rather than computing it here.
  async function handleSetNextEvent(item: EventItem) {
    const nextValue = !item.isNextEvent;
    try {
      const res = await fetch(`/api/events/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNextEvent: nextValue }),
      });
      if (!res.ok) throw new Error();
      setEvents((prev) => prev.map((ev) => ({ ...ev, isNextEvent: nextValue && ev.id === item.id })));
      toast.success(nextValue ? `"${item.title}" set as Next Event` : "Next Event cleared");
      router.refresh();
    } catch {
      toast.error("Failed to update Next Event");
    }
  }

  async function handleDelete(item: EventItem) {
    try {
      const res = await fetch(`/api/events/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setEvents((prev) => prev.filter((ev) => ev.id !== item.id));
      toast.success(`"${item.title}" moved to Trash`);
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete event");
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    if (!isReorderingAllowed) return;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= processedEvents.length) return;

    const reordered = [...processedEvents];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const order = reordered.map((e, i) => ({ id: e.id, displayOrder: i }));

    setEvents(reordered.map((e, i) => ({ ...e, displayOrder: i })));

    try {
      const res = await fetch("/api/events/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Failed to reorder");
    }
  }

  async function handleMediaUpload(file: File, type: "IMAGE" | "VIDEO") {
    if (!editing) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch(type === "IMAGE" ? "/api/upload/event-image" : "/api/upload/event-video", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const attachRes = await fetch("/api/events/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: editing.id, url: uploadData.url, type }),
      });
      const media = await attachRes.json();
      if (!attachRes.ok) throw new Error(media.error || "Failed to attach media");

      const updatedEvent = { ...editing, media: [...editing.media, media] };
      setEditing(updatedEvent);
      setEvents((prev) => prev.map((ev) => (ev.id === editing.id ? updatedEvent : ev)));
      toast.success(`${type === "IMAGE" ? "Image" : "Video"} added`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleMediaDelete(mediaId: string) {
    if (!editing) return;
    try {
      const res = await fetch(`/api/events/media?id=${mediaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const updatedEvent = { ...editing, media: editing.media.filter((m) => m.id !== mediaId) };
      setEditing(updatedEvent);
      setEvents((prev) => prev.map((ev) => (ev.id === editing.id ? updatedEvent : ev)));
      toast.success("Media removed");
    } catch {
      toast.error("Failed to remove media");
    }
  }

  // Drag-to-reorder media thumbnails — native HTML5 drag-and-drop, same
  // draggedSlot/dragOverSlot shape as AboutClient.tsx's Profile Slideshow
  // reorder, applied to the media grid instead of profileImages.
  function handleMediaDragStart(e: React.DragEvent, index: number) {
    setDraggedMediaIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  }
  function handleMediaDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedMediaIndex !== null && draggedMediaIndex !== index && dragOverMediaIndex !== index) {
      setDragOverMediaIndex(index);
    }
  }
  async function handleMediaDrop(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (!editing || draggedMediaIndex === null || draggedMediaIndex === index) {
      setDraggedMediaIndex(null);
      setDragOverMediaIndex(null);
      return;
    }

    const reordered = [...editing.media];
    const [moved] = reordered.splice(draggedMediaIndex, 1);
    reordered.splice(index, 0, moved);
    const withOrder = reordered.map((m, i) => ({ ...m, order: i }));

    const updatedEvent = { ...editing, media: withOrder };
    setEditing(updatedEvent);
    setEvents((prev) => prev.map((ev) => (ev.id === editing.id ? updatedEvent : ev)));
    setDraggedMediaIndex(null);
    setDragOverMediaIndex(null);

    try {
      const res = await fetch("/api/events/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: withOrder.map((m) => ({ id: m.id, order: m.order })) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to save new order");
    }
  }
  function handleMediaDragEnd() {
    setDraggedMediaIndex(null);
    setDragOverMediaIndex(null);
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New Event
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Total: <strong className="text-ink dark:text-cream">{events.length}</strong> &middot; Enabled:{" "}
          <strong className="text-ink dark:text-cream">{events.filter((e) => e.enabled).length}</strong>
        </div>
      </div>

      {/* Search Bar */}
      <div className="admin-card border rounded-2xl p-4 flex items-center gap-3 backdrop-blur-md shadow-sm">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title or venue..."
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
        {!isReorderingAllowed && (
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 hidden sm:block">
            Clear search to enable manual reordering
          </p>
        )}
      </div>

      {/* Events List */}
      {processedEvents.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <MapPin className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-ink dark:text-cream mb-1">
              {events.length === 0 ? "No events yet" : "No matching events"}
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {events.length === 0
                ? "Add a gig to list it on /shows — upcoming with its tickets, or played, for the archive and the map."
                : "Try adjusting your search query."}
            </p>
            {events.length === 0 && (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Create Event
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold w-20">Order</th>
                  <th className="py-4 px-6 font-semibold">Event</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {processedEvents.map((item, index) => (
                  <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleMove(index, "up")}
                          disabled={!isReorderingAllowed || index === 0}
                          className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(index, "down")}
                          disabled={!isReorderingAllowed || index === processedEvents.length - 1}
                          className="p-1 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>

                    <td className="py-4 px-6 max-w-xl">
                      <div className="flex items-center gap-3">
                        {item.media[0] ? (
                          <div
                            className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 ${item.media.some((m) => m.type === "IMAGE") ? "cursor-zoom-in" : ""}`}
                            onMouseEnter={(e) => {
                              const img = item.media.find((m) => m.type === "IMAGE");
                              if (img) showPreview(e, img.url, item.title);
                            }}
                            onMouseMove={movePreview}
                            onMouseLeave={hidePreview}
                          >
                            <Image
                              src={item.media.find((m) => m.type === "IMAGE")?.url ?? item.media[0].url}
                              alt={item.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-ink-400 shrink-0">
                            <MapPin size={16} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div
                            onClick={() => openEdit(item)}
                            className="font-semibold text-ink dark:text-cream cursor-pointer hover:underline flex items-center gap-2"
                          >
                            <span className="truncate">{item.title}</span>
                            {item.isNextEvent && (
                              <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-400/15 text-amber-500 dark:text-amber-300 border border-amber-400/30">
                                <Star size={10} className="fill-current" /> Next
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-400 dark:text-ink-300 truncate mt-0.5">
                            {[item.venueName, item.city].filter(Boolean).join(" · ") || "No venue"}
                            {item.eventDate ? ` · ${new Date(item.eventDate).toLocaleDateString()}` : " · TBA"}
                            {item.status !== "SCHEDULED" ? ` · ${SHOW_STATUS_LABELS[item.status]}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {item.enabled ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
                          Disabled
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSetNextEvent(item)}
                          type="button"
                          title={item.isNextEvent ? "Clear Next Event" : "Set as Next Event"}
                          className={`p-2 rounded-lg transition-colors ${
                            item.isNextEvent
                              ? "bg-amber-400/15 text-amber-500 dark:text-amber-300 hover:bg-amber-400/25"
                              : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                          }`}
                        >
                          <Star size={16} className={item.isNextEvent ? "fill-current" : ""} />
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(item)}
                          type="button"
                          title={item.enabled ? "Disable" : "Enable"}
                          className={`p-2 rounded-lg transition-colors ${
                            item.enabled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                          }`}
                        >
                          {item.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(item)}
                          title="Move to Trash"
                          className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL — z-index has to clear Leaflet's own panes/
          controls (up to 1000 by default) or the LocationPicker map behind
          this modal renders on top of it instead of staying inside it. */}
      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit Event" : "Create New Event"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* min-h-0 overrides the flex item default of min-height:auto —
                without it this never actually scrolls, it just grows to
                fit its content (map + growing media grid) instead, same
                bug fixed on the public EventModal (EventsMap.tsx). */}
            <form
              id="event-form"
              onSubmit={handleSubmit}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5"
            >
              {validationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm font-jakarta">
                  {validationError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Title <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shoegaze Night Vol. 4"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mow's Bar"
                    value={form.venueName}
                    onChange={(e) => setForm({ ...form, venueName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Quezon City"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Date &amp; set time
                  </label>
                  <AdminDatePicker
                    withTime
                    value={form.eventDate}
                    onChange={(eventDate) => setForm({ ...form, eventDate })}
                    className="px-4 py-2.5 text-sm"
                    ariaLabel="Show date and time"
                  />
                  <p className="mt-1.5 text-[11px] text-ink-400 dark:text-ink-300">
                    Leave the date blank for a TBA show — it still lists, under &ldquo;upcoming&rdquo;.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Status
                  </label>
                  <AdminSelect
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ShowStatus })}
                    className="py-2.5 text-sm"
                    aria-label="Show status"
                  >
                    {SHOW_STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-ink-900">
                        {SHOW_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </AdminSelect>
                  <p className="mt-1.5 text-[11px] text-ink-400 dark:text-ink-300">
                    Cancelled and postponed shows stay listed, struck through — someone holding a ticket has to be able to find out.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_0.7fr_1fr] gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Ticket Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={form.ticketUrl}
                    onChange={(e) => setForm({ ...form, ticketUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Price (₱)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="250"
                    value={form.ticketPrice}
                    onChange={(e) => setForm({ ...form, ticketPrice: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Price Note
                  </label>
                  <input
                    type="text"
                    maxLength={MAX_SHOW_TICKET_NOTE}
                    placeholder="e.g. ₱250 at the door"
                    value={form.ticketNote}
                    onChange={(e) => setForm({ ...form, ticketNote: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                  <p className="mt-1.5 text-[11px] text-ink-400 dark:text-ink-300">Shown instead of the number, when set.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Lineup
                </label>
                <textarea
                  rows={3}
                  maxLength={MAX_SHOW_LINEUP}
                  placeholder={"One act per line, e.g.\nSevere Weather\nAmpelope"}
                  value={form.lineup}
                  onChange={(e) => setForm({ ...form, lineup: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
                <p className="mt-1.5 text-[11px] text-ink-400 dark:text-ink-300">
                  The rest of the bill. Shown on the show row as &ldquo;with …&rdquo;.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Description
                </label>
                <textarea
                  rows={4}
                  placeholder="What the night was, or is going to be…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
              </div>

              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
              />

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-ink dark:text-cream">
                  Enabled (listed on /shows and pinned on its map)
                </span>
              </label>

              {/* Media — only once the event exists, since it uploads/attaches
                  immediately rather than staging local files. */}
              <div className="pt-2 border-t border-black/10 dark:border-white/10">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">
                  Photos &amp; Videos
                </label>
                {!editing ? (
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                    Save the event first to start adding photos and videos.
                  </p>
                ) : (
                  <>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mb-2">
                      Drag a thumbnail to reorder
                    </p>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {editing.media.map((m, index) => (
                        <div
                          key={m.id}
                          draggable
                          onDragStart={(e) => handleMediaDragStart(e, index)}
                          onDragOver={(e) => handleMediaDragOver(e, index)}
                          onDrop={(e) => handleMediaDrop(e, index)}
                          onDragEnd={handleMediaDragEnd}
                          className={`relative w-20 h-20 rounded-lg overflow-hidden border bg-black/5 dark:bg-white/5 group cursor-grab active:cursor-grabbing transition-opacity ${
                            draggedMediaIndex === index
                              ? "opacity-40 border-black/10 dark:border-white/10"
                              : dragOverMediaIndex === index
                                ? "border-sepia ring-2 ring-sepia"
                                : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {m.type === "IMAGE" ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(m.url)}
                              onMouseEnter={(e) => showPreview(e, m.url, "Event photo")}
                              onMouseMove={movePreview}
                              onMouseLeave={hidePreview}
                              className="absolute inset-0"
                              title="View full image"
                            >
                              <Image
                                src={m.url}
                                alt=""
                                fill
                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </button>
                          ) : (
                            <video src={m.url} className="w-full h-full object-cover" muted />
                          )}
                          <div className="absolute top-0.5 left-0.5 p-0.5 rounded bg-black/60 text-white pointer-events-none">
                            {m.type === "IMAGE" ? <ImageIcon size={10} /> : <Film size={10} />}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMediaDelete(m.id)}
                            className="absolute top-0.5 right-0.5 p-1 rounded-md bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file, "IMAGE");
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleMediaUpload(file, "VIDEO");
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingMedia}
                        onClick={() => imageInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-medium text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {uploadingMedia ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Add Image
                      </button>
                      <button
                        type="button"
                        disabled={uploadingMedia}
                        onClick={() => videoInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-xs font-medium text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        {uploadingMedia ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                        Add Video
                      </button>
                    </div>
                  </>
                )}
              </div>
            </form>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-medium"
              >
                {editing ? "Done" : "Cancel"}
              </button>
              <button
                type="submit"
                form="event-form"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : editing ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE (TRASH) CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">Move Event to Trash</h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              &ldquo;{deleteConfirm.title}&rdquo; will be removed from the public map and moved to Trash, where it
              can be restored or permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL IMAGE PREVIEW LIGHTBOX — same pattern as TrashClient.tsx,
          above the edit modal's own z-[2000]. Sized down from a near-
          edge-to-edge fit with a stronger, more visible backdrop blur —
          same adjustment as the public EventsMap.tsx lightbox. */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center p-6 sm:p-10 md:p-16 bg-black/80 backdrop-blur-xl"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <div
            className="relative w-full max-w-2xl h-[60vh] sm:h-[65vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={previewImage} alt="Full image preview" fill className="object-contain" priority />
          </div>
        </div>
      )}

      {/* Cursor-following hover preview — fixed so it escapes both the
          table and the modal, same pattern as ChaseCompanionsSection.tsx.
          z-[3500] clears even the full-image lightbox above so it's never
          hidden mid-hover regardless of which context triggered it. */}
      {hoverPreview && (
        <div
          className="fixed z-[3500] pointer-events-none rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
          style={{ left: previewLeft, top: previewTop, width: PREVIEW_SIZE }}
        >
          <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
            <Image
              src={hoverPreview.url}
              alt={hoverPreview.label}
              fill
              className="object-contain"
              sizes={`${PREVIEW_SIZE}px`}
            />
          </div>
          <p className="px-3 py-2 font-body text-xs text-ink dark:text-cream truncate border-t border-black/5 dark:border-white/5">
            {hoverPreview.label}
          </p>
        </div>
      )}
    </div>
  );
}
