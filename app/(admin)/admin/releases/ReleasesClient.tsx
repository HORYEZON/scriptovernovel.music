"use client";

// app/(admin)/admin/releases/ReleasesClient.tsx
//
// The Releases editor: a list of covers with publish / featured switches
// and up-down ordering, and one modal that creates or edits a release —
// cover, title, type, date, description, the five platform links (each
// with a live "this is a Spotify album" check from lib/embeds.ts and a
// pick for which player the site shows), and the tracklist with per-track
// duration, link and lyrics. Built from the Site Design form primitives
// (fields.tsx) so it looks like the rest of the admin, with the Events
// module's fetch/optimistic-update shape.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Disc3,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";
import { SafeImg } from "@/components/ui/SafeImage";
import { imageVariantUrl } from "@/lib/images/variants";
import { FieldLabel, ImageField, SelectField, TextField, ToggleRow } from "@/app/(admin)/admin/site-design/fields";
import { EMBED_PROVIDERS, EMBED_PROVIDER_LABELS, parseEmbed, type EmbedProvider } from "@/lib/embeds";
import {
  MAX_RELEASE_DESCRIPTION,
  MAX_RELEASE_TITLE,
  MAX_TRACK_LYRICS,
  MAX_TRACK_TITLE,
  RELEASE_LINK_FIELDS,
  RELEASE_TYPES,
  RELEASE_TYPE_LABELS,
  formatDuration,
  formatReleaseDate,
  parseDuration,
  primaryEmbed,
  type ReleaseType,
} from "@/lib/releases";

export interface ReleaseTrackRow {
  id: string;
  trackNumber: number;
  title: string;
  durationSec: number | null;
  url: string | null;
  lyrics: string | null;
}

export interface ReleaseRow {
  id: string;
  title: string;
  slug: string | null;
  type: ReleaseType;
  coverImageUrl: string;
  releaseDate: string | null;
  description: string | null;
  featured: boolean;
  published: boolean;
  sortOrder: number;
  spotifyUrl: string | null;
  bandcampUrl: string | null;
  youtubeUrl: string | null;
  soundcloudUrl: string | null;
  appleMusicUrl: string | null;
  primaryPlayer: string | null;
  tracks: ReleaseTrackRow[];
  createdAt: string;
  updatedAt: string;
}

interface TrackDraft {
  key: number;
  title: string;
  duration: string; // "3:42" as typed
  url: string;
  lyrics: string;
  lyricsOpen: boolean;
}

interface FormState {
  title: string;
  type: ReleaseType;
  coverImageUrl: string | null;
  releaseDate: string; // YYYY-MM-DD
  description: string;
  featured: boolean;
  published: boolean;
  spotifyUrl: string;
  bandcampUrl: string;
  youtubeUrl: string;
  soundcloudUrl: string;
  appleMusicUrl: string;
  primaryPlayer: EmbedProvider | "";
  tracks: TrackDraft[];
}

let trackKey = 1;
const newTrack = (): TrackDraft => ({ key: trackKey++, title: "", duration: "", url: "", lyrics: "", lyricsOpen: false });

const EMPTY_FORM: FormState = {
  title: "",
  type: "SINGLE",
  coverImageUrl: null,
  releaseDate: "",
  description: "",
  featured: false,
  published: true,
  spotifyUrl: "",
  bandcampUrl: "",
  youtubeUrl: "",
  soundcloudUrl: "",
  appleMusicUrl: "",
  primaryPlayer: "",
  tracks: [newTrack()],
};

const TYPE_OPTIONS = RELEASE_TYPES.map((t) => ({ value: t, label: RELEASE_TYPE_LABELS[t] }));

const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

function formFromRelease(r: ReleaseRow): FormState {
  return {
    title: r.title,
    type: r.type,
    coverImageUrl: r.coverImageUrl,
    releaseDate: r.releaseDate ? r.releaseDate.slice(0, 10) : "",
    description: r.description ?? "",
    featured: r.featured,
    published: r.published,
    spotifyUrl: r.spotifyUrl ?? "",
    bandcampUrl: r.bandcampUrl ?? "",
    youtubeUrl: r.youtubeUrl ?? "",
    soundcloudUrl: r.soundcloudUrl ?? "",
    appleMusicUrl: r.appleMusicUrl ?? "",
    primaryPlayer: (r.primaryPlayer as EmbedProvider | null) ?? "",
    tracks: r.tracks.length
      ? r.tracks.map((t) => ({
          key: trackKey++,
          title: t.title,
          duration: formatDuration(t.durationSec),
          url: t.url ?? "",
          lyrics: t.lyrics ?? "",
          lyricsOpen: false,
        }))
      : [newTrack()],
  };
}

