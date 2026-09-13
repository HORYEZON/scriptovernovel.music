// app/(admin)/admin/artworks/FreedomWallTab.tsx
// Admin panel for the Freedom Wall room.
// Mirrors the toggle + CRUD patterns from RoomsTab.tsx and DigitalMuseumPanel.tsx.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Eraser,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  Star,
  Loader2,
  MessageSquare,
  Megaphone,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { Toggle } from "./museum-ui";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FWSettings {
  isActive: boolean;
  activeEventId: string | null;
}

interface FWEvent {
  id: string;
  title: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { notes: number };
}

interface FWNote {
  id: string;
  nickname: string;
  content: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-300",
  pink:   "bg-pink-300",
  blue:   "bg-sky-300",
  green:  "bg-emerald-300",
  purple: "bg-violet-300",
  orange: "bg-orange-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Notes are visitor-submitted and arrive in bursts during an event, so the
// date alone doesn't separate them — every note is stamped to the minute.
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export function FreedomWallTab() {
  const router = useRouter();

  const [settings, setSettings] = useState<FWSettings>({ isActive: false, activeEventId: null });
  const [events, setEvents] = useState<FWEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Event expansion / notes display
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventNotes, setEventNotes] = useState<Record<string, FWNote[]>>({});
  const [loadingNotes, setLoadingNotes] = useState(false);

  // New event form
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline rename — `editingId` is the event whose title row is swapped for an
  // input. Renaming the active event also renames the plaque painted on the
  // museum's Freedom Wall, so this is the one field admins actually revisit.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Bulk-delete confirmation. Opening any delete confirmation plays the same
  // "are you sure?" cue every other admin delete modal fires (admin.deleteConfirm),
  // so route the modal-open through helpers rather than a bare setState.
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<FWEvent | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  function openBulkDeleteConfirm(event: FWEvent) {
    playSoundEffect("admin.deleteConfirm");
    setBulkDeleteTarget(event);
  }

