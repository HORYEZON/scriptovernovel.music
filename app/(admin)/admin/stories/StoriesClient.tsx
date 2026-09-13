// app/(admin)/admin/stories/StoriesClient.tsx
"use client";

// Stories admin module — books, novels, comics and manga, each a cover plus
// an ordered run of page images.
//
// Structurally a sibling of ../artworks/ArtworksClient.tsx rather than a new
// design: the same filter/search/sort bar, the same RowsPerPageSelect +
// table⇄grid toggle, the same row action set (view / publish / feature /
// edit / delete), the same numbered pagination and the same modal shells.
// Where a control has no Story equivalent (Sold/Available, sections, price)
// it's dropped rather than reinterpreted; where Stories need something extra
// (the page manager, the "Choose from Artworks" cover) it's added in the same
// visual language. Keeping the two modules readable against each other is
// worth more here than any per-page cleverness.
import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/SafeImage";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Eye,
  Star,
  Upload,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  Search,
  ZoomIn,
  LayoutGrid,
  List,
  ToggleLeft,
  ToggleRight,
  BookOpen,
  Library,
  Images,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import {
  STORY_TYPES,
  STORY_TYPE_LABELS,
  STORY_IMAGE_ACCEPT,
  STORY_IMAGE_HINT,
  CONTINUE_READING_DEFAULT_LABEL,
  isValidContinueUrl,
  hasContinueLink,
  type StoryType,
} from "@/lib/stories";
import { CoverArtworkPicker } from "./CoverArtworkPicker";
import { StoryPagesManager, type EditableStoryPage } from "./StoryPagesManager";
import type { PickableArtwork } from "../artworks/ArtworkPicker";

type SortOption = "date" | "title" | "type" | "pages" | "featured" | "draft";
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "grid";
type StatusFilter = "ALL" | "PUBLISHED" | "DRAFT";

interface StoryPage {
  id: string;
  imageUrl: string;
  pageNumber: number;
  caption: string | null;
}

interface Story {
  id: string;
  title: string;
  description: string;
  type: StoryType;
  coverImageUrl: string;
  author: string | null;
  genre: string[];
  year: number | null;
  featured: boolean;
  published: boolean;
  slug: string | null;
  displayOrder: number;
  // "Continue Reading" hand-off shown on the last page — see lib/stories.ts.
  continueEnabled: boolean;
  continueUrl: string | null;
  continueLabel: string | null;
  pages: StoryPage[];
  createdAt?: string | Date;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  type: "BOOK" as StoryType,
  coverImageUrl: "",
  author: "",
  genre: "",
  year: "",
  featured: false,
  published: true,
  continueEnabled: false,
  continueUrl: "",
  continueLabel: "",
};

