"use client";

// app/(admin)/admin/settings/release-notes/ReleaseNotesClient.tsx
//
// Admin CRUD for the navbar's Release Notes panel — see
// app/api/release-notes/route.ts and components/public/ReleaseNotes.tsx.
//
// The list here is every note ever written; the public panel only ever shows
// the newest few published ones, so the rows past that cut-off are marked
// "Not shown publicly" rather than hidden — an admin should be able to see
// what fell off the end and why.
import { useState } from "react";
import { Sparkles, Plus, Pencil, Trash2, X, AlertTriangle, EyeOff } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { cn, getErrorMessage } from "@/lib/utils";
import { Toggle } from "../../artworks/museum-ui";
import {
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_LIMIT_MIN,
  RELEASE_NOTE_LIMIT_MAX,
  MAX_RELEASE_NOTE_TITLE,
  MAX_RELEASE_NOTE_BODY,
  releaseNoteAccent,
  formatReleaseNoteDate,
  type ReleaseNote,
} from "@/lib/release-notes";

/** `<input type="datetime-local">` wants local time with no zone suffix. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = {
  title: "",
  body: "",
  category: "General",
  version: "",
  isPublished: true,
  publishedAt: "",
};

export function ReleaseNotesClient({
  initialEnabled,
  initialLimit,
  initialNotes,
}: {
  initialEnabled: boolean;
  initialLimit: number;
  initialNotes: ReleaseNote[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limit, setLimit] = useState(initialLimit);
  const [notes, setNotes] = useState<ReleaseNote[]>(initialNotes);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReleaseNote | null>(null);

  // Same rule as every other modal in the app: a fixed overlay that doesn't
  // lock the body lets a scroll started on it fall through to the settings
  // page behind, which slides away under the dialog.
  useLockBodyScroll(pendingDelete !== null);

  // Which notes the public panel is actually showing right now — the newest
  // `limit` published ones, in the same order the API returns them.
  const liveIds = new Set(
    notes.filter((n) => n.isPublished).slice(0, limit).map((n) => n.id)
  );

  async function saveSetting(patch: { releaseNotesEnabled?: boolean; releaseNotesLimit?: number }) {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      toast.success(
        patch.releaseNotesEnabled !== undefined
          ? patch.releaseNotesEnabled
            ? "Release Notes shown in the navbar"
            : "Release Notes hidden from the navbar"
          : "Notes shown updated"
      );
      return true;
    } catch {
      toast.error("Failed to save setting");
      return false;
    }
  }

  async function toggleEnabled(next: boolean) {
    setEnabled(next);
    if (!(await saveSetting({ releaseNotesEnabled: next }))) setEnabled(!next);
  }

  async function changeLimit(next: number) {
    const previous = limit;
    setLimit(next);
    if (!(await saveSetting({ releaseNotesLimit: next }))) setLimit(previous);
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(n: ReleaseNote) {
    setForm({
      title: n.title,
      body: n.body,
      category: n.category,
      version: n.version ?? "",
      isPublished: n.isPublished,
      publishedAt: toLocalInput(n.publishedAt),
    });
    setEditingId(n.id);
    setCreating(true);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
  }

  function sortNotes(list: ReleaseNote[]) {
    return [...list].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  async function submitForm() {
    const title = form.title.trim();
    const body = form.body.trim();
    if (!title) {
      toast.error("Title is required");
      return;
    }
    if (!body) {
      toast.error("Description is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/release-notes/${editingId}` : "/api/release-notes";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          category: form.category,
          version: form.version.trim() || null,
          isPublished: form.isPublished,
          // Blank means "now" on create, and "leave it alone" on edit.
          ...(form.publishedAt
            ? { publishedAt: new Date(form.publishedAt).toISOString() }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save release note");

      setNotes((prev) =>
        sortNotes(editingId ? prev.map((n) => (n.id === editingId ? data : n)) : [data, ...prev])
      );
      toast.success(editingId ? "Release note updated" : "Release note published");
      cancelForm();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save release note"));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(n: ReleaseNote, isPublished: boolean) {
    const previous = notes;
    setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, isPublished } : x)));
    try {
      const res = await fetch(`/api/release-notes/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished }),
      });
      if (!res.ok) throw new Error();
      toast.success(isPublished ? "Note published" : "Note moved to draft");
    } catch {
      setNotes(previous);
      toast.error("Failed to update release note");
    }
  }

  /** Opens the confirm modal and plays the same "are you sure?" cue every
   *  other delete in the admin does (see lib/sound/registry.ts's
   *  admin.deleteConfirm). The matching "deleted" sound needs no wiring — the
   *  toast below says "deleted", which is what admin.delete listens for. */
  function askDelete(note: ReleaseNote) {
    playSoundEffect("admin.deleteConfirm");
    setPendingDelete(note);
  }

  async function confirmDelete() {
    const note = pendingDelete;
    if (!note) return;
    const previous = notes;
    setNotes((prev) => prev.filter((x) => x.id !== note.id));
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/release-notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Release note moved to Trash");
    } catch {
      setNotes(previous);
      toast.error("Failed to delete release note");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Panel settings */}
      <div className="admin-card border rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              Show in the site navbar
            </p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              The sparkle icon beside the light/dark switch. Off hides it from visitors entirely
            </p>
          </div>
          <Toggle checked={enabled} onChange={toggleEnabled} label="Toggle release notes panel" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/5 dark:border-white/5">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              Notes shown at once
            </p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              Visitors always see the newest ones. Publishing another pushes the oldest out of the
              list rather than making it longer
            </p>
          </div>
          {/* AdminSelect, not a bare <select>: a native select paints its arrow
              hard against the right border with no padding of its own, which is
              what had the caret crowding the number here. */}
          <AdminSelect
            value={limit}
            onChange={(e) => changeLimit(Number(e.target.value))}
            className="py-2 text-sm"
            wrapperClassName="shrink-0"
            aria-label="Notes shown at once"
          >
            {Array.from(
              { length: RELEASE_NOTE_LIMIT_MAX - RELEASE_NOTE_LIMIT_MIN + 1 },
              (_, i) => RELEASE_NOTE_LIMIT_MIN + i
            ).map((n) => (
              <option key={n} value={n} className="bg-white dark:bg-ink-900">
                {n}
              </option>
            ))}
          </AdminSelect>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-jakarta text-sm font-semibold text-ink dark:text-cream">Notes</h3>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors"
        >
          <Plus size={14} />
          Add Note
        </button>
      </div>

      {creating && (
        <div className="admin-card border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Title
              </label>
              <input
                type="text"
                maxLength={MAX_RELEASE_NOTE_TITLE}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Press [Q] to recolour the museum"
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Where on the site
              </label>
              <input
                list="release-note-categories"
                type="text"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
              {/* A datalist, not a select — the suggested areas cover what
                  exists today, but a new room shouldn't need a code change. */}
              <datalist id="release-note-categories">
                {RELEASE_NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
              What changed
            </label>
            <textarea
              rows={4}
              maxLength={MAX_RELEASE_NOTE_BODY}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Plain words, for a visitor — what they can now do that they couldn't before."
              className="admin-input w-full px-3 py-2 rounded-xl text-sm resize-y"
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
              {form.body.length} / {MAX_RELEASE_NOTE_BODY} &middot; line breaks are kept
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_auto] gap-3 items-end">
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Version <span className="opacity-60">(optional)</span>
              </label>
              <input
                type="text"
                value={form.version}
                onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                placeholder="e.g. v6.15"
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Date shown {!editingId && <span className="opacity-60">(blank = now)</span>}
              </label>
              <AdminDatePicker
                withTime
                value={form.publishedAt}
                onChange={(publishedAt) => setForm((f) => ({ ...f, publishedAt }))}
                placeholder="Now"
                className="px-3 py-2 text-sm"
                ariaLabel="Date shown"
              />
            </div>
            {/* No bottom padding to nudge this into line: the switch is
                exactly as tall as the two fields beside it (Toggle is a 26px
                icon in p-1.5 = 38px; an admin-input is py-2 + text-sm + its
                border = 38px too), so the row's own items-end lands all three
                on the same baseline. A nudge here only pushes the switch back
                off it, which is what it was doing. */}
            <div className="flex items-center gap-2">
              <Toggle
                checked={form.isPublished}
                onChange={(isPublished) => setForm((f) => ({ ...f, isPublished }))}
                label="Publish this note"
              />
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                {form.isPublished ? "Published" : "Draft"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={submitForm}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
            >
              {editingId ? "Save Changes" : "Create Note"}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded-xl text-sm font-medium text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 && !creating && (
        <div className="admin-card border rounded-2xl p-8 text-center">
          <Sparkles size={28} className="mx-auto text-ink-400 dark:text-ink-300 mb-3" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">
            No release notes yet — add one and it appears in the site navbar straight away.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {notes.map((n) => {
          const live = liveIds.has(n.id);
          return (
            <div key={n.id} className="admin-card border rounded-2xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] uppercase tracking-wider",
                      releaseNoteAccent(n.category)
                    )}
                  >
                    {n.category}
                  </span>
                  {n.version && (
                    <span className="font-jakarta text-[10px] text-ink-400 dark:text-ink-300">
                      {n.version}
                    </span>
                  )}
                  {!n.isPublished ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                      <EyeOff size={9} />
                      Draft
                    </span>
                  ) : live ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Live in navbar
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10"
                      title={`Only the newest ${limit} published notes are shown to visitors`}
                    >
                      Past the newest {limit}
                    </span>
                  )}
                </div>
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream leading-snug">
                  {n.title}
                </p>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 line-clamp-2 mt-0.5">
                  {n.body}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                  {formatReleaseNoteDate(n.publishedAt)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Toggle
                  checked={n.isPublished}
                  onChange={(isPublished) => togglePublished(n, isPublished)}
                  label={`Publish ${n.title}`}
                />
                <button
                  onClick={() => startEdit(n)}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => askDelete(n)}
                  className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deliberately not routed through Trash — a release note holds no
          artwork or upload and nothing references it, so there's nothing to
          orphan. Same call as the Companion delete modal. */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl p-6"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
                  Delete this release note?
                </h3>
                <p className="font-body text-sm text-ink-400 dark:text-ink-300 mt-1">
                  &ldquo;{pendingDelete.title}&rdquo; moves to Trash, where you can restore it
                  or delete it for good.
                </p>
              </div>
              <button
                onClick={() => setPendingDelete(null)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