  // Single-note delete confirmation. Deleting a note is a soft delete — it
  // goes to /admin/trash — but it still vanishes from the public wall the
  // moment it's confirmed, so it gets the same modal the bulk delete has.
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<{ eventId: string; note: FWNote } | null>(null);
  const [deletingNote, setDeletingNote] = useState(false);
  function openDeleteNoteConfirm(eventId: string, note: FWNote) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteNoteTarget({ eventId, note });
  }

  // Whole-event delete confirmation — soft delete, lands in
  // Trash → Freedom Wall → Events with every note it holds, restorable as a
  // unit. Distinct from Archive (which only pulls the event out of rotation)
  // and from the bulk-note clear (which empties an event you're keeping).
  const [deleteEventTarget, setDeleteEventTarget] = useState<FWEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  function openDeleteEventConfirm(event: FWEvent) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteEventTarget(event);
  }

  // ── Initial fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/freedom-wall/events");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setSettings(data.settings);
        setEvents(data.events);
      } catch {
        toast.error("Failed to load Freedom Wall data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Room activation toggle ──────────────────────────────────────────────────
  async function toggleActive(value: boolean) {
    const prev = settings;
    setSettings((s) => ({ ...s, isActive: value }));
    try {
      const res = await fetch("/api/admin/freedom-wall/room-toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: value }),
      });
      if (!res.ok) throw new Error();
      toast.success(value ? "Freedom Wall activated" : "Freedom Wall deactivated");
      router.refresh();
    } catch {
      setSettings(prev);
      toast.error("Failed to toggle Freedom Wall");
    }
  }

  // ── Set active event ────────────────────────────────────────────────────────
  async function setActiveEvent(eventId: string) {
    const prev = settings;
    setSettings((s) => ({ ...s, activeEventId: eventId }));
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setActive: true }),
      });
      if (!res.ok) throw new Error();
      const event = events.find((e) => e.id === eventId);
      toast.success(`"${event?.title}" set as active event`);
      router.refresh();
    } catch {
      setSettings(prev);
      toast.error("Failed to set active event");
    }
  }

  // ── Create event ────────────────────────────────────────────────────────────
  async function createEvent() {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/freedom-wall/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error();
      const event: FWEvent = await res.json();
      setEvents((prev) => [event, ...prev]);
      setNewTitle("");
      setCreating(false);
      toast.success(`Event "${event.title}" created`);
    } catch {
      toast.error("Failed to create event");
    } finally {
      setSaving(false);
    }
  }

  // ── Rename event ────────────────────────────────────────────────────────────
  function startRename(event: FWEvent) {
    setEditingId(event.id);
    setEditTitle(event.title);
  }

  function cancelRename() {
    setEditingId(null);
    setEditTitle("");
  }

  async function renameEvent(event: FWEvent) {
    const title = editTitle.trim();
    // Nothing to save — treat an unchanged (or emptied) field as a cancel so
    // Enter/blur never fires a pointless PATCH.
    if (!title || title === event.title) {
      cancelRename();
      return;
    }
    if (renaming) return;

    setRenaming(true);
    const prev = events;
    setEvents((es) => es.map((e) => (e.id === event.id ? { ...e, title } : e)));
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
      cancelRename();
      toast.success(`Renamed to "${title}"`);
      router.refresh();
    } catch {
      setEvents(prev);
      toast.error("Failed to rename event");
    } finally {
      setRenaming(false);
    }
  }

  // ── Archive / unarchive event ───────────────────────────────────────────────
  async function archiveEvent(event: FWEvent, archive: boolean) {
    const prev = events;
    setEvents((es) => es.map((e) => (e.id === event.id ? { ...e, isArchived: archive } : e)));
    // If we archived the active event, reflect that locally.
    if (archive && settings.activeEventId === event.id) {
      setSettings((s) => ({ ...s, activeEventId: null }));
    }
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error();
      toast.success(archive ? `"${event.title}" archived` : `"${event.title}" restored`);
      router.refresh();
    } catch {
      setEvents(prev);
      toast.error(`Failed to ${archive ? "archive" : "restore"} event`);
    }
  }

  // ── Load notes for an event ─────────────────────────────────────────────────
  async function loadNotes(eventId: string) {
    if (eventNotes[eventId]) return; // already cached
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${eventId}/notes`);
      if (!res.ok) throw new Error();
      const notes: FWNote[] = await res.json();
      setEventNotes((prev) => ({ ...prev, [eventId]: notes }));
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoadingNotes(false);
    }
  }

  function toggleExpand(eventId: string) {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(eventId);
      loadNotes(eventId);
    }
  }

  // ── Archive single note ─────────────────────────────────────────────────────
  async function archiveNote(eventId: string, note: FWNote, archive: boolean) {
    setEventNotes((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).map((n) => (n.id === note.id ? { ...n, isArchived: archive } : n)),
    }));
    try {
      const res = await fetch(`/api/admin/freedom-wall/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // revert
      setEventNotes((prev) => ({
        ...prev,
        [eventId]: (prev[eventId] ?? []).map((n) => (n.id === note.id ? { ...n, isArchived: !archive } : n)),
      }));
      toast.error("Failed to update note");
    }
  }

  // ── Delete single note (soft — lands in Trash) ─────────────────────────────
  async function deleteNote(eventId: string, note: FWNote) {
    const prev = eventNotes[eventId] ?? [];
    setDeletingNote(true);
    setEventNotes((p) => ({ ...p, [eventId]: prev.filter((n) => n.id !== note.id) }));
    // Update the event count locally
    setEvents((es) =>
      es.map((e) => (e.id === eventId ? { ...e, _count: { notes: Math.max(0, e._count.notes - 1) } } : e))
    );
    try {
      const res = await fetch(`/api/admin/freedom-wall/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteNoteTarget(null);
      toast.success("Note moved to Trash");
      router.refresh();
    } catch {
      setEventNotes((p) => ({ ...p, [eventId]: prev }));
      setEvents((es) =>
        es.map((e) => (e.id === eventId ? { ...e, _count: { notes: prev.length } } : e))
      );
      toast.error("Failed to delete note");
    } finally {
      setDeletingNote(false);
    }
  }

  // ── Bulk delete all notes in event ─────────────────────────────────────────
  async function bulkDeleteNotes(event: FWEvent) {
    setBulkDeleting(true);
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${event.id}/notes`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Clear local cache
      setEventNotes((prev) => ({ ...prev, [event.id]: [] }));
      setEvents((es) => es.map((e) => (e.id === event.id ? { ...e, _count: { notes: 0 } } : e)));
      setBulkDeleteTarget(null);
      toast.success(
        `Moved ${data.deleted} note${data.deleted !== 1 ? "s" : ""} to Trash`
      );
      router.refresh();
    } catch {
      toast.error("Failed to bulk-delete notes");
    } finally {
      setBulkDeleting(false);
    }
  }

  // ── Delete a whole event (soft — lands in Trash → Freedom Wall → Events) ────
  async function deleteEvent(event: FWEvent) {
    const prev = events;
    setDeletingEvent(true);
    setEvents((es) => es.filter((e) => e.id !== event.id));
    if (settings.activeEventId === event.id) {
      setSettings((s) => ({ ...s, activeEventId: null }));
    }
    try {
      const res = await fetch(`/api/admin/freedom-wall/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteEventTarget(null);
      toast.success(`"${event.title}" moved to Trash`);
      router.refresh();
    } catch {
      setEvents(prev);
      toast.error("Failed to delete event");
    } finally {
      setDeletingEvent(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-400">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  const activeEvents = events.filter((e) => !e.isArchived);
  const archivedEvents = events.filter((e) => e.isArchived);

  return (
    <div className="space-y-6">

      {/* ── Room activation card ─────────────────────────────────────────── */}
      <div className="admin-card border rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="shrink-0 p-2.5 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            <Megaphone size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-jakarta font-semibold text-sm text-ink dark:text-cream">Freedom Wall Room</p>
            <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              {settings.isActive ? "Publicly visible — visitors can submit sticky notes." : "Currently hidden from the public gallery."}
            </p>
            {settings.isActive && !settings.activeEventId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠ No active event set — notes can&apos;t be submitted until you activate an event below.
              </p>
            )}
            {settings.activeEventId && (
              <p className="text-xs text-ink-400 dark:text-ink-300 mt-1">
                The active event&apos;s name shows as a plaque on the wall in the Digital Museum — move it or
                change its colors in <strong>Edit Scene</strong> for this room.
              </p>
            )}
          </div>
          <Toggle
            checked={settings.isActive}
            onChange={toggleActive}
            label={settings.isActive ? "Deactivate Freedom Wall" : "Activate Freedom Wall"}
          />
        </div>
      </div>

      {/* ── Create event ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="font-jakarta font-semibold text-sm text-ink dark:text-cream">Event Folders</h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <Plus size={14} /> New Event
        </button>
      </div>

      {creating && (
        <div className="admin-card border rounded-xl p-4 flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder="Event name (e.g. Independence Day 2026)"
            maxLength={120}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createEvent(); if (e.key === "Escape") { setCreating(false); setNewTitle(""); } }}
            className="flex-1 text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
          />
          <button
            onClick={createEvent}
            disabled={!newTitle.trim() || saving}
            className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Create"}
          </button>
          <button
            onClick={() => { setCreating(false); setNewTitle(""); }}
            className="px-3 py-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Active events ─────────────────────────────────────────────────── */}
      {activeEvents.length === 0 && !creating && (
        <p className="text-sm text-ink-400 dark:text-ink-300 py-4 text-center">
          No events yet. Create one above to start collecting sticky notes.
        </p>
      )}

      <div className="space-y-2">
        {activeEvents.map((event) => {
          const isExpanded = expandedEventId === event.id;
          const isActive = settings.activeEventId === event.id;
          const isEditing = editingId === event.id;
          const notes = eventNotes[event.id] ?? [];

          return (
            <div key={event.id} className={cn("admin-card border rounded-2xl overflow-hidden", isActive && "ring-2 ring-yellow-400/50")}>
              {/* Event header row */}
              <div className="flex items-center gap-3 p-4">
                <div className={cn("shrink-0 p-2 rounded-lg", isActive ? "bg-yellow-400/20 text-yellow-600 dark:text-yellow-400" : "bg-black/5 dark:bg-white/5 text-ink-400")}>
                  <MessageSquare size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="text"
                        maxLength={120}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameEvent(event);
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="flex-1 min-w-0 font-jakarta text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                      />
                      <button
                        onClick={() => renameEvent(event)}
                        disabled={renaming}
                        title="Save name"
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                      >
                        {renaming ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      </button>
                      <button
                        onClick={cancelRename}
                        disabled={renaming}
                        title="Cancel"
                        className="p-1.5 rounded-lg text-ink-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">{event.title}</p>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border border-yellow-400/30 font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                    {isEditing ? (
                      isActive
                        ? "Shown on the Freedom Wall in the Digital Museum — press Enter to save."
                        : "Press Enter to save, Esc to cancel."
                    ) : (
                      <>
                        {event._count.notes} note{event._count.notes !== 1 ? "s" : ""} · Created {formatDate(event.createdAt)}
                      </>
                    )}
                  </p>
                </div>

                <div className={cn("flex items-center gap-1 shrink-0", isEditing && "hidden")}>
                  {/* Rename */}
                  <button
                    onClick={() => startRename(event)}
                    title="Rename event"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>

                  {/* Set as active */}
                  {!isActive && (
                    <button
                      onClick={() => setActiveEvent(event.id)}
                      title="Set as active event"
                      className="p-1.5 rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                    >
                      <Star size={15} />
                    </button>
                  )}

                  {/* Archive */}
                  <button
                    onClick={() => archiveEvent(event, true)}
                    title="Archive event"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                  >
                    <Archive size={15} />
                  </button>

                  {/* Clear all notes — empties an event you're keeping */}
                  <button
                    onClick={() => openBulkDeleteConfirm(event)}
                    title="Clear all notes"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    <Eraser size={15} />
                  </button>

                  {/* Delete the whole event — moves it (and its notes) to Trash */}
                  <button
                    onClick={() => openDeleteEventConfirm(event)}
                    title="Delete event"
                    className="p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Expand / collapse notes */}
                  <button
                    onClick={() => toggleExpand(event.id)}
                    title={isExpanded ? "Collapse" : "View notes"}
                    className="p-1.5 rounded-lg text-ink-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Notes list */}
              {isExpanded && (
                <div className="border-t border-black/5 dark:border-white/5 px-4 pb-4 pt-3 space-y-2">
                  {loadingNotes && notes.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-ink-400 py-2">
                      <Loader2 size={13} className="animate-spin" /> Loading notes…
                    </div>
                  ) : notes.length === 0 ? (
                    <p className="text-xs text-ink-400 py-2">No notes yet.</p>
                  ) : (
                    notes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "flex items-start gap-2 rounded-xl p-3 text-xs",
                          "bg-black/3 dark:bg-white/3",
                          note.isArchived && "opacity-50"
                        )}
                      >
                        {/* Color dot */}
                        <span className={cn("mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full", COLOR_DOT[note.color] ?? "bg-zinc-300")} />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ink dark:text-cream truncate">
                            {note.nickname}
                            {note.isArchived && <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-60">(archived)</span>}
                          </p>
                          <p className="text-ink-400 dark:text-ink-300 mt-0.5 break-words whitespace-pre-wrap line-clamp-3">{note.content}</p>
                          <p className="text-ink-400/60 mt-1">{formatDateTime(note.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => archiveNote(event.id, note, !note.isArchived)}
                            title={note.isArchived ? "Restore" : "Archive"}
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-ink-400"
                          >
                            {note.isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                          </button>
                          <button
                            onClick={() => openDeleteNoteConfirm(event.id, note)}
                            title="Move to Trash"
                            className="p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors text-ink-400"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Archived events section ───────────────────────────────────────── */}
      {archivedEvents.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Archived Events
          </h4>
          <div className="space-y-2">
            {archivedEvents.map((event) => {
              const isExpanded = expandedEventId === event.id;
              const isEditing = editingId === event.id;
              const notes = eventNotes[event.id] ?? [];

              return (
                <div key={event.id} className="admin-card border border-dashed rounded-2xl overflow-hidden opacity-70 hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-3 p-4">
                    <div className="shrink-0 p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400">
                      <Archive size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            maxLength={120}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameEvent(event);
                              if (e.key === "Escape") cancelRename();
                            }}
                            className="flex-1 min-w-0 font-jakarta text-sm bg-transparent border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-yellow-400/60"
                          />
                          <button
                            onClick={() => renameEvent(event)}
                            disabled={renaming}
                            title="Save name"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                          >
                            {renaming ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                          </button>
                          <button
                            onClick={cancelRename}
                            disabled={renaming}
                            title="Cancel"
                            className="p-1.5 rounded-lg text-ink-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">{event.title}</p>
                      )}
                      <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                        {event._count.notes} note{event._count.notes !== 1 ? "s" : ""} · Archived
                      </p>
                    </div>
                    <div className={cn("flex items-center gap-1 shrink-0", isEditing && "hidden")}>
                      <button
                        onClick={() => startRename(event)}
                        title="Rename event"
                        className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => archiveEvent(event, false)}
                        title="Restore event"
                        className="p-1.5 rounded-lg text-ink-400 hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                      >
                        <ArchiveRestore size={15} />
                      </button>
                      <button
                        onClick={() => openBulkDeleteConfirm(event)}
                        title="Clear all notes"
                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                      >
                        <Eraser size={15} />
                      </button>
                      <button
                        onClick={() => openDeleteEventConfirm(event)}
                        title="Delete event"
                        className="p-1.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => toggleExpand(event.id)}
                        className="p-1.5 rounded-lg text-ink-400 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-black/5 dark:border-white/5 px-4 pb-4 pt-3 space-y-2">
                      {loadingNotes && notes.length === 0 ? (
                        <div className="flex items-center gap-2 text-xs text-ink-400 py-2">
                          <Loader2 size={13} className="animate-spin" /> Loading notes…
                        </div>
                      ) : notes.length === 0 ? (
                        <p className="text-xs text-ink-400 py-2">No notes.</p>
                      ) : (
                        notes.map((note) => (
                          <div key={note.id} className="flex items-start gap-2 rounded-xl p-3 text-xs bg-black/3 dark:bg-white/3">
                            <span className={cn("mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full", COLOR_DOT[note.color] ?? "bg-zinc-300")} />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-ink dark:text-cream truncate">{note.nickname}</p>
                              <p className="text-ink-400 dark:text-ink-300 mt-0.5 break-words line-clamp-3">{note.content}</p>
                              <p className="text-ink-400/60 mt-1">{formatDateTime(note.createdAt)}</p>
                            </div>
                            <button
                              onClick={() => openDeleteNoteConfirm(event.id, note)}
                              title="Move to Trash"
                              className="p-1 rounded hover:bg-red-500/10 hover:text-red-500 transition-colors text-ink-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Single-note delete confirmation ──────────────────────────────── */}
      {deleteNoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 admin-card border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-red-500/10 mb-3">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-jakarta font-semibold text-ink dark:text-cream">Move note to Trash?</h3>
              <p className="text-xs text-ink-400 dark:text-ink-300 mt-2">
                It comes off the public wall right away. You can view, restore or permanently
                delete it later under <strong>Trash → Freedom Wall</strong>.
              </p>
            </div>

            {/* Preview of exactly what's being removed */}
            <div className="rounded-xl p-3 text-xs bg-black/3 dark:bg-white/3 text-left flex items-start gap-2">
              <span className={cn("mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full", COLOR_DOT[deleteNoteTarget.note.color] ?? "bg-zinc-300")} />
              <div className="min-w-0">
                <p className="font-semibold text-ink dark:text-cream truncate">{deleteNoteTarget.note.nickname}</p>
                <p className="text-ink-400 dark:text-ink-300 mt-0.5 break-words whitespace-pre-wrap line-clamp-4">
                  {deleteNoteTarget.note.content}
                </p>
                <p className="text-ink-400/60 mt-1">{formatDateTime(deleteNoteTarget.note.createdAt)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteNoteTarget(null)}
                disabled={deletingNote}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteNote(deleteNoteTarget.eventId, deleteNoteTarget.note)}
                disabled={deletingNote}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deletingNote ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deletingNote ? "Moving…" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk-delete confirmation modal ───────────────────────────────── */}
      {bulkDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 admin-card border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-red-500/10 mb-3">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-jakarta font-semibold text-ink dark:text-cream">Delete all notes?</h3>
              <p className="text-xs text-ink-400 dark:text-ink-300 mt-2">
                This moves{" "}
                <strong>{bulkDeleteTarget._count.notes} note{bulkDeleteTarget._count.notes !== 1 ? "s" : ""}</strong>{" "}
                from <em>&ldquo;{bulkDeleteTarget.title}&rdquo;</em> to the Trash and takes them
                off the public wall. You can restore or permanently delete them from{" "}
                <strong>Trash → Freedom Wall</strong>.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setBulkDeleteTarget(null)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkDeleteNotes(bulkDeleteTarget)}
                disabled={bulkDeleting}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {bulkDeleting ? "Moving…" : "Move all to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Whole-event delete confirmation modal ────────────────────────── */}
      {deleteEventTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 admin-card border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-full bg-red-500/10 mb-3">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h3 className="font-jakarta font-semibold text-ink dark:text-cream">Delete this event?</h3>
              <p className="text-xs text-ink-400 dark:text-ink-300 mt-2">
                <em>&ldquo;{deleteEventTarget.title}&rdquo;</em> and its{" "}
                <strong>{deleteEventTarget._count.notes} note{deleteEventTarget._count.notes !== 1 ? "s" : ""}</strong>{" "}
                move to <strong>Trash → Freedom Wall → Events</strong>, where you can restore the
                whole event or delete it permanently.
                {settings.activeEventId === deleteEventTarget.id && (
                  <> This is the active event, so the wall will have no event set until you pick another.</>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteEventTarget(null)}
                disabled={deletingEvent}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEvent(deleteEventTarget)}
                disabled={deletingEvent}
                className="flex-1 px-4 py-2 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deletingEvent ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deletingEvent ? "Moving…" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
