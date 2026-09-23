"use client";

// app/(admin)/admin/videos/VideosClient.tsx
//
// The Videos editor — the Releases module's list/modal shape with a
// smaller form: paste a YouTube link (checked live, thumbnail shown),
// title, kind, the release it belongs to, a note. Featured / published
// switches and up-down ordering on the cards.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clapperboard, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { FieldLabel, SelectField, TextField, ToggleRow } from "@/app/(admin)/admin/site-design/fields";
import { parseYouTube } from "@/lib/embeds";
import {
  MAX_VIDEO_DESCRIPTION,
  MAX_VIDEO_TITLE,
  VIDEO_KINDS,
  VIDEO_KIND_LABELS,
  youtubeThumbnail,
  type VideoKind,
} from "@/lib/videos";

export interface VideoRow {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  kind: VideoKind;
  releaseId: string | null;
  release: { id: string; title: string; slug: string | null } | null;
  description: string | null;
  published: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
}

interface FormState {
  title: string;
  youtubeUrl: string;
  kind: VideoKind;
  releaseId: string;
  description: string;
  published: boolean;
  featured: boolean;
}

const EMPTY: FormState = { title: "", youtubeUrl: "", kind: "MUSIC_VIDEO", releaseId: "", description: "", published: true, featured: false };
const KIND_OPTIONS = VIDEO_KINDS.map((k) => ({ value: k, label: VIDEO_KIND_LABELS[k] }));
const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

