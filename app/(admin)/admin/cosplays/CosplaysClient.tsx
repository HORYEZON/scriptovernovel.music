// app/(admin)/admin/cosplays/CosplaysClient.tsx
"use client";

// Cosplays admin module — costume photography, each entry a standee shot plus
// an optional photo to hang behind it in the Digital Museum's Cosplay Room.
//
// Structurally a smaller sibling of ../stories/StoriesClient.tsx: the same
// search + status filter bar, the same publish/edit/delete row actions, the same
// modal shell and the same upload rules. Two deliberate departures:
//
//  • A card grid rather than a table. The whole module is photographs, and a
//    table of filenames tells an admin nothing about which costume is which.
//  • Reorder arrows on every card. `displayOrder` isn't cosmetic here — it is
//    the order standees are placed around the Cosplay Room's walls (see
//    lib/museum/cosplayRoom.ts's sync and standeePlacement.ts), so moving a card
//    moves a standee.
//
// There is no public /cosplays page: the museum room *is* this module's public
// surface, which is why every action links there rather than to a web gallery.
import { useState, useRef, useCallback, useMemo } from "react";
import Image from "@/components/ui/SafeImage";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Search,
  ChevronUp,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Shirt,
  Camera,
  User,
  AlertTriangle,
  Image as ImageIcon,
  Maximize2,
  LayoutGrid,
  List,
} from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { ImagePreviewModal, type PreviewImage } from "@/components/public/ImagePreviewModal";
import toast from "@/lib/toast";
import { toggleStaged } from "@/lib/admin/toggleToast";
import { playSoundEffect } from "@/lib/sound/engine";
import {
  COSPLAY_IMAGE_ACCEPT,
  COSPLAY_IMAGE_HINT,
  COSPLAY_IMAGE_MAX_BYTES,
  STANDEE_PHOTO_HINT,
  BACKDROP_PHOTO_HINT,
} from "@/lib/cosplays";

export interface Cosplay {
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
  displayOrder: number;
  slug: string | null;
}

type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

/**
 * Same two-way toggle every other module's list has (Stories, Products,
 * Artworks…), with the default flipped: this module is photographs, so the
 * card grid is the view that answers "which costume is which" and stays the
 * one it opens on. The list is for the other question — scanning credits,
 * events and years down a column, which a grid of photos is bad at.
 */
type ViewMode = "grid" | "list";

/** Which of the two photo slots an upload is targeting — the one thing the
 *  shared upload handler needs to know. */
type PhotoSlot = "standee" | "backdrop";

interface FormState {
  title: string;
  character: string;
  series: string;
  description: string;
  standeeImageUrl: string;
  backdropImageUrl: string;
  cosplayer: string;
  photographer: string;
  year: string;
  event: string;
  published: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  character: "",
  series: "",
  description: "",
  standeeImageUrl: "",
  backdropImageUrl: "",
  cosplayer: "",
  photographer: "",
  year: "",
  event: "",
  published: true,
};

function toForm(cosplay: Cosplay): FormState {
  return {
    title: cosplay.title,
    character: cosplay.character ?? "",
    series: cosplay.series ?? "",
    description: cosplay.description ?? "",
    standeeImageUrl: cosplay.standeeImageUrl,
    backdropImageUrl: cosplay.backdropImageUrl ?? "",
    cosplayer: cosplay.cosplayer ?? "",
    photographer: cosplay.photographer ?? "",
    year: cosplay.year ? String(cosplay.year) : "",
    event: cosplay.event ?? "",
    published: cosplay.published,
  };
}