function payloadFromForm(f: FormState) {
  return {
    title: f.title,
    type: f.type,
    coverImageUrl: f.coverImageUrl,
    releaseDate: f.releaseDate || null,
    description: f.description,
    featured: f.featured,
    published: f.published,
    spotifyUrl: f.spotifyUrl.trim() || null,
    bandcampUrl: f.bandcampUrl.trim() || null,
    youtubeUrl: f.youtubeUrl.trim() || null,
    soundcloudUrl: f.soundcloudUrl.trim() || null,
    appleMusicUrl: f.appleMusicUrl.trim() || null,
    primaryPlayer: f.primaryPlayer || null,
    tracks: f.tracks.map((t) => ({
      title: t.title,
      durationSec: parseDuration(t.duration),
      url: t.url.trim() || null,
      lyrics: t.lyrics,
    })),
  };
}

/** One platform link field with a live parse readout under it. */
function LinkField({
  provider,
  value,
  onChange,
}: {
  provider: EmbedProvider;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = EMBED_PROVIDER_LABELS[provider];
  const parsed = value.trim() ? parseEmbed(value) : null;
  const invalid = value.trim() !== "" && !parsed;
  const hint = !value.trim()
    ? provider === "bandcamp"
      ? "Paste the release page URL, or the EmbeddedPlayer URL from Bandcamp's Share → Embed for a player."
      : undefined
    : invalid
      ? `Not a ${label} link.`
      : parsed?.embedUrl
        ? `${label} ${parsed.kind} — embeddable player.`
        : `${label} link — opens on the platform (no player).`;
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`https://…`}
        className={cn(inputBase, invalid ? "border-red-500/60" : "")}
      />
      {hint && (
        <p className={cn("mt-1 font-body text-xs", invalid ? "text-red-500" : "text-ink-400 dark:text-ink-300")}>{hint}</p>
      )}
    </div>
  );
}