export function VideosClient({ initialVideos, releases }: { initialVideos: VideoRow[]; releases: { id: string; title: string }[] }) {
  const router = useRouter();
  const [videos, setVideos] = useState(initialVideos);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VideoRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  useLockBodyScroll(modalOpen);

  const releaseOptions = useMemo(() => [{ value: "", label: "— none —" }, ...releases.map((r) => ({ value: r.id, label: r.title }))], [releases]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? videos.filter((v) => v.title.toLowerCase().includes(q) || v.release?.title.toLowerCase().includes(q)) : videos;
  }, [videos, query]);
  const canReorder = query.trim() === "";
  const parsed = form.youtubeUrl.trim() ? parseYouTube(form.youtubeUrl) : null;
  const urlInvalid = form.youtubeUrl.trim() !== "" && !parsed;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(v: VideoRow) {
    setEditing(v);
    setForm({ title: v.title, youtubeUrl: v.youtubeUrl, kind: v.kind, releaseId: v.releaseId ?? "", description: v.description ?? "", published: v.published, featured: v.featured });
    setModalOpen(true);
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Give the video a title.");
    if (!parsed) return toast.error("Paste a YouTube link.");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/videos/${editing.id}` : "/api/videos", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, releaseId: form.releaseId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save video");
      setVideos((prev) => (editing ? prev.map((v) => (v.id === data.id ? data : v)) : [...prev, data]));
      toast.success(editing ? "Video updated" : "Video added");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save video"));
    } finally {
      setSaving(false);
    }
  }

  async function patchQuick(v: VideoRow, patch: Partial<Pick<VideoRow, "published" | "featured">>, label: string) {
    const prev = videos;
    setVideos((list) => list.map((x) => (x.id === v.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/videos/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(label);
      router.refresh();
    } catch (err) {
      setVideos(prev);
      toast.error(getErrorMessage(err, "Failed to update"));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= videos.length) return;
    const next = [...videos];
    [next[index], next[j]] = [next[j], next[index]];
    setVideos(next.map((v, i) => ({ ...v, sortOrder: i })));
    try {
      const res = await fetch("/api/videos/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: next.map((v, i) => ({ id: v.id, sortOrder: i })) }) });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch (err) {
      setVideos(videos);
      toast.error(getErrorMessage(err, "Failed to reorder"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVideos((list) => list.filter((v) => v.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" moved to Trash`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos…" className={cn(inputBase, "pl-9")} />
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark">
          <Plus size={16} /> New video
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="admin-card rounded-2xl border p-10 text-center">
          <Clapperboard size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">{videos.length === 0 ? "No videos yet. Paste the first YouTube link." : "Nothing matches that search."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((v, index) => (
            <li key={v.id} className="admin-card overflow-hidden rounded-2xl border">
              <button type="button" onClick={() => openEdit(v)} className="block w-full" aria-label={`Edit ${v.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={youtubeThumbnail(v.youtubeId)} alt="" className="aspect-video w-full object-cover" />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-ink dark:text-cream">{v.title}</p>
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                      {VIDEO_KIND_LABELS[v.kind]}
                      {v.release ? ` · ${v.release.title}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => patchQuick(v, { featured: !v.featured }, v.featured ? "No longer featured" : "Featured on the homepage strip")} title={v.featured ? "Featured" : "Feature"} className={cn("rounded-lg p-1.5 transition-colors", v.featured ? "text-amber-500 hover:bg-amber-500/10" : "text-ink-300 hover:bg-black/5 dark:hover:bg-white/5")}>
                      <Star size={16} fill={v.featured ? "currentColor" : "none"} />
                    </button>
                    <button type="button" onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><Pencil size={16} /></button>
                    <button type="button" onClick={() => setDeleteTarget(v)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-500" title="Move to Trash"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => patchQuick(v, { published: !v.published }, v.published ? "Hidden from the site" : "Published")} className={cn("rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider", v.published ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-black/10 text-ink-400 dark:border-white/10 dark:text-ink-300")}>
                    {v.published ? "Published" : "Hidden"}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!canReorder || index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move up"><ArrowUp size={14} /></button>
                    <button type="button" disabled={!canReorder || index === visible.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move down"><ArrowDown size={14} /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => !saving && setModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={editing ? "Edit video" : "New video"} onClick={(e) => e.stopPropagation()} className="admin-modal flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl border sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <h2 className="font-body text-base font-semibold text-ink dark:text-cream">{editing ? "Edit video" : "New video"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <FieldLabel>YouTube link</FieldLabel>
                <input type="url" value={form.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" className={cn(inputBase, urlInvalid && "border-red-500/60")} />
                <p className={cn("mt-1 font-body text-xs", urlInvalid ? "text-red-500" : "text-ink-400 dark:text-ink-300")}>
                  {urlInvalid ? "Not a YouTube link." : "watch, youtu.be or shorts links all work."}
                </p>
                {parsed?.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={parsed.thumbnailUrl} alt="" className="mx-auto mt-3 aspect-video w-full max-w-sm rounded-xl object-cover" />
                )}
              </div>
              <TextField label="Title" value={form.title} onChange={(v) => set("title", v)} maxLength={MAX_VIDEO_TITLE} placeholder="Song title — Official video" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField label="Kind" value={form.kind} onChange={(v) => set("kind", v)} options={KIND_OPTIONS} />
                <SelectField label="Release" value={form.releaseId} onChange={(v) => set("releaseId", v)} options={releaseOptions} hint="Optional — links the video to a release." />
              </div>
              <div>
                <FieldLabel hint={`${form.description.length}/${MAX_VIDEO_DESCRIPTION}`}>Note</FieldLabel>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value.slice(0, MAX_VIDEO_DESCRIPTION))} rows={3} placeholder="Optional — where it was shot, who made it." className={cn(inputBase, "resize-y")} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleRow label="Published" value={form.published} onChange={(v) => set("published", v)} words={{ on: "shown", off: "hidden" }} />
                <ToggleRow label="Featured" description="Leads the homepage strip." value={form.featured} onChange={(v) => set("featured", v)} words={{ on: "featured", off: "not featured" }} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl px-4 py-2.5 font-body text-sm text-ink-400 hover:text-ink dark:hover:text-cream">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-sepia px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add video"}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={deleteTarget !== null}
        title="Move to Trash?"
        description={deleteTarget ? `"${deleteTarget.title}" leaves the Videos page. You can restore it from Trash.` : undefined}
        confirmLabel="Move to Trash"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