export function CosplaysClient({ initialCosplays }: { initialCosplays: Cosplay[] }) {
  const [cosplays, setCosplays] = useState<Cosplay[]>(initialCosplays);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cosplay | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<PhotoSlot | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cosplay | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Full-size look at either uploaded photo, from the card grid and from
  // inside the create/edit modal. The same lightbox the shop and checkout use
  // (ImagePreviewModal), because the question it answers here is the same one:
  // the thumbnails are cropped square-ish, and what actually gets printed on a
  // standee — or hung behind it — is the whole frame.
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const standeeInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);

  useLockBodyScroll(showModal || Boolean(deleteTarget));

  const publishedCount = cosplays.filter((c) => c.published).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cosplays
      .filter((c) => {
        if (statusFilter === "PUBLISHED" && !c.published) return false;
        if (statusFilter === "DRAFT" && c.published) return false;
        if (!query) return true;
        return [c.title, c.character, c.series, c.event, c.cosplayer, c.photographer]
          .filter(Boolean)
          .some((field) => (field as string).toLowerCase().includes(query));
      })
      // Always shown in the order the museum places them, so the reorder arrows
      // are the only thing that changes what an admin sees here.
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [cosplays, search, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(cosplay: Cosplay) {
    setEditing(cosplay);
    setForm(toForm(cosplay));
    setShowModal(true);
  }

  const handleUpload = useCallback(async (file: File, slot: PhotoSlot) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > COSPLAY_IMAGE_MAX_BYTES) {
      toast.error("File too large (max 10 MB)");
      return;
    }

    setUploadingSlot(slot);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      const { url } = await res.json();
      setForm((prev) =>
        slot === "standee" ? { ...prev, standeeImageUrl: url } : { ...prev, backdropImageUrl: url }
      );
      toast.success(slot === "standee" ? "Standee photo uploaded" : "Backdrop photo uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("A title is required");
      return;
    }
    if (!form.standeeImageUrl) {
      toast.error("A standee photo is required — it's what the standee is printed with");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        character: form.character,
        series: form.series,
        description: form.description,
        standeeImageUrl: form.standeeImageUrl,
        backdropImageUrl: form.backdropImageUrl,
        cosplayer: form.cosplayer,
        photographer: form.photographer,
        year: form.year,
        event: form.event,
        published: form.published,
        // New entries land at the end of the room's walk order; an edit leaves
        // whatever order the admin has already arranged.
        ...(editing ? {} : { displayOrder: cosplays.length }),
      };

      const res = await fetch(editing ? `/api/cosplays/${editing.id}` : "/api/cosplays", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setCosplays((prev) =>
        editing ? prev.map((c) => (c.id === editing.id ? data : c)) : [...prev, data]
      );
      toast.success(editing ? "Cosplay updated" : "Cosplay added");
      setShowModal(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  /** Publish/unpublish. Optimistic, because this is the toggle an admin uses
   *  most and the museum only reflects it on its next load anyway. */
  async function togglePublished(cosplay: Cosplay) {
    const next = !cosplay.published;
    setCosplays((prev) => prev.map((c) => (c.id === cosplay.id ? { ...c, published: next } : c)));
    try {
      const res = await fetch(`/api/cosplays/${cosplay.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        next
          ? "Published — a standee appears in the Cosplay Room"
          : "Unpublished — its standee leaves the Cosplay Room"
      );
    } catch {
      setCosplays((prev) =>
        prev.map((c) => (c.id === cosplay.id ? { ...c, published: cosplay.published } : c))
      );
      toast.error("Failed to update");
    }
  }

  /** Swaps this cosplay's displayOrder with its neighbour's, which is what
   *  moves its standee along the room's walls. Both rows are PATCHed; the local
   *  swap is applied first so the grid doesn't lag behind the click. */
  async function move(cosplay: Cosplay, direction: "up" | "down") {
    const ordered = [...cosplays].sort((a, b) => a.displayOrder - b.displayOrder);
    const index = ordered.findIndex((c) => c.id === cosplay.id);
    const swapWith = direction === "up" ? ordered[index - 1] : ordered[index + 1];
    if (!swapWith) return;

    const previous = cosplays;
    setCosplays((prev) =>
      prev.map((c) => {
        if (c.id === cosplay.id) return { ...c, displayOrder: swapWith.displayOrder };
        if (c.id === swapWith.id) return { ...c, displayOrder: cosplay.displayOrder };
        return c;
      })
    );

    try {
      const results = await Promise.all([
        fetch(`/api/cosplays/${cosplay.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: swapWith.displayOrder }),
        }),
        fetch(`/api/cosplays/${swapWith.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayOrder: cosplay.displayOrder }),
        }),
      ]);
      if (results.some((r) => !r.ok)) throw new Error();
    } catch {
      setCosplays(previous);
      toast.error("Failed to reorder");
    }
  }

  function openDelete(cosplay: Cosplay) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteTarget(cosplay);
  }

  /**
   * The five row actions, shared by all three renderings below (grid card,
   * table row, mobile row). Written once because the reorder arrows have to
   * disable on the first and last *visible* card, and three copies of that
   * rule is three chances for one view to let you push a standee off the end.
   *
   * `index` is the position in `filtered`, not in `cosplays` — the arrows swap
   * with the neighbour you can actually see.
   */
  function rowActions(cosplay: Cosplay, index: number) {
    return (
      <>
        <button
          onClick={() => move(cosplay, "up")}
          disabled={index === 0}
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
          title="Move earlier in the room"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={() => move(cosplay, "down")}
          disabled={index === filtered.length - 1}
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 transition-colors"
          title="Move later in the room"
        >
          <ChevronDown size={14} />
        </button>
        <button
          onClick={() => togglePublished(cosplay)}
          className={
            cosplay.published
              ? "p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              : "p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          }
          title={cosplay.published ? "Unpublish" : "Publish"}
        >
          {cosplay.published ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => openEdit(cosplay)}
          className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => openDelete(cosplay)}
          className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </>
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cosplays/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCosplays((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Moved to Trash");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New Cosplay
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          <strong className="text-ink dark:text-cream">{publishedCount}</strong> standing in the
          Cosplay Room · {cosplays.length} total
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-300"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search character, series, event, credits…"
            className="admin-input w-full pl-9 pr-3 py-2 rounded-xl text-sm"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5">
          {(["ALL", "PUBLISHED", "DRAFT"] as StatusFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => setStatusFilter(option)}
              className={
                statusFilter === option
                  ? "px-3 py-1.5 rounded-lg bg-white dark:bg-white/10 text-ink dark:text-cream font-jakarta text-xs font-medium shadow-sm"
                  : "px-3 py-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-xs font-medium transition-colors"
              }
            >
              {option === "ALL" ? "All" : option === "PUBLISHED" ? "Published" : "Drafts"}
            </button>
          ))}
        </div>

        {/* View Mode Toggle (Grid cards vs. List rows) — same control, same
            icons and same place in the bar as the Stories/Products modules'. */}
        <div className="flex items-center justify-center sm:justify-start gap-0.5 rounded-xl admin-input border p-1 w-full sm:w-auto sm:shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            title="Grid view"
            aria-label="Grid view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "grid"
                ? "bg-sepia text-white"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            title="List view"
            aria-label="List view"
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "list"
                ? "bg-sepia text-white"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── The list ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="admin-card border rounded-2xl p-12 text-center">
          <div className="inline-flex p-3 rounded-full bg-sepia/10 text-sepia mb-3">
            <Shirt size={24} />
          </div>
          <p className="font-jakarta text-sm font-medium text-ink dark:text-cream mb-1">
            {cosplays.length === 0 ? "No cosplays yet" : "Nothing matches that"}
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">
            {cosplays.length === 0
              ? "Add one and it gets its own standee in the Digital Museum's Cosplay Room."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cosplay, index) => (
            <div
              key={cosplay.id}
              className="admin-card border rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[3/4] bg-black/5 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewImage({
                      src: cosplay.standeeImageUrl,
                      alt: `Standee photo — ${cosplay.character || cosplay.title}`,
                    })
                  }
                  title="View standee photo full size"
                  className="absolute inset-0 group"
                >
                  <Image
                    src={cosplay.standeeImageUrl}
                    alt={cosplay.character || cosplay.title}
                    fill
                    className="object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 text-transparent group-hover:text-white transition-all">
                    <Maximize2 size={20} />
                  </span>
                </button>
                {/* The backdrop photo as a corner thumbnail — the one place an
                    admin can see at a glance whether an entry has its second
                    photo, which is what decides if anything hangs behind its
                    standee. */}
                {cosplay.backdropImageUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        src: cosplay.backdropImageUrl!,
                        alt: `Backdrop photo — ${cosplay.character || cosplay.title}`,
                      })
                    }
                    title="View backdrop photo full size"
                    className="absolute bottom-2 right-2 w-12 h-12 rounded-lg overflow-hidden border-2 border-white/70 shadow-md hover:border-sepia transition-colors"
                  >
                    <Image src={cosplay.backdropImageUrl} alt="" fill className="object-cover" />
                  </button>
                ) : (
                  <div
                    className="absolute bottom-2 right-2 w-12 h-12 rounded-lg border-2 border-dashed border-white/50 bg-black/30 flex items-center justify-center text-white/70"
                    title="No backdrop photo — nothing hangs behind this standee"
                  >
                    <ImageIcon size={14} />
                  </div>
                )}
                {!cosplay.published && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-black/70 text-white/90">
                    Draft
                  </span>
                )}
              </div>

              <div className="p-4 flex-1 flex flex-col">
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                  {cosplay.character || cosplay.title}
                </p>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                  {[cosplay.series, cosplay.event, cosplay.year].filter(Boolean).join(" · ") ||
                    cosplay.title}
                </p>
                {(cosplay.cosplayer || cosplay.photographer) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    {cosplay.cosplayer && (
                      <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                        <User size={11} /> {cosplay.cosplayer}
                      </span>
                    )}
                    {cosplay.photographer && (
                      <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                        <Camera size={11} /> {cosplay.photographer}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  {rowActions(cosplay, index)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view — a table on desktop, stacked rows on phones, the same
           two-layout arrangement the Stories module's list uses. A photo
           thumbnail still leads every row: this module is photographs, and a
           row that opened with a title would be unrecognisable. */
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold">Photos</th>
                  <th className="py-4 px-6 font-semibold">Character &amp; Series</th>
                  <th className="py-4 px-6 font-semibold">Event</th>
                  <th className="py-4 px-6 font-semibold">Credits</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {filtered.map((cosplay, index) => (
                  <tr
                    key={cosplay.id}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Both photos, side by side — the grid's corner-thumbnail
                        trick doesn't survive at row height, and whether an
                        entry has its second photo is exactly what decides if
                        anything hangs behind its standee. */}
                    <td className="py-4 px-6 w-32">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: cosplay.standeeImageUrl,
                              alt: `Standee photo — ${cosplay.character || cosplay.title}`,
                            })
                          }
                          title="View standee photo full size"
                          className="relative w-11 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 hover:border-sepia transition-colors"
                        >
                          <Image
                            src={cosplay.standeeImageUrl}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </button>
                        {cosplay.backdropImageUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                src: cosplay.backdropImageUrl!,
                                alt: `Backdrop photo — ${cosplay.character || cosplay.title}`,
                              })
                            }
                            title="View backdrop photo full size"
                            className="relative w-11 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 hover:border-sepia transition-colors"
                          >
                            <Image
                              src={cosplay.backdropImageUrl}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          </button>
                        ) : (
                          <div
                            className="w-11 h-14 rounded-lg border border-dashed border-black/15 dark:border-white/15 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0"
                            title="No backdrop photo — nothing hangs behind this standee"
                          >
                            <ImageIcon size={14} />
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-6 max-w-xs">
                      <div className="font-semibold text-ink dark:text-cream truncate">
                        {cosplay.character || cosplay.title}
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 truncate mt-0.5">
                        {cosplay.series || cosplay.title}
                      </p>
                    </td>

                    <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300 whitespace-nowrap">
                      {[cosplay.event, cosplay.year].filter(Boolean).join(" · ") || "—"}
                    </td>

                    <td className="py-4 px-6">
                      {cosplay.cosplayer || cosplay.photographer ? (
                        <div className="flex flex-col gap-1">
                          {cosplay.cosplayer && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-300">
                              <User size={11} className="shrink-0" /> {cosplay.cosplayer}
                            </span>
                          )}
                          {cosplay.photographer && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-300">
                              <Camera size={11} className="shrink-0" /> {cosplay.photographer}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-400 dark:text-ink-300">—</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <span
                        className={
                          cosplay.published
                            ? "px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10"
                        }
                      >
                        {cosplay.published ? "Standing" : "Draft"}
                      </span>
                    </td>

                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-1">
                        {rowActions(cosplay, index)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile rows */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {filtered.map((cosplay, index) => (
              <div key={cosplay.id} className="p-4">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImage({
                        src: cosplay.standeeImageUrl,
                        alt: `Standee photo — ${cosplay.character || cosplay.title}`,
                      })
                    }
                    className="relative w-14 h-[4.5rem] rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0"
                  >
                    <Image src={cosplay.standeeImageUrl} alt="" fill className="object-cover" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-jakarta font-semibold text-sm text-ink dark:text-cream truncate">
                      {cosplay.character || cosplay.title}
                    </div>
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate mt-0.5">
                      {[cosplay.series, cosplay.event, cosplay.year].filter(Boolean).join(" · ") ||
                        cosplay.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {cosplay.cosplayer && (
                        <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                          <User size={11} /> {cosplay.cosplayer}
                        </span>
                      )}
                      {cosplay.photographer && (
                        <span className="inline-flex items-center gap-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                          <Camera size={11} /> {cosplay.photographer}
                        </span>
                      )}
                      {!cosplay.published && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                          Draft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                  {rowActions(cosplay, index)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / edit modal ────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit Cosplay" : "New Cosplay"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ── The two photos ─────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    {
                      slot: "standee" as PhotoSlot,
                      label: "Standee Photo",
                      required: true,
                      url: form.standeeImageUrl,
                      hint: STANDEE_PHOTO_HINT,
                      inputRef: standeeInputRef,
                      aspect: "aspect-[3/4]",
                    },
                    {
                      slot: "backdrop" as PhotoSlot,
                      label: "Backdrop Photo",
                      required: false,
                      url: form.backdropImageUrl,
                      hint: BACKDROP_PHOTO_HINT,
                      inputRef: backdropInputRef,
                      aspect: "aspect-[4/3]",
                    },
                  ] as const
                ).map((field) => (
                  <div key={field.slot}>
                    <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </label>
                    <button
                      type="button"
                      // An empty slot's job is still to start an upload. A
                      // filled one's is to show what was uploaded: the box
                      // crops to a fixed aspect, so the only way to check the
                      // real framing without leaving the form is full size.
                      // Replace/Remove below keep the editing actions one
                      // click away either way.
                      onClick={() =>
                        field.url
                          ? setPreviewImage({
                              src: field.url,
                              alt: `${field.label} — ${form.character || form.title || "Untitled cosplay"}`,
                            })
                          : field.inputRef.current?.click()
                      }
                      title={field.url ? "View full size" : "Upload a photo"}
                      className={`relative w-full ${field.aspect} rounded-xl border border-dashed border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 overflow-hidden hover:border-sepia transition-colors group`}
                    >
                      {field.url ? (
                        <>
                          <Image src={field.url} alt="" fill className="object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 text-transparent group-hover:text-white transition-all">
                            <Maximize2 size={18} />
                          </span>
                        </>
                      ) : (
                        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-400 dark:text-ink-300">
                          <Upload size={18} />
                          <span className="font-body text-[11px]">
                            {uploadingSlot === field.slot ? "Uploading…" : "Upload"}
                          </span>
                        </span>
                      )}
                    </button>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                      {field.hint}
                    </p>
                    {field.url && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              src: field.url,
                              alt: `${field.label} — ${form.character || form.title || "Untitled cosplay"}`,
                            })
                          }
                          className="font-body text-[11px] text-ink-400 dark:text-ink-300 hover:underline"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => field.inputRef.current?.click()}
                          className="font-body text-[11px] text-sepia hover:underline"
                        >
                          Replace
                        </button>
                        {!field.required && (
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, backdropImageUrl: "" }))}
                            className="font-body text-[11px] text-red-500/80 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                    <input
                      ref={field.inputRef}
                      type="file"
                      accept={COSPLAY_IMAGE_ACCEPT}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(file, field.slot);
                        e.target.value = "";
                      }}
                    />
                  </div>
                ))}
              </div>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                {COSPLAY_IMAGE_HINT}
              </p>

              {/* ── Identity ───────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Nezuko at AniCon 2025"
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Character
                  </label>
                  <input
                    type="text"
                    value={form.character}
                    onChange={(e) => setForm((prev) => ({ ...prev, character: e.target.value }))}
                    placeholder="Shown on the standee's plaque"
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Series
                  </label>
                  <input
                    type="text"
                    value={form.series}
                    onChange={(e) => setForm((prev) => ({ ...prev, series: e.target.value }))}
                    placeholder="What they're from"
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                      Year
                    </label>
                    <input
                      type="number"
                      value={form.year}
                      onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
                      placeholder="2025"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                      Event
                    </label>
                    <input
                      type="text"
                      value={form.event}
                      onChange={(e) => setForm((prev) => ({ ...prev, event: e.target.value }))}
                      placeholder="Con or shoot"
                      className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="The story behind the build — shown when a visitor presses [E] at the standee."
                  className="admin-input w-full px-3 py-2 rounded-xl text-sm resize-y"
                />
              </div>

              {/* ── Credits ────────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Cosplayer
                  </label>
                  <input
                    type="text"
                    value={form.cosplayer}
                    onChange={(e) => setForm((prev) => ({ ...prev, cosplayer: e.target.value }))}
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                    Photographer
                  </label>
                  <input
                    type="text"
                    value={form.photographer}
                    onChange={(e) => setForm((prev) => ({ ...prev, photographer: e.target.value }))}
                    className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="min-w-0">
                  <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                    Published
                  </p>
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                    Published cosplays get a standee in the Cosplay Room. Drafts stay here.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.published}
                  onClick={() => {
                    setForm((prev) => ({ ...prev, published: !prev.published }));
                    toggleStaged("Cosplay", !form.published, {
                      on: "will be published",
                      off: "will stay a draft",
                    });
                  }}
                  className={
                    form.published
                      ? "shrink-0 p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "shrink-0 p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
                  }
                >
                  {form.published ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingSlot !== null}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : editing ? "Save Changes" : "Add Cosplay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <div className="inline-flex p-2.5 rounded-full bg-red-500/10 text-red-500 mb-3">
              <AlertTriangle size={20} />
            </div>
            <h2 className="font-jakarta text-lg font-semibold text-ink dark:text-cream mb-1">
              Delete this cosplay?
            </h2>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-5">
              <strong className="text-ink dark:text-cream">
                {deleteTarget.character || deleteTarget.title}
              </strong>{" "}
              moves to Trash, and its standee leaves the Cosplay Room. You can restore it from the
              Trash module.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream font-jakarta text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-jakarta text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size photo lightbox — z-[70], so it layers over both the card
          grid and the create/edit modal (z-50) it can be opened from. */}
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
