"use client";

// app/(admin)/admin/stories/StoryPagesManager.tsx
//
// The page images of a story — the part that makes a Story a Story rather
// than an artwork with extra photos. Lives inside the create/edit modal in
// StoriesClient.tsx.
//
// Two modes, one UI:
//   • editing an existing story (storyId set) — every add / reorder / delete
//     hits the API immediately and the response (the whole updated story)
//     becomes the new state, so what's on screen is always what's stored.
//   • staging a brand-new story (storyId null) — the same actions mutate a
//     local list with temporary ids, which is POSTed alongside the story
//     itself on submit (see handleSubmit's `pages` payload).
//
// Reorder is up/down buttons rather than HTML5 drag-and-drop on purpose:
// dragging doesn't work on touch without a bespoke pointer implementation,
// and this modal is expected to be used on a phone (same reasoning as the
// ordered list in ../artworks/ArtworkPicker.tsx, whose controls these match).
import { useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Plus, ArrowUp, ArrowDown, ZoomIn, Trash2, BookOpen } from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { STORY_IMAGE_ACCEPT, STORY_IMAGE_HINT } from "@/lib/stories";

export interface EditableStoryPage {
  /** Real cuid for a saved page; a `tmp-…` placeholder while staging. */
  id: string;
  imageUrl: string;
  caption: string | null;
  pageNumber: number;
}

const ALLOWED_PAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_PAGE_SIZE = 10 * 1024 * 1024; // matches POST /api/upload

function renumber(pages: EditableStoryPage[]): EditableStoryPage[] {
  return pages.map((page, i) => ({ ...page, pageNumber: i + 1 }));
}

