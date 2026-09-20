"use client";

// app/(admin)/admin/band-members/BandMembersClient.tsx
//
// Band members editor — the Videos module's list/modal shape: cards with
// photo, name, role; a modal with photo upload (ImageField), name, role,
// blurb, published switch; up-down ordering; trash.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { SafeImg } from "@/components/ui/SafeImage";
import { imageVariantUrl } from "@/lib/images/variants";
import { FieldLabel, ImageField, TextField, ToggleRow } from "@/app/(admin)/admin/site-design/fields";
import { MAX_MEMBER_BLURB, MAX_MEMBER_NAME, MAX_MEMBER_ROLE } from "@/lib/band-members";

export interface MemberRow {
  id: string;
  name: string;
  role: string;
  photoUrl: string | null;
  blurb: string | null;
  published: boolean;
  sortOrder: number;
}

interface FormState {
  name: string;
  role: string;
  photoUrl: string | null;
  blurb: string;
  published: boolean;
}
const EMPTY: FormState = { name: "", role: "", photoUrl: null, blurb: "", published: true };
const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

export function BandMembersClient({ initialMembers }: { initialMembers: MemberRow[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  useLockBodyScroll(modalOpen);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  }
  function openEdit(m: MemberRow) {
    setEditing(m);
    setForm({ name: m.name, role: m.role, photoUrl: m.photoUrl, blurb: m.blurb ?? "", published: m.published });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!form.role.trim()) return toast.error("Say what they play.");
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/band-members/${editing.id}` : "/api/band-members", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMembers((prev) => (editing ? prev.map((m) => (m.id === data.id ? data : m)) : [...prev, data]));
      toast.success(editing ? "Member updated" : "Member added");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(m: MemberRow) {
    const prev = members;
    setMembers((list) => list.map((x) => (x.id === m.id ? { ...x, published: !m.published } : x)));
    try {
      const res = await fetch(`/api/band-members/${m.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published: !m.published }) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(m.published ? "Hidden from About" : "Shown on About");
      router.refresh();
    } catch (err) {
      setMembers(prev);
      toast.error(getErrorMessage(err, "Failed to update"));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= members.length) return;
    const next = [...members];
    [next[index], next[j]] = [next[j], next[index]];
    setMembers(next.map((m, i) => ({ ...m, sortOrder: i })));
    try {
      const res = await fetch("/api/band-members/reorder", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: next.map((m, i) => ({ id: m.id, sortOrder: i })) }) });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch (err) {
      setMembers(members);
      toast.error(getErrorMessage(err, "Failed to reorder"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/band-members/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setMembers((list) => list.filter((m) => m.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name} moved to Trash`);
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
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark">
          <Plus size={16} /> Add member
        </button>
      </div>

      {members.length === 0 ? (
        <div className="admin-card rounded-2xl border p-10 text-center">
          <Users size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">No members yet — add the band one by one.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {members.map((m, index) => (
            <li key={m.id} className="admin-card overflow-hidden rounded-2xl border">
              <button type="button" onClick={() => openEdit(m)} className="block w-full" aria-label={`Edit ${m.name}`}>
                {m.photoUrl ? (
                  <SafeImg src={imageVariantUrl(m.photoUrl, "medium")} alt="" className="aspect-[4/5] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center bg-black/5 text-ink-300 dark:bg-white/5"><Users size={32} /></div>
                )}
              </button>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-semibold text-ink dark:text-cream">{m.name}</p>
                    <p className="truncate font-body text-xs text-ink-400 dark:text-ink-300">{m.role}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => openEdit(m)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" title="Edit"><Pencil size={16} /></button>
                    <button type="button" onClick={() => setDeleteTarget(m)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-500" title="Move to Trash"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button type="button" onClick={() => togglePublished(m)} className={cn("rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider", m.published ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-black/10 text-ink-400 dark:border-white/10 dark:text-ink-300")}>
                    {m.published ? "Shown" : "Hidden"}
                  </button>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move up"><ArrowUp size={14} /></button>
                    <button type="button" disabled={index === members.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move down"><ArrowDown size={14} /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => !saving && setModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label={editing ? "Edit member" : "Add member"} onClick={(e) => e.stopPropagation()} className="admin-modal flex max-h-[95vh] w-full max-w-2xl flex-col rounded-t-2xl border sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <h2 className="font-body text-base font-semibold text-ink dark:text-cream">{editing ? "Edit member" : "Add member"}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
                <ImageField label="Photo" value={form.photoUrl} onChange={(v) => set("photoUrl", v)} aspect="aspect-[4/5]" hint="Portrait works best." />
                <div className="space-y-5">
                  <TextField label="Name" value={form.name} onChange={(v) => set("name", v)} maxLength={MAX_MEMBER_NAME} placeholder="Full name or stage name" />
                  <TextField label="Role" value={form.role} onChange={(v) => set("role", v)} maxLength={MAX_MEMBER_ROLE} placeholder="Vocals, guitar" />
                  <div>
                    <FieldLabel hint={`${form.blurb.length}/${MAX_MEMBER_BLURB}`}>Blurb</FieldLabel>
                    <textarea value={form.blurb} onChange={(e) => set("blurb", e.target.value.slice(0, MAX_MEMBER_BLURB))} rows={4} placeholder="A line or two — optional." className={cn(inputBase, "resize-y")} />
                  </div>
                  <ToggleRow label="Shown on About" value={form.published} onChange={(v) => set("published", v)} words={{ on: "shown", off: "hidden" }} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="rounded-xl px-4 py-2.5 font-body text-sm text-ink-400 hover:text-ink dark:hover:text-cream">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-sepia px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add member"}</button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={deleteTarget !== null}
        title="Move to Trash?"
        description={deleteTarget ? `${deleteTarget.name} leaves the About page. You can restore them from Trash.` : undefined}
        confirmLabel="Move to Trash"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
