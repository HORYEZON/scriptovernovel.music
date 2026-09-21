"use client";

// app/(admin)/admin/vinyls/VinylsClient.tsx
//
// The Vinyls editor — the Videos module's list/modal shape with a smaller
// form: pick the release, upload the audio (the same signed R2 upload the
// museum soundtrack uses), an optional side label. Published switch and
// up-down ordering on the cards; the order is the wall order in the room.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Disc3, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { SelectField, TextField, ToggleRow } from "@/app/(admin)/admin/site-design/fields";
import { AudioUploader } from "@/app/(admin)/admin/settings/Preferences/AudioUploader";
import { MAX_SIDE_LABEL, type AdminVinyl, type VinylReleaseSummary } from "@/lib/vinyls";

interface FormState {
  releaseId: string;
  audioUrl: string;
  sideLabel: string;
  published: boolean;
}

const EMPTY: FormState = { releaseId: "", audioUrl: "", sideLabel: "", published: true };
const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

export function VinylsClient({ initialVinyls, releases }: { initialVinyls: AdminVinyl[]; releases: VinylReleaseSummary[] }) {
  const router = useRouter();
  const [vinyls, setVinyls] = useState(initialVinyls);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVinyl | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminVinyl | null>(null);
  const [deleting, setDeleting] = useState(false);
  useLockBodyScroll(modalOpen);

  const releaseOptions = useMemo(
    () => [{ value: "", label: "— pick a release —" }, ...releases.map((r) => ({ value: r.id, label: r.published ? r.title : `${r.title} (unpublished)` }))],
    [releases]
  );
  const chosenRelease = releases.find((r) => r.id === form.releaseId) ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? vinyls.filter((v) => v.release.title.toLowerCase().includes(q) || v.sideLabel?.toLowerCase().includes(q)) : vinyls;
  }, [vinyls, query]);
  const canReorder = query.trim() === "";

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(v: AdminVinyl) {
    setEditing(v);
    setForm({ releaseId: v.releaseId, audioUrl: v.audioUrl, sideLabel: v.sideLabel ?? "", published: v.published });
    setModalOpen(true);
  }

  async function save() {
    if (!form.releaseId) return toast.error("Pick a release.");
    if (!form.audioUrl) return toast.error("Upload the audio file.");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/vinyls/${editing.id}` : "/api/vinyls", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sideLabel: form.sideLabel || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save vinyl");
      setVinyls((prev) => (editing ? prev.map((v) => (v.id === data.id ? data : v)) : [...prev, data]));
      toast.success(editing ? "Vinyl updated" : "Vinyl added — it hangs in the room on its next load");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save vinyl"));
    } finally {
      setSaving(false);
    }
  }

  async function patchQuick(v: AdminVinyl, patch: Partial<Pick<AdminVinyl, "published">>, label: string) {
    const prev = vinyls;
    setVinyls((list) => list.map((x) => (x.id === v.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/vinyls/${v.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(label);
      router.refresh();
    } catch (err) {
      setVinyls(prev);
      toast.error(getErrorMessage(err, "Failed to update"));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= vinyls.length) return;
    const next = [...vinyls];
    [next[index], next[j]] = [next[j], next[index]];
    setVinyls(next.map((v, i) => ({ ...v, sortOrder: i })));
    try {
      const res = await fetch("/api/vinyls/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: next.map((v, i) => ({ id: v.id, sortOrder: i })) }) });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch (err) {
      setVinyls(vinyls);
      toast.error(getErrorMessage(err, "Failed to reorder"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/vinyls/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVinyls((list) => list.filter((v) => v.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.release.title}" moved to Trash`);
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
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search vinyls…" className={cn(inputBase, "pl-9")} />
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark">
          <Plus size={16} /> New vinyl
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="admin-card rounded-2xl border p-10 text-center">
          <Disc3 size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">
            {vinyls.length === 0 ? "No records yet. Add a release and its audio to hang the first one." : "Nothing matches that search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((v, index) => (
            <li key={v.id} className="admin-card overflow-hidden rounded-2xl border">
              <button type="button" onClick={() => openEdit(v)} className="block w-full" aria-label={`Edit ${v.release.title}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.release.coverImageUrl} alt="" className="aspect-square w-full object-cover" />
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-ink dark:text-cream">{v.release.title}</p>
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                      {v.sideLabel ?? "Full record"}
                      {` · ${v.release.trackCount} track${v.release.trackCount === 1 ? "" : "s"}`}
                      {!v.release.published && " · release unpublished"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><Pencil size={16} /></button>
                    <button type="button" onClick={() => setDeleteTarget(v)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-500" title="Move to Trash"><Trash2 size={16} /></button>
                  </div>
                </div>
                <audio src={v.audioUrl} controls preload="none" className="mt-3 h-9 w-full" />
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => patchQuick(v, { published: !v.published }, v.published ? "Taken off the wall" : "Hung in the Vinyl Room")} className={cn("rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider", v.published ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-black/10 text-ink-400 dark:border-white/10 dark:text-ink-300")}>
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
          <div role="dialog" aria-modal="true" aria-label={editing ? "Edit vinyl" : "New vinyl"} onClick={(e) => e.stopPropagation()} className="admin-modal flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl border sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <h2 className="font-body text-base font-semibold text-ink dark:text-cream">{editing ? "Edit vinyl" : "New vinyl"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex items-start gap-4">
                {chosenRelease && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={chosenRelease.coverImageUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <SelectField
                    label="Release"
                    value={form.releaseId}
                    onChange={(v) => set("releaseId", v)}
                    options={releaseOptions}
                    hint={chosenRelease ? `The sleeve shows this cover; the Lyrics Wall reads its ${chosenRelease.trackCount} track${chosenRelease.trackCount === 1 ? "'s" : "s'"} lyrics.` : "The cover, title and tracklist come from the release."}
                  />
                </div>
              </div>
              <AudioUploader
                value={form.audioUrl}
                onChange={(url) => set("audioUrl", url)}
                label="Audio file"
                hint="What plays when a visitor puts this record on — the whole release as one file, or one side of it."
                successMessage="Audio uploaded"
              />
              <TextField label="Side label" value={form.sideLabel} onChange={(v) => set("sideLabel", v)} maxLength={MAX_SIDE_LABEL} placeholder="Side A · Full record · Live take" hint="Optional — shown on the deck." />
              <ToggleRow label="Published" description="Published records hang on the Vinyl Room's wall on its next load." value={form.published} onChange={(v) => set("published", v)} words={{ on: "hung", off: "hidden" }} />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl px-4 py-2.5 font-body text-sm text-ink-400 hover:text-ink dark:hover:text-cream">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-sepia px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add vinyl"}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={deleteTarget !== null}
        title="Move to Trash?"
        description={deleteTarget ? `"${deleteTarget.release.title}" comes off the Vinyl Room's wall. You can restore it from Trash; emptying Trash deletes its audio file.` : undefined}
        confirmLabel="Move to Trash"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