export function StoryPagesManager({
  storyId,
  pages,
  onPagesChange,
  onPreview,
}: {
  storyId: string | null;
  pages: EditableStoryPage[];
  onPagesChange: (pages: EditableStoryPage[]) => void;
  onPreview: (image: { url: string; title?: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<EditableStoryPage | null>(null);

  async function uploadOne(file: File): Promise<string | null> {
    if (!ALLOWED_PAGE_TYPES.includes(file.type)) {
      toast.error(`"${file.name}" must be a JPG or PNG`);
      return null;
    }
    if (file.size > MAX_PAGE_SIZE) {
      toast.error(`"${file.name}" is too large (max 10 MB)`);
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || `Failed to upload "${file.name}"`);
      return null;
    }
    const { url } = await res.json();
    return url as string;
  }

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading({ done: 0, total: list.length });
    const uploaded: string[] = [];

    // Sequential rather than Promise.all: page uploads are large and the
    // count is open-ended, and this way the "3/12" counter is truthful.
    for (let i = 0; i < list.length; i++) {
      const url = await uploadOne(list[i]);
      if (url) uploaded.push(url);
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);

    if (uploaded.length === 0) return;

    if (storyId) {
      try {
        const res = await fetch(`/api/stories/${storyId}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pages: uploaded.map((url) => ({ imageUrl: url })) }),
        });
        if (!res.ok) throw new Error();
        const story = await res.json();
        onPagesChange(story.pages);
      } catch {
        toast.error("Failed to save pages");
        return;
      }
    } else {
      onPagesChange(
        renumber([
          ...pages,
          ...uploaded.map((url, i) => ({
            id: `tmp-${Date.now()}-${i}`,
            imageUrl: url,
            caption: null,
            pageNumber: 0,
          })),
        ])
      );
    }

    toast.success(
      uploaded.length === 1 ? "Page added" : `${uploaded.length} pages added`
    );
  }

  async function movePage(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= pages.length) return;

    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    const reordered = renumber(next);

    // Optimistic: the swap is instant, and a failed save re-renders from the
    // server response below (or leaves the old order on error).
    onPagesChange(reordered);

    if (!storyId) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/pages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageIds: reordered.map((page) => page.id) }),
      });
      if (!res.ok) throw new Error();
      const story = await res.json();
      onPagesChange(story.pages);
      toast.success("Pages reordered");
    } catch {
      onPagesChange(pages);
      toast.error("Failed to reorder pages");
    } finally {
      setBusy(false);
    }
  }

  async function deletePage(page: EditableStoryPage) {
    if (!storyId) {
      onPagesChange(renumber(pages.filter((p) => p.id !== page.id)));
      setDeleteConfirm(null);
      toast.success("Page removed");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/pages/${page.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      const story = await res.json();
      onPagesChange(story.pages);
      setDeleteConfirm(null);
      toast.success("Page deleted");
    } catch {
      toast.error("Failed to delete page");
    } finally {
      setBusy(false);
    }
  }

  function setCaption(pageId: string, caption: string) {
    onPagesChange(
      pages.map((page) => (page.id === pageId ? { ...page, caption } : page))
    );
  }

  async function saveCaption(page: EditableStoryPage) {
    if (!storyId) return;
    try {
      await fetch(`/api/stories/${storyId}/pages/${page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: page.caption ?? "" }),
      });
    } catch {
      toast.error("Failed to save caption");
    }
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        Pages {pages.length > 0 && <span className="font-mono normal-case">({pages.length})</span>}
      </label>
      <p className="text-xs text-ink-400 dark:text-ink-300 mb-3">
        The scanned pages of the book, in reading order. {STORY_IMAGE_HINT} each —
        select several at once to upload a whole chapter.
      </p>

      {pages.length === 0 ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02] hover:border-black/30 dark:hover:border-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
        >
          <BookOpen className="w-8 h-8 text-ink-400 dark:text-ink-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-ink dark:text-cream">
            {uploading
              ? `Uploading ${uploading.done}/${uploading.total}…`
              : "Click to upload page images"}
          </p>
          <p className="text-xs text-ink-400 dark:text-ink-400 mt-1">{STORY_IMAGE_HINT}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className="flex items-start gap-3 p-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]"
            >
              {/* Page number + thumbnail */}
              <div
                onClick={() =>
                  onPreview({ url: page.imageUrl, title: `Page ${page.pageNumber}` })
                }
                className="relative w-14 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
              >
                <Image
                  src={page.imageUrl}
                  alt={`Page ${page.pageNumber}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="56px"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn size={14} className="text-cream" />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <span className="inline-block px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-mono text-[10px] text-ink-400 dark:text-ink-300 mb-1.5">
                  Page {page.pageNumber}
                </span>
                <input
                  type="text"
                  value={page.caption ?? ""}
                  onChange={(e) => setCaption(page.id, e.target.value)}
                  onBlur={() => saveCaption(page)}
                  placeholder="Caption (optional)"
                  className="w-full px-3 py-1.5 rounded-lg admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs"
                />
              </div>

              {/* Reorder + delete */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="inline-flex flex-col rounded-lg border border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => movePage(index, "up")}
                    disabled={index === 0 || busy}
                    title="Move up"
                    aria-label={`Move page ${page.pageNumber} up`}
                    className="p-1.5 bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePage(index, "down")}
                    disabled={index === pages.length - 1 || busy}
                    title="Move down"
                    aria-label={`Move page ${page.pageNumber} down`}
                    className="p-1.5 bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSoundEffect("admin.deleteConfirm");
                    setDeleteConfirm(page);
                  }}
                  title="Delete page"
                  aria-label={`Delete page ${page.pageNumber}`}
                  className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(uploading)}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] py-3 text-xs text-ink-400 dark:text-ink-300 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span>Uploading {uploading.done}/{uploading.total}…</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Plus size={14} /> Add pages
              </span>
            )}
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={STORY_IMAGE_ACCEPT}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* DELETE PAGE CONFIRMATION */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">
              Delete Page {deleteConfirm.pageNumber}
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              Remove this page from the story? The remaining pages are renumbered
              automatically. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletePage(deleteConfirm)}
                disabled={busy}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
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