export function ReleasesClient({ initialReleases }: { initialReleases: ReleaseRow[] }) {
  const router = useRouter();
  const [releases, setReleases] = useState<ReleaseRow[]>(initialReleases);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReleaseRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  useLockBodyScroll(modalOpen);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return releases;
    return releases.filter(
      (r) => r.title.toLowerCase().includes(q) || r.tracks.some((t) => t.title.toLowerCase().includes(q))
    );
  }, [releases, query]);
  const canReorder = query.trim() === "";

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function setTrack(key: number, patch: Partial<TrackDraft>) {
    setForm((f) => ({ ...f, tracks: f.tracks.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
  }
  function moveTrack(index: number, dir: -1 | 1) {
    setForm((f) => {
      const next = [...f.tracks];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...f, tracks: next };
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, tracks: [newTrack()] });
    setModalOpen(true);
  }
  function openEdit(r: ReleaseRow) {
    setEditing(r);
    setForm(formFromRelease(r));
    setModalOpen(true);
  }
  function closeModal() {
    if (saving) return;
    setModalOpen(false);
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Give the release a title.");
    if (!form.coverImageUrl) return toast.error("Upload a cover image.");
    for (const t of form.tracks) {
      if (t.duration.trim() && parseDuration(t.duration) === null) return toast.error(`"${t.title || "Track"}": duration should look like 3:42.`);
      if (t.url.trim() && !parseEmbed(t.url)) return toast.error(`"${t.title || "Track"}": that link isn't a streaming URL.`);
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/releases/${editing.id}` : "/api/releases", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save release");
      setReleases((prev) => (editing ? prev.map((r) => (r.id === data.id ? data : r)) : [...prev, data]));
      toast.success(editing ? "Release updated" : "Release added");
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save release"));
    } finally {
      setSaving(false);
    }
  }

  async function patchQuick(r: ReleaseRow, patch: Partial<Pick<ReleaseRow, "published" | "featured">>, label: string) {
    const prev = releases;
    setReleases((list) => list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/releases/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(label);
      router.refresh();
    } catch (err) {
      setReleases(prev);
      toast.error(getErrorMessage(err, "Failed to update"));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= releases.length) return;
    const next = [...releases];
    [next[index], next[j]] = [next[j], next[index]];
    const order = next.map((r, i) => ({ id: r.id, sortOrder: i }));
    setReleases(next.map((r, i) => ({ ...r, sortOrder: i })));
    try {
      const res = await fetch("/api/releases/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      router.refresh();
    } catch (err) {
      setReleases(releases);
      toast.error(getErrorMessage(err, "Failed to reorder"));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/releases/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setReleases((list) => list.filter((r) => r.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" moved to Trash`);
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete"));
    } finally {
      setDeleting(false);
    }
  }

  const playerOptions = useMemo(() => {
    const opts: { value: EmbedProvider | ""; label: string }[] = [{ value: "", label: "Automatic (first with a player)" }];
    for (const p of EMBED_PROVIDERS) {
      const field = RELEASE_LINK_FIELDS[p];
      const parsed = form[field].trim() ? parseEmbed(form[field]) : null;
      if (parsed?.embedUrl) opts.push({ value: p, label: EMBED_PROVIDER_LABELS[p] });
    }
    return opts;
  }, [form]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search releases or tracks…"
            className={cn(inputBase, "pl-9")}
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark"
        >
          <Plus size={16} /> New release
        </button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="admin-card rounded-2xl border p-10 text-center">
          <Disc3 size={28} className="mx-auto mb-3 text-ink-300" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">
            {releases.length === 0 ? "No releases yet. Add the first single." : "Nothing matches that search."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((r, index) => {
            const player = primaryEmbed(r);
            return (
              <li key={r.id} className="admin-card flex gap-4 rounded-2xl border p-4">
                <button type="button" onClick={() => openEdit(r)} className="shrink-0" aria-label={`Edit ${r.title}`}>
                  <SafeImg
                    src={imageVariantUrl(r.coverImageUrl, "thumb")}
                    alt=""
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold text-ink dark:text-cream">{r.title}</p>
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                        {RELEASE_TYPE_LABELS[r.type]}
                        {r.releaseDate ? ` · ${formatReleaseDate(r.releaseDate, "year")}` : ""}
                        {` · ${r.tracks.length} track${r.tracks.length === 1 ? "" : "s"}`}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                        {player ? `Player: ${EMBED_PROVIDER_LABELS[player.provider]}` : "No player — links only"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => patchQuick(r, { featured: !r.featured }, r.featured ? "No longer featured" : `"${r.title}" fronts the homepage`)}
                        title={r.featured ? "Featured — fronts the homepage" : "Feature on the homepage"}
                        className={cn(
                          "rounded-lg p-1.5 transition-colors",
                          r.featured ? "text-amber-500 hover:bg-amber-500/10" : "text-ink-300 hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        <Star size={16} fill={r.featured ? "currentColor" : "none"} />
                      </button>
                      <button type="button" onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(r)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-500/10 hover:text-red-500" title="Move to Trash">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => patchQuick(r, { published: !r.published }, r.published ? "Hidden from the site" : "Published")}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider transition-colors",
                        r.published
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : "border-black/10 text-ink-400 dark:border-white/10 dark:text-ink-300"
                      )}
                    >
                      {r.published ? "Published" : "Hidden"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={!canReorder || index === 0} onClick={() => move(index, -1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move up">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" disabled={!canReorder || index === visible.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-1 text-ink-400 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5" title="Move down">
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit release" : "New release"}
            onClick={(e) => e.stopPropagation()}
            className="admin-modal flex max-h-[95vh] w-full max-w-4xl flex-col rounded-t-2xl border sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
              <h2 className="font-body text-base font-semibold text-ink dark:text-cream">{editing ? "Edit release" : "New release"}</h2>
              <button type="button" onClick={closeModal} className="rounded-lg p-1.5 text-ink-400 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)]">
                <div className="space-y-5">
                  <ImageField label="Cover" value={form.coverImageUrl} onChange={(v) => set("coverImageUrl", v)} aspect="aspect-square" hint="Square works best — it's the homepage backdrop too." />
                  <ToggleRow label="Published" value={form.published} onChange={(v) => set("published", v)} words={{ on: "shown", off: "hidden" }} />
                  <ToggleRow label="Featured" description="Fronts the homepage hero." value={form.featured} onChange={(v) => set("featured", v)} words={{ on: "featured", off: "not featured" }} />
                </div>
                <div className="space-y-5">
                  <TextField label="Title" value={form.title} onChange={(v) => set("title", v)} maxLength={MAX_RELEASE_TITLE} placeholder="Title of the release" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField label="Type" value={form.type} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} />
                    <div>
                      <FieldLabel>Release date</FieldLabel>
                      <AdminDatePicker value={form.releaseDate} onChange={(v) => set("releaseDate", v)} placeholder="Optional" />
                    </div>
                  </div>
                  <div>
                    <FieldLabel hint={`${form.description.length}/${MAX_RELEASE_DESCRIPTION}`}>Description</FieldLabel>
                    <textarea
                      value={form.description}
                      onChange={(e) => set("description", e.target.value.slice(0, MAX_RELEASE_DESCRIPTION))}
                      rows={4}
                      placeholder="A few lines about the release — where it was recorded, what it's about."
                      className={cn(inputBase, "resize-y")}
                    />
                  </div>

                  <div className="border-t border-black/10 pt-5 dark:border-white/10">
                    <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">Where it streams</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {EMBED_PROVIDERS.map((p) => (
                        <LinkField key={p} provider={p} value={form[RELEASE_LINK_FIELDS[p]]} onChange={(v) => set(RELEASE_LINK_FIELDS[p], v)} />
                      ))}
                      <SelectField label="Player shown on the site" value={form.primaryPlayer} onChange={(v) => set("primaryPlayer", v)} options={playerOptions} hint="Which platform's embedded player visitors see. The others become 'Listen on' links." />
                    </div>
                  </div>

                  <div className="border-t border-black/10 pt-5 dark:border-white/10">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">Tracklist</p>
                      <button type="button" onClick={() => set("tracks", [...form.tracks, newTrack()])} className="inline-flex items-center gap-1 font-body text-xs text-sepia hover:underline">
                        <Plus size={14} /> Add track
                      </button>
                    </div>
                    <ol className="space-y-3">
                      {form.tracks.map((t, i) => (
                        <li key={t.key} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                          <div className="flex items-start gap-2">
                            <span className="mt-2.5 w-6 shrink-0 text-center font-mono text-xs text-ink-400">{i + 1}</span>
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_5rem]">
                              <input
                                type="text"
                                value={t.title}
                                onChange={(e) => setTrack(t.key, { title: e.target.value.slice(0, MAX_TRACK_TITLE) })}
                                placeholder="Track title"
                                className={inputBase}
                              />
                              <input
                                type="text"
                                value={t.duration}
                                onChange={(e) => setTrack(t.key, { duration: e.target.value })}
                                placeholder="3:42"
                                aria-label="Duration"
                                className={cn(inputBase, "text-center")}
                              />
                              <input
                                type="url"
                                value={t.url}
                                onChange={(e) => setTrack(t.key, { url: e.target.value })}
                                placeholder="Track link (optional)"
                                className={cn(inputBase, "sm:col-span-2")}
                              />
                              {t.lyricsOpen ? (
                                <textarea
                                  value={t.lyrics}
                                  onChange={(e) => setTrack(t.key, { lyrics: e.target.value.slice(0, MAX_TRACK_LYRICS) })}
                                  rows={6}
                                  placeholder="Lyrics — shown under the track on the Music page, and used by the lyric mini game."
                                  className={cn(inputBase, "resize-y font-body sm:col-span-2")}
                                />
                              ) : (
                                <button type="button" onClick={() => setTrack(t.key, { lyricsOpen: true })} className="justify-self-start font-body text-xs text-ink-400 hover:text-sepia sm:col-span-2">
                                  {t.lyrics ? `Lyrics (${t.lyrics.split("\n").length} lines) — edit` : "+ Add lyrics"}
                                </button>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1">
                              <GripVertical size={14} className="text-ink-300" />
                              <button type="button" disabled={i === 0} onClick={() => moveTrack(i, -1)} className="rounded p-0.5 text-ink-400 disabled:opacity-30" aria-label="Move up"><ArrowUp size={13} /></button>
                              <button type="button" disabled={i === form.tracks.length - 1} onClick={() => moveTrack(i, 1)} className="rounded p-0.5 text-ink-400 disabled:opacity-30" aria-label="Move down"><ArrowDown size={13} /></button>
                              <button type="button" onClick={() => set("tracks", form.tracks.filter((x) => x.key !== t.key))} className="rounded p-0.5 text-ink-400 hover:text-red-500" aria-label="Remove track"><X size={13} /></button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                    {editing?.slug && (
                      <p className="mt-3 inline-flex items-center gap-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                        <ExternalLink size={11} /> /music/{editing.slug}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4 dark:border-white/10">
              <button type="button" onClick={closeModal} disabled={saving} className="rounded-xl px-4 py-2.5 font-body text-sm text-ink-400 hover:text-ink dark:hover:text-cream">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-sepia px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-sepia-dark disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Save changes" : "Add release"}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={deleteTarget !== null}
        title="Move to Trash?"
        description={deleteTarget ? `"${deleteTarget.title}" leaves the Music page and the homepage. You can restore it from Trash.` : undefined}
        confirmLabel="Move to Trash"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