// Published / Featured badges shown in the table row, grid card & details modal
function getStatusBadges(story: Story) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border ${story.published
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10"
          }`}
      >
        {story.published ? "Published" : "Draft"}
      </span>
      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        {STORY_TYPE_LABELS[story.type] ?? story.type}
      </span>
      {story.featured && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sepia/10 text-sepia border border-sepia/20">
          <Star size={10} className="fill-current" />
          Featured
        </span>
      )}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
        <Images size={10} />
        {story.pages.length} {story.pages.length === 1 ? "page" : "pages"}
      </span>
      {hasContinueLink(story) && (
        <span
          title="Ends with a Continue Reading button"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
        >
          <LinkIcon size={10} />
          Teaser
        </span>
      )}
      {/* Toggle on but no usable link — the reader shows nothing, so say so
          here rather than letting it look configured. */}
      {story.continueEnabled && !hasContinueLink(story) && (
        <span
          title="Continue Reading is on but its link is missing or invalid — no button will show"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
        >
          <AlertTriangle size={10} />
          Link missing
        </span>
      )}
    </div>
  );
}

// Publish + Featured are both "visibility/promotion" flags, so they share one
// segmented pill — same control as ArtworkFlagToggles, minus New Release
// (which is an artwork-only concept).
function StoryFlagToggles({
  story,
  onTogglePublished,
  onToggleFeatured,
}: {
  story: Story;
  onTogglePublished: () => void;
  onToggleFeatured: () => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 divide-x divide-black/10 dark:divide-white/10 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={onTogglePublished}
        title={story.published ? "Unpublish" : "Publish"}
        className={`p-2 transition-colors ${!story.published
          ? "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
          }`}
      >
        {story.published ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      </button>

      <button
        type="button"
        onClick={onToggleFeatured}
        title={story.featured ? "Remove from Featured" : "Mark as Featured"}
        className={`p-2 transition-colors ${story.featured
          ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
          }`}
      >
        <Star size={16} className={story.featured ? "fill-current" : ""} />
      </button>
    </div>
  );
}

export function StoriesClient({
  initialStories,
  artworks = [],
}: {
  initialStories: Story[];
  /** Uploaded artworks offered as a ready-made book cover. */
  artworks?: PickableArtwork[];
}) {
  const router = useRouter();
  const [stories, setStories] = useState(initialStories);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formPages, setFormPages] = useState<EditableStoryPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  function openDeleteConfirm(id: string) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(id);
  }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // Type Filter State (narrow to a single publication kind, or "ALL")
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Tag Filter — independent toggle, same as Artworks' Featured chip
  const [featuredFilter, setFeaturedFilter] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");

  // Sorting States
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // View Mode State (table rows vs. grid cards)
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Full Image View Lightbox State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // View Details Modal State (Eye icon / clicking a row's thumbnail or title)
  const [viewingItem, setViewingItem] = useState<Story | null>(null);

  // Lock body scroll when any modal or lightbox is active
  const isModalOpen =
    showModal ||
    Boolean(viewingItem) ||
    Boolean(previewImage) ||
    Boolean(deleteConfirm);
  useLockBodyScroll(isModalOpen);

  // Filtered & Sorted Stories Memoized Logic
  const filteredAndSortedStories = useMemo(() => {
    // 1. Filter by status, type & search term
    const filtered = stories.filter((story) => {
      // Status Filter
      if (statusFilter === "PUBLISHED" && !story.published) return false;
      if (statusFilter === "DRAFT" && story.published) return false;

      // Type Filter
      if (typeFilter !== "ALL" && story.type !== typeFilter) return false;

      // Tag Filter
      if (featuredFilter && !story.featured) return false;

      // Search Filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const titleMatch = story.title.toLowerCase().includes(term);
      const descMatch = story.description?.toLowerCase().includes(term);
      const authorMatch = story.author?.toLowerCase().includes(term);
      const genreMatch = story.genre?.some((g) => g.toLowerCase().includes(term));
      const typeMatch = (STORY_TYPE_LABELS[story.type] ?? story.type)
        .toLowerCase()
        .includes(term);

      return titleMatch || descMatch || authorMatch || genreMatch || typeMatch;
    });

    // 2. Sort results
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "type": {
          comparison = (STORY_TYPE_LABELS[a.type] ?? a.type).localeCompare(
            STORY_TYPE_LABELS[b.type] ?? b.type
          );
          // Tie-break by title so stories of the same kind stay grouped & readable
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        }
        case "pages":
          comparison = a.pages.length - b.pages.length;
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        case "featured":
          comparison = Number(b.featured) - Number(a.featured);
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        case "draft":
          comparison = Number(a.published) - Number(b.published);
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        case "date":
        default: {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        }
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [stories, statusFilter, typeFilter, featuredFilter, searchTerm, sortBy, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedStories.length / pageSize);
  const paginatedStories = filteredAndSortedStories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormPages([]);
    setShowModal(true);
  }

  function openEdit(story: Story) {
    setEditing(story);
    setForm({
      title: story.title,
      description: story.description,
      type: story.type,
      coverImageUrl: story.coverImageUrl,
      author: story.author || "",
      genre: story.genre.join(", "),
      year: story.year?.toString() || "",
      featured: story.featured,
      published: story.published,
      continueEnabled: story.continueEnabled,
      continueUrl: story.continueUrl || "",
      continueLabel: story.continueLabel || "",
    });
    setFormPages(story.pages);
    setShowModal(true);
  }

  const handleCoverUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      setForm((prev) => ({ ...prev, coverImageUrl: url }));
      toast.success("Cover uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCoverUpload(file);
  }

  // The page manager persists its own changes once a story exists, so mirror
  // the result into the list too — otherwise the row's page count would stay
  // stale until the next refresh.
  function handlePagesChange(pages: EditableStoryPage[]) {
    setFormPages(pages);
    if (editing) {
      const nextPages: StoryPage[] = pages.map((page) => ({
        id: page.id,
        imageUrl: page.imageUrl,
        caption: page.caption,
        pageNumber: page.pageNumber,
      }));
      setStories((prev) =>
        prev.map((s) => (s.id === editing.id ? { ...s, pages: nextPages } : s))
      );
      setEditing((prev) => (prev ? { ...prev, pages: nextPages } : prev));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.coverImageUrl) {
      toast.error("Book Cover Not Uploaded");
      return;
    }

    // Caught here as well as server-side so the admin gets a specific message
    // instead of the generic save failure — and so a story can't be saved in
    // the "toggle on, button never renders" state without being told.
    if (form.continueEnabled && !isValidContinueUrl(form.continueUrl)) {
      toast.error("Continue Reading needs a valid http(s) link");
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      genre: form.genre
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean),
      year: form.year ? parseInt(form.year) : null,
      // Only meaningful on create — an existing story's pages are already
      // saved by the page manager as they're added.
      ...(editing
        ? {}
        : {
            pages: formPages.map((page) => ({
              imageUrl: page.imageUrl,
              caption: page.caption,
            })),
          }),
    };

    try {
      const url = editing ? `/api/stories/${editing.id}` : "/api/stories";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save story");
      const data = await res.json();

      if (editing) {
        setStories(stories.map((s) => (s.id === editing.id ? data : s)));
        toast.success("Story updated");
      } else {
        setStories([data, ...stories]);
        setCurrentPage(1);
        toast.success("Story created");
      }
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const next = stories.filter((s) => s.id !== id);
      setStories(next);
      const newTotal = Math.ceil(next.length / pageSize);
      if (currentPage > newTotal && newTotal > 0) setCurrentPage(newTotal);
      setDeleteConfirm(null);
      toast.success("Story deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function togglePublished(story: Story) {
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !story.published }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setStories(stories.map((s) => (s.id === story.id ? updated : s)));
      toast.success(updated.published ? "Published" : "Unpublished");
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function toggleFeatured(story: Story) {
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !story.featured }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setStories(stories.map((s) => (s.id === story.id ? updated : s)));
      toast.success(
        updated.featured ? "Marked as Featured" : "Removed from Featured"
      );
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  function storyMeta(story: Story) {
    return (
      [story.author, story.year, `${story.pages.length} pages`]
        .filter(Boolean)
        .join(" • ") || "—"
    );
  }

  return (
    <>
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New Story
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Total Stories:{" "}
          <strong className="text-ink dark:text-cream">{stories.length}</strong>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(["ALL", "PUBLISHED", "DRAFT"] as const).map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${statusFilter === status
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                }`}
            >
              {status}
            </button>
          ))}

          {/* Tag Filter — independent toggle, not part of the status group above */}
          <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
          <button
            onClick={() => {
              setFeaturedFilter((v) => !v);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${featuredFilter
              ? "bg-sepia text-white border-sepia font-medium"
              : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
          >
            <Star size={10} className={featuredFilter ? "fill-current" : ""} />
            Featured
          </button>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Search Bar */}
          <div className="relative sm:w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search stories..."
              className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Secondary controls — a fixed 2-up grid on mobile so every chip
              gets a predictable, compact spot (no overflow, nothing hidden);
              reverts to a free-flowing wrap once there's room at sm+ */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {/* Type Filter */}
            <div className="flex items-center gap-1 rounded-xl admin-input border px-2 py-1.5 w-full sm:w-auto sm:shrink-0">
              <Library size={12} className="text-ink-400 shrink-0" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 min-w-0 sm:flex-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer sm:max-w-[9.5rem]"
                title="Filter by type"
              >
                <option value="ALL" className="bg-white dark:bg-ink-900">
                  All Types
                </option>
                {STORY_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-white dark:bg-ink-900">
                    {STORY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Group */}
            <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
              <div className="flex items-center gap-1 rounded-xl admin-input border px-2 py-1.5 flex-1 min-w-0 sm:flex-none">
                <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const next = e.target.value as SortOption;
                    setSortBy(next);
                    // Tagged-first is the useful default for these two — flip
                    // to ascending so switching into them doesn't silently
                    // bury Featured/Draft items under the rest.
                    if (next === "featured" || next === "draft") {
                      setSortOrder("asc");
                    }
                    setCurrentPage(1);
                  }}
                  className="flex-1 min-w-0 sm:flex-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
                >
                  <option value="date" className="bg-white dark:bg-ink-900">
                    Date Created
                  </option>
                  <option value="title" className="bg-white dark:bg-ink-900">
                    Alphabetical (A-Z)
                  </option>
                  <option value="type" className="bg-white dark:bg-ink-900">
                    Type (A-Z)
                  </option>
                  <option value="pages" className="bg-white dark:bg-ink-900">
                    Page Count
                  </option>
                  <option value="featured" className="bg-white dark:bg-ink-900">
                    Featured
                  </option>
                  <option value="draft" className="bg-white dark:bg-ink-900">
                    Draft
                  </option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-2 rounded-xl admin-input border text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              </button>
            </div>

            {/* Rows per page */}
            <RowsPerPageSelect
              value={pageSize}
              onChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />

            {/* View Mode Toggle (Table rows vs. Grid cards) */}
            <div className="flex items-center justify-center sm:justify-start gap-0.5 rounded-xl admin-input border p-1 w-full sm:w-auto sm:shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table view"
                aria-label="Table view"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "table"
                  ? "bg-sepia text-white"
                  : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  }`}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                aria-label="Grid view"
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid"
                  ? "bg-sepia text-white"
                  : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stories List */}
      {paginatedStories.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-jakarta font-medium text-ink dark:text-cream mb-1">
              {stories.length === 0 ? "No stories yet" : "No matching stories"}
            </h3>
            <p className="text-sm font-body text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {stories.length === 0
                ? "Upload your first book, novel, comic or manga to start the shelf."
                : "Try adjusting your search query, type or status filter criteria."}
            </p>
            {stories.length === 0 ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-jakarta font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Add First Story
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setFeaturedFilter(false);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs font-jakarta text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedStories.map((story) => (
            <div
              key={story.id}
              className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-sm hover:shadow-lg transition-shadow group"
            >
              {/* Cover */}
              <div
                className="relative aspect-[4/3] overflow-hidden cursor-pointer group/img bg-black/5 dark:bg-black/50"
                onClick={() => setViewingItem(story)}
              >
                <Image
                  src={story.coverImageUrl}
                  alt={story.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover/img:scale-105"
                />

                <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5 rounded-lg">
                    <ZoomIn size={14} /> View Details
                  </span>
                </div>

                {!story.published && (
                  <div className="absolute inset-0 bg-ink/60 flex items-center justify-center pointer-events-none">
                    <span className="font-body text-xs tracking-widest uppercase text-cream bg-ink/80 px-3 py-1 rounded-md">
                      Draft
                    </span>
                  </div>
                )}
                {story.featured && (
                  <div className="absolute top-2 left-2 bg-sepia px-2 py-0.5 rounded-md pointer-events-none flex items-center gap-1">
                    <Star size={10} className="text-white fill-current" />
                    <span className="font-body text-[10px] uppercase tracking-widest text-white">
                      Featured
                    </span>
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-blue-500 px-2 py-0.5 rounded-md pointer-events-none">
                  <span className="font-body text-[10px] uppercase tracking-widest text-white">
                    {STORY_TYPE_LABELS[story.type] ?? story.type}
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <h3
                  onClick={() => setViewingItem(story)}
                  className="font-jakarta text-base font-semibold tracking-tight truncate text-ink dark:text-cream cursor-pointer hover:underline"
                >
                  {story.title}
                </h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 line-clamp-1">
                  {storyMeta(story)}
                </p>

                <div className="mt-3">{getStatusBadges(story)}</div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setViewingItem(story)}
                    title="View Details"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Eye size={16} />
                  </button>

                  <StoryFlagToggles
                    story={story}
                    onTogglePublished={() => togglePublished(story)}
                    onToggleFeatured={() => toggleFeatured(story)}
                  />

                  <button
                    onClick={() => openEdit(story)}
                    title="Edit"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(story.id)}
                    title="Delete"
                    className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold">Cover</th>
                  <th className="py-4 px-6 font-semibold">Title & Details</th>
                  <th className="py-4 px-6 font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "type") {
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("type");
                          setSortOrder("asc");
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-ink dark:hover:text-cream transition-colors"
                      title="Sort by type"
                    >
                      Type
                      {sortBy === "type" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="py-4 px-6 font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "pages") {
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("pages");
                          setSortOrder("desc");
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-ink dark:hover:text-cream transition-colors"
                      title="Sort by page count"
                    >
                      Pages
                      {sortBy === "pages" ? (
                        sortOrder === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {paginatedStories.map((story) => (
                  <tr
                    key={story.id}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Cover */}
                    <td className="py-4 px-6 w-24">
                      <div
                        onClick={() => setViewingItem(story)}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                      >
                        <Image
                          src={story.coverImageUrl}
                          alt={story.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </td>

                    {/* Title & Details */}
                    <td className="py-4 px-6 max-w-xs">
                      <div
                        onClick={() => setViewingItem(story)}
                        className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                      >
                        {story.title}
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-1 mt-0.5">
                        {storyMeta(story)}
                      </p>
                      {story.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {story.genre.slice(0, 3).map((genre) => (
                            <span
                              key={genre}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
                            >
                              {genre}
                            </span>
                          ))}
                          {story.genre.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-ink-400 dark:text-ink-300">
                              +{story.genre.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300 max-w-[150px]">
                      <button
                        type="button"
                        onClick={() => {
                          setTypeFilter(story.type);
                          setCurrentPage(1);
                        }}
                        className="inline-block max-w-full truncate px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 text-xs text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono hover:border-sepia hover:text-sepia transition-colors"
                        title={`Filter by ${STORY_TYPE_LABELS[story.type] ?? story.type}`}
                      >
                        {STORY_TYPE_LABELS[story.type] ?? story.type}
                      </button>
                    </td>

                    {/* Pages */}
                    <td className="py-4 px-6">
                      <span className="font-jakarta text-sm font-bold tabular-nums text-ink dark:text-cream">
                        {story.pages.length}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">{getStatusBadges(story)}</td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingItem(story)}
                          title="View Details"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Eye size={16} />
                        </button>

                        <StoryFlagToggles
                          story={story}
                          onTogglePublished={() => togglePublished(story)}
                          onToggleFeatured={() => toggleFeatured(story)}
                        />

                        <button
                          onClick={() => openEdit(story)}
                          title="Edit"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => openDeleteConfirm(story.id)}
                          title="Delete"
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

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {paginatedStories.map((story) => (
              <div key={story.id} className="p-4">
                <div className="flex gap-3">
                  {/* Cover */}
                  <div
                    onClick={() => setViewingItem(story)}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer"
                  >
                    <Image
                      src={story.coverImageUrl}
                      alt={story.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Title & Details */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setViewingItem(story)}
                  >
                    <div className="font-semibold text-sm text-ink dark:text-cream truncate">
                      {story.title}
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-1 mt-0.5">
                      {storyMeta(story)}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                        {STORY_TYPE_LABELS[story.type] ?? story.type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="mt-3">{getStatusBadges(story)}</div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setViewingItem(story)}
                    title="View Details"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Eye size={16} />
                  </button>

                  <StoryFlagToggles
                    story={story}
                    onTogglePublished={() => togglePublished(story)}
                    onToggleFeatured={() => toggleFeatured(story)}
                  />

                  <button
                    onClick={() => openEdit(story)}
                    title="Edit"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(story.id)}
                    title="Delete"
                    className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          {/* Previous Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          {/* Page Numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            const isActive = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${isActive
                  ? "bg-sepia text-white shadow-sm"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
              >
                {page}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* FULL IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
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
              <p className="text-cream font-jakarta text-sm text-center">
                {previewImage.title}
              </p>
            )}
          </div>
        </div>
      )}

      {/* VIEW STORY DETAILS MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">
                  Story Details
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
              {/* Cover Preview */}
              <div
                onClick={() =>
                  setPreviewImage({
                    url: viewingItem.coverImageUrl,
                    title: viewingItem.title,
                  })
                }
                className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 cursor-pointer group"
              >
                <Image
                  src={viewingItem.coverImageUrl}
                  alt={viewingItem.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                    <ZoomIn size={14} /> View Full Cover
                  </span>
                </div>
              </div>

              {/* Title & Status */}
              <div>
                <h4 className="text-base font-semibold text-ink dark:text-cream mb-1">
                  {viewingItem.title}
                </h4>
                {getStatusBadges(viewingItem)}
                <p className="text-sm text-ink-400 dark:text-ink-300 whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-3 rounded-xl mt-2 border border-black/5 dark:border-white/5">
                  {viewingItem.description}
                </p>
              </div>

              {/* Pages */}
              {viewingItem.pages.length > 0 && (
                <div className="space-y-2 border-t border-black/10 dark:border-white/10 pt-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                    <Images size={12} /> Pages ({viewingItem.pages.length})
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {viewingItem.pages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() =>
                          setPreviewImage({
                            url: page.imageUrl,
                            title: `${viewingItem.title} — page ${page.pageNumber}`,
                          })
                        }
                        className="relative aspect-[3/4] rounded-lg overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/50 cursor-pointer group"
                      >
                        <Image
                          src={page.imageUrl}
                          alt={`${viewingItem.title} page ${page.pageNumber}`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                          sizes="96px"
                        />
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-[9px] font-mono pointer-events-none">
                          {page.pageNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Details List */}
              <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Type:</span>
                  <span className="font-medium text-ink dark:text-cream">
                    {STORY_TYPE_LABELS[viewingItem.type] ?? viewingItem.type}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Author:</span>
                  <span className="font-medium text-ink dark:text-cream">
                    {viewingItem.author || "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Year:</span>
                  <span className="font-medium text-ink dark:text-cream">
                    {viewingItem.year || "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Pages:</span>
                  <span className="font-mono font-medium text-ink dark:text-cream">
                    {viewingItem.pages.length}
                  </span>
                </div>
                {viewingItem.continueEnabled && (
                  <div className="flex justify-between gap-3 py-1">
                    <span className="text-ink-400 shrink-0">Continue:</span>
                    <span className="font-mono font-medium text-ink dark:text-cream truncate">
                      {viewingItem.continueUrl || "— not set —"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Slug:</span>
                  <span className="font-mono font-medium text-ink dark:text-cream truncate max-w-[60%]">
                    {viewingItem.slug || "—"}
                  </span>
                </div>
              </div>

              {viewingItem.genre.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {viewingItem.genre.map((genre) => (
                    <span
                      key={genre}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header - stays fixed */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit Story" : "New Story"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form - scrollable middle */}
            <form
              id="story-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Title <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Input Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Description <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
              </div>

              {/* Book Cover — upload a fresh file, or reuse an uploaded artwork */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Book Cover <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                {form.coverImageUrl ? (
                  <div className="relative">
                    <div
                      className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/60 cursor-pointer group"
                      onClick={() =>
                        setPreviewImage({
                          url: form.coverImageUrl,
                          title: form.title || "Cover Preview",
                        })
                      }
                    >
                      <Image
                        src={form.coverImageUrl}
                        alt="Cover preview"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                          <ZoomIn size={14} /> View Full Cover
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <Upload size={12} />
                        Replace Cover
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowCoverPicker(true)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <Images size={12} />
                        Choose from Artworks
                      </button>

                      <button
                        type="button"
                        onClick={() => setForm({ ...form, coverImageUrl: "" })}
                        className="text-xs text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <X size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragOver
                        ? "border-sepia bg-sepia/10"
                        : "border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.02] hover:border-black/30 dark:hover:border-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                        }`}
                    >
                      <Upload className="w-8 h-8 text-ink-400 dark:text-ink-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-ink dark:text-cream">
                        {uploading ? "Uploading cover..." : "Click or drag & drop cover here"}
                      </p>
                      <p className="text-xs text-ink-400 dark:text-ink-400 mt-1">
                        {STORY_IMAGE_HINT}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCoverPicker(true)}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                    >
                      <Images size={12} />
                      Or choose from uploaded Artworks
                    </button>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={STORY_IMAGE_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverUpload(file);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </div>

              {/* Pages */}
              <StoryPagesManager
                storyId={editing?.id ?? null}
                pages={formPages}
                onPagesChange={handlePagesChange}
                onPreview={setPreviewImage}
              />

              {/* After the last page — the "Continue Reading" hand-off.
                  Sits directly under the page manager on purpose: it's about
                  what happens when the uploaded pages run out, so it reads as
                  the end of that list rather than an unrelated setting. */}
              <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.continueEnabled}
                    onChange={(e) =>
                      setForm({ ...form, continueEnabled: e.target.checked })
                    }
                    className="mt-0.5 w-5 h-5 shrink-0 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink dark:text-cream">
                      <LinkIcon size={13} />
                      Continue Reading on the last page
                    </span>
                    <span className="block text-xs text-ink-400 dark:text-ink-300 mt-1">
                      For a teaser — upload only the opening pages, then send
                      readers to the full story. The button appears after the
                      last page and nowhere else.
                    </span>
                  </span>
                </label>

                {form.continueEnabled && (
                  <div className="mt-4 space-y-3 pl-8">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                        Link <span className="text-red-500 dark:text-red-400">*</span>
                      </label>
                      <input
                        type="url"
                        inputMode="url"
                        placeholder="https://www.wattpad.com/story/..."
                        value={form.continueUrl}
                        onChange={(e) => setForm({ ...form, continueUrl: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                      />
                      {form.continueUrl.trim().length > 0 &&
                        !isValidContinueUrl(form.continueUrl) && (
                          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                            <AlertTriangle size={12} />
                            Must start with http:// or https://
                          </p>
                        )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                        Button Text
                      </label>
                      <input
                        type="text"
                        placeholder={CONTINUE_READING_DEFAULT_LABEL}
                        value={form.continueLabel}
                        onChange={(e) => setForm({ ...form, continueLabel: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                      />
                    </div>
                    {formPages.length === 0 && (
                      <p className="flex items-start gap-1.5 text-xs text-ink-400 dark:text-ink-300">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        No pages uploaded — readers will see only this button
                        when they open the story.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Type & Author */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Type
                  </label>
                  <div className="relative">
                    <select
                      value={form.type}
                      onChange={(e) =>
                        setForm({ ...form, type: e.target.value as StoryType })
                      }
                      className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                    >
                      {STORY_TYPES.map((type) => (
                        <option key={type} value={type} className="bg-white dark:bg-ink-900">
                          {STORY_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Author
                  </label>
                  <input
                    type="text"
                    placeholder="ScriptOverNovel"
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Year & Genre */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    placeholder="2026"
                    min="1900"
                    max="2099"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Genre (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="fantasy, slice of life"
                    value={form.genre}
                    onChange={(e) => setForm({ ...form, genre: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center flex-wrap gap-4 sm:gap-6 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                    className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-ink dark:text-cream">
                    Featured Story
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                    className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-ink dark:text-cream">
                    Published
                  </span>
                </label>
              </div>
            </form>

            {/* Footer - stays fixed */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="story-form"
                disabled={loading || uploading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : editing ? "Save Changes" : "Create Story"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COVER PICKER — pull a cover straight from the uploaded artworks */}
      {showCoverPicker && (
        <CoverArtworkPicker
          artworks={artworks}
          selectedUrl={form.coverImageUrl}
          onSelect={(artwork) => {
            setForm((prev) => ({ ...prev, coverImageUrl: artwork.imageUrl }));
            setShowCoverPicker(false);
            toast.success("Cover set from artwork");
          }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">
              Delete Story
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              Are you sure you want to delete this story? It will be moved to
              Trash, where you can restore it or delete it for good.
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
