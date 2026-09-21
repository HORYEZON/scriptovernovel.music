// app/(admin)/admin/artworks/ArtworksClient.tsx
"use client";

// The Museum Pieces admin — the images (and clips) that hang in the Digital
// Museum's rooms: live photos, gig posters, press shots, cover art, fan art.
// Inherited from the art-gallery codebase as "Artworks" (the model, routes
// and the /artwork/[slug] page keep that name), so the shop-shaped bits —
// Sold / Available, "New Release", price sorting — are hidden here rather
// than removed: the columns stay, nothing on the band site reads them.

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
  Palette,
  LayoutGrid,
  List,
  ToggleLeft,
  ToggleRight,
  Layers,
  Share2,
  Film,
  ImagePlus,
  Scissors,
} from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";
import { ArtworkVideoUploader } from "@/components/admin/ArtworkVideoUploader";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_DURATION_SEC } from "@/lib/artwork-video";
import { uploadArtworkVideo } from "@/lib/artwork-video-upload";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";

type ArtworkStatus = "AVAILABLE" | "SOLD";
type SortOption = "title" | "section" | "date" | "featured" | "draft";

/** Suggested values for Kind (the old `medium` column) — free text, these
 *  just keep the plaque wording consistent across the museum. */
const PIECE_KIND_PRESETS = ["Live photo", "Gig poster", "Press shot", "Cover art", "Fan art", "Artwork", "Behind the scenes"];
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "grid";

interface Artwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  // Extra angle/detail shots beyond the cover (imageUrl) — shown in the
  // public detail modal / dedicated artwork page as a thumbnail gallery.
  imageUrls: string[];
  // Optional "making of" timelapse, max 60s (auto-trimmed client-side on
  // upload) — shown as the last slide in the public detail carousel.
  videoUrl: string | null;
  // Up to 2 more clips beyond videoUrl — same trim/upload pipeline.
  videoUrls: string[];
  tags: string[];
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  featured: boolean;
  isNewRelease: boolean;
  published: boolean;
  status: ArtworkStatus;
  sectionId: string | null;
  section: { id: string; name: string; slug: string } | null;
  product: { price: number } | null;
  slug: string | null;
  shareCount: number;
  createdAt?: string | Date;
}

interface SectionOption {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  imageUrl: "",
  imageUrls: [] as string[],
  videoUrl: "",
  videoUrls: [] as string[],
  tags: "",
  medium: "",
  dimensions: "",
  year: "",
  featured: false,
  isNewRelease: false,
  published: true,
  status: "AVAILABLE" as ArtworkStatus,
  sectionId: "",
};

// Status / Published / Featured badges shown in the table row, grid card & details modal
function getStatusBadges(artwork: Artwork) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border ${artwork.published
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10"
          }`}
      >
        {artwork.published ? "Published" : "Draft"}
      </span>
      {artwork.featured && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sepia/10 text-sepia border border-sepia/20">
          <Star size={10} className="fill-current" />
          Featured
        </span>
      )}
      {artwork.videoUrl && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Film size={10} />
          Video
        </span>
      )}
    </div>
  );
}

// Publish & Featured are both "visibility/promotion" flags on a piece, so
// they're grouped into a single segmented control (one bordered pill,
// divided) rather than separate free-floating buttons.
function ArtworkFlagToggles({
  artwork,
  onTogglePublished,
  onToggleFeatured,
}: {
  artwork: Artwork;
  onTogglePublished: () => void;
  onToggleFeatured: () => void;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 divide-x divide-black/10 dark:divide-white/10 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={onTogglePublished}
        title={artwork.published ? "Unpublish" : "Publish"}
        className={`p-2 transition-colors ${!artwork.published
          ? "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
          }`}
      >
        {artwork.published ? (
          <ToggleRight size={16} />
        ) : (
          <ToggleLeft size={16} />
        )}
      </button>

      <button
        type="button"
        onClick={onToggleFeatured}
        title={artwork.featured ? "Remove from Featured" : "Mark as Featured"}
        className={`p-2 transition-colors ${artwork.featured
          ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
          }`}
      >
        <Star size={16} className={artwork.featured ? "fill-current" : ""} />
      </button>
    </div>
  );
}

export function ArtworksClient({
  initialArtworks,
  sections = [],
}: {
  initialArtworks: Artwork[];
  sections?: SectionOption[];
}) {
  const router = useRouter();
  const [artworks, setArtworks] = useState(initialArtworks);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  function openDeleteConfirm(id: string) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(id);
  }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [uploadingExtraVideo, setUploadingExtraVideo] = useState(false);
  const [extraVideoTrimProgress, setExtraVideoTrimProgress] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extraFileInputRef = useRef<HTMLInputElement>(null);
  const extraVideoInputRef = useRef<HTMLInputElement>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Section Filter State (filter list down to a single section, or "ALL")
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");

  // Tag Filter State — independent on/off toggles (an artwork can be both
  // Featured and a New Release at once, unlike the mutually-exclusive status tabs)
  const [featuredFilter, setFeaturedFilter] = useState(false);
  const [timelapseFilter, setTimelapseFilter] = useState(false);

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
  const [viewingItem, setViewingItem] = useState<Artwork | null>(null);

  // Lock body scroll when any modal or lightbox is active
  const isModalOpen =
    showModal ||
    Boolean(viewingItem) ||
    Boolean(previewImage) ||
    Boolean(deleteConfirm);
  useLockBodyScroll(isModalOpen);

  // Filtered & Sorted Artworks Memoized Logic
  const filteredAndSortedArtworks = useMemo(() => {
    // 1. Filter by status, section & search term
    const filtered = artworks.filter((artwork) => {
      // Status Filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "PUBLISHED" && !artwork.published) return false;
        if (statusFilter === "HIDDEN" && artwork.published) return false;
      }

      // Section Filter
      if (sectionFilter !== "ALL") {
        if (sectionFilter === "NONE") {
          if (artwork.sectionId) return false;
        } else if (artwork.sectionId !== sectionFilter) {
          return false;
        }
      }

      // Tag Filters
      if (featuredFilter && !artwork.featured) return false;
      if (timelapseFilter && !artwork.videoUrl) return false;

      // Search Filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const titleMatch = artwork.title.toLowerCase().includes(term);
      const descMatch = artwork.description?.toLowerCase().includes(term);
      const mediumMatch = artwork.medium?.toLowerCase().includes(term);
      const tagsMatch = artwork.tags?.some((t) =>
        t.toLowerCase().includes(term)
      );
      const sectionMatch = artwork.section?.name.toLowerCase().includes(term);

      return (
        titleMatch || descMatch || mediumMatch || tagsMatch || sectionMatch
      );
    });

    // 2. Sort results
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "section": {
          const sectionA = a.section?.name || "ZZZ";
          const sectionB = b.section?.name || "ZZZ";
          comparison = sectionA.localeCompare(sectionB);
          // Tie-break by title so artworks within the same section stay grouped & readable
          if (comparison === 0) comparison = a.title.localeCompare(b.title);
          break;
        }
        case "featured":
          comparison = Number(b.featured) - Number(a.featured);
          // Tie-break by title so featured/non-featured groups stay readable
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
  }, [
    artworks,
    statusFilter,
    sectionFilter,
    featuredFilter,
    timelapseFilter,
    searchTerm,
    sortBy,
    sortOrder,
  ]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedArtworks.length / pageSize);
  const paginatedArtworks = filteredAndSortedArtworks.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(artwork: Artwork) {
    setEditing(artwork);
    setForm({
      title: artwork.title,
      description: artwork.description,
      imageUrl: artwork.imageUrl,
      imageUrls: artwork.imageUrls || [],
      videoUrl: artwork.videoUrl || "",
      videoUrls: artwork.videoUrls || [],
      tags: artwork.tags.join(", "),
      medium: artwork.medium || "",
      dimensions: artwork.dimensions || "",
      year: artwork.year?.toString() || "",
      featured: artwork.featured,
      isNewRelease: artwork.isNewRelease,
      published: artwork.published,
      status: artwork.status,
      sectionId: artwork.sectionId || "",
    });
    setShowModal(true);
  }

  const handleFileUpload = useCallback(async (file: File) => {
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
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message || "Upload failed");
      } else {
        toast.error("Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  const MAX_EXTRA_IMAGES = 6;

  // Additional angle/detail shots — appended to form.imageUrls rather than
  // replacing form.imageUrl (the cover), same upload endpoint either way.
  const handleAdditionalImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10 MB)");
      return;
    }

    setUploadingExtra(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, url] }));
      toast.success("Image added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingExtra(false);
    }
  }, []);

  function removeAdditionalImage(index: number) {
    setForm((prev) => ({
      ...prev,
      imageUrls: prev.imageUrls.filter((_, i) => i !== index),
    }));
  }

  const MAX_EXTRA_VIDEOS = 2;

  // Additional clips beyond the primary videoUrl — same trim/upload
  // pipeline as ArtworkVideoUploader (see lib/artwork-video-upload.ts),
  // appended to form.videoUrls rather than replacing the primary video.
  const handleAdditionalVideoUpload = useCallback(async (file: File) => {
    setUploadingExtraVideo(true);
    setExtraVideoTrimProgress(null);
    const url = await uploadArtworkVideo(file, (elapsed) => setExtraVideoTrimProgress(elapsed));
    if (url) {
      setForm((prev) => ({ ...prev, videoUrls: [...prev.videoUrls, url] }));
    }
    setUploadingExtraVideo(false);
    setExtraVideoTrimProgress(null);
  }, []);

  function removeAdditionalVideo(index: number) {
    setForm((prev) => ({
      ...prev,
      videoUrls: prev.videoUrls.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.imageUrl) {
      toast.error("Upload an image first");
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      year: form.year ? parseInt(form.year) : null,
      sectionId: form.sectionId || null,
    };

    try {
      const url = editing ? `/api/artworks/${editing.id}` : "/api/artworks";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save piece");
      const data = await res.json();

      if (editing) {
        setArtworks(artworks.map((a) => (a.id === editing.id ? data : a)));
        toast.success("Piece updated");
      } else {
        setArtworks([data, ...artworks]);
        setCurrentPage(1);
        toast.success("Piece added");
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
      const res = await fetch(`/api/artworks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const next = artworks.filter((a) => a.id !== id);
      setArtworks(next);
      const newTotal = Math.ceil(next.length / pageSize);
      if (currentPage > newTotal && newTotal > 0) setCurrentPage(newTotal);
      setDeleteConfirm(null);
      toast.success("Piece moved to Trash");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function togglePublished(artwork: Artwork) {
    try {
      const res = await fetch(`/api/artworks/${artwork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !artwork.published }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setArtworks(artworks.map((a) => (a.id === artwork.id ? updated : a)));
      toast.success(updated.published ? "Published" : "Unpublished");
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function toggleFeatured(artwork: Artwork) {
    try {
      const res = await fetch(`/api/artworks/${artwork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !artwork.featured }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setArtworks(artworks.map((a) => (a.id === artwork.id ? updated : a)));
      toast.success(
        updated.featured ? "Marked as Featured" : "Removed from Featured"
      );
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
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
          New Piece
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Total Artworks:{" "}
          <strong className="text-ink dark:text-cream">
            {artworks.length}
          </strong>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(["ALL", "PUBLISHED", "HIDDEN"] as const).map(
            (status) => (
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
                {status === "HIDDEN" ? "DRAFT" : status}
              </button>
            )
          )}

          {/* Tag Filters — independent toggles, not part of the status group above */}
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
          <button
            onClick={() => {
              setTimelapseFilter((v) => !v);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${timelapseFilter
              ? "bg-sepia text-white border-sepia font-medium"
              : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
          >
            <Film size={10} />
            Video
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
              placeholder="Search artworks..."
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
            {/* Section Filter */}
            <div className="flex items-center gap-1 rounded-xl admin-input border px-2 py-1.5 w-full sm:w-auto sm:shrink-0">
              <Layers size={12} className="text-ink-400 shrink-0" />
              <select
                value={sectionFilter}
                onChange={(e) => {
                  setSectionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 min-w-0 sm:flex-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer sm:max-w-[9.5rem]"
                title="Filter by section"
              >
                <option value="ALL" className="bg-white dark:bg-ink-900">
                  All Sections
                </option>
                {sections.map((sec) => (
                  <option
                    key={sec.id}
                    value={sec.id}
                    className="bg-white dark:bg-ink-900"
                  >
                    {sec.name}
                  </option>
                ))}
                <option value="NONE" className="bg-white dark:bg-ink-900">
                  No Section
                </option>
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
                    // bury Featured / Draft items under the untagged pile
                    // if the toggle was left on "desc" from a prior sort.
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
                  <option value="section" className="bg-white dark:bg-ink-900">
                    Section Name (A-Z)
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
                {sortOrder === "asc" ? (
                  <ArrowUp size={12} />
                ) : (
                  <ArrowDown size={12} />
                )}
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

      {/* Artworks List */}
      {paginatedArtworks.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <Palette className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-jakarta font-medium text-ink dark:text-cream mb-1">
              {artworks.length === 0
                ? "No pieces yet"
                : "No matching pieces"}
            </h3>
            <p className="text-sm font-body text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {artworks.length === 0
                ? "Add a live photo, a gig poster or cover art — then hang it in a museum room."
                : "Try adjusting your search query, section or status filter criteria."}
            </p>
            {artworks.length === 0 ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-jakarta font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Add the first piece
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setSectionFilter("ALL");
                  setFeaturedFilter(false);
                  setTimelapseFilter(false);
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
          {paginatedArtworks.map((artwork) => (
            <div
              key={artwork.id}
              className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-sm hover:shadow-lg transition-shadow group"
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-[4/3] overflow-hidden cursor-pointer group/img bg-black/5 dark:bg-black/50"
                onClick={() => setViewingItem(artwork)}
              >
                <Image
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover/img:scale-105"
                />

                <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5 rounded-lg">
                    <ZoomIn size={14} /> View Details
                  </span>
                </div>

                {!artwork.published && (
                  <div className="absolute inset-0 bg-ink/60 flex items-center justify-center pointer-events-none">
                    <span className="font-body text-xs tracking-widest uppercase text-cream bg-ink/80 px-3 py-1 rounded-md">
                      Draft
                    </span>
                  </div>
                )}
                {artwork.featured && (
                  <div className="absolute top-2 left-2 bg-sepia px-2 py-0.5 rounded-md pointer-events-none flex items-center gap-1">
                    <Star size={10} className="text-white fill-current" />
                    <span className="font-body text-[10px] uppercase tracking-widest text-white">
                      Featured
                    </span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4">
                <h3
                  onClick={() => setViewingItem(artwork)}
                  className="font-jakarta text-base font-semibold tracking-tight truncate text-ink dark:text-cream cursor-pointer hover:underline"
                >
                  {artwork.title}
                </h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 line-clamp-1">
                  {[artwork.medium, artwork.dimensions, artwork.year]
                    .filter(Boolean)
                    .join(" • ") || "—"}
                </p>

                <div className="flex items-center justify-between gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (artwork.sectionId) {
                        setSectionFilter(artwork.sectionId);
                        setCurrentPage(1);
                      }
                    }}
                    disabled={!artwork.sectionId}
                    className="inline-block max-w-[60%] truncate px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono hover:border-sepia hover:text-sepia disabled:hover:border-black/10 disabled:hover:text-ink-400 disabled:cursor-default transition-colors"
                    title={
                      artwork.section?.name
                        ? `Filter by ${artwork.section.name}`
                        : undefined
                    }
                  >
                    {artwork.section?.name || "No Section"}
                  </button>
                  {artwork.product && (
                    <span className="font-jakarta text-sm font-bold tabular-nums text-ink dark:text-cream shrink-0">
                      ₱{artwork.product.price.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-3">
                  {getStatusBadges(artwork)}
                  {artwork.shareCount > 0 && (
                    <span
                      title={`Shared ${artwork.shareCount} time${artwork.shareCount !== 1 ? "s" : ""}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-400 dark:text-ink-300 shrink-0"
                    >
                      <Share2 size={10} />
                      {artwork.shareCount}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setViewingItem(artwork)}
                    title="View Details"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Eye size={16} />
                  </button>

                  <ArtworkFlagToggles
                    artwork={artwork}
                    onTogglePublished={() => togglePublished(artwork)}
                    onToggleFeatured={() => toggleFeatured(artwork)}
                  />


                  <button
                    onClick={() => openEdit(artwork)}
                    title="Edit"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(artwork.id)}
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
                  <th className="py-4 px-6 font-semibold">Preview</th>
                  <th className="py-4 px-6 font-semibold">Title & Details</th>
                  <th className="py-4 px-6 font-semibold">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === "section") {
                          setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        } else {
                          setSortBy("section");
                          setSortOrder("asc");
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-ink dark:hover:text-cream transition-colors"
                      title="Sort by section name"
                    >
                      Section
                      {sortBy === "section" ? (
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
                  <th className="py-4 px-6 font-semibold">Price</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {paginatedArtworks.map((artwork) => (
                  <tr
                    key={artwork.id}
                    className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Thumbnail */}
                    <td className="py-4 px-6 w-24">
                      <div
                        onClick={() => setViewingItem(artwork)}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                      >
                        <Image
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    </td>

                    {/* Title & Details */}
                    <td className="py-4 px-6 max-w-xs">
                      <div
                        onClick={() => setViewingItem(artwork)}
                        className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                      >
                        {artwork.title}
                      </div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-1 mt-0.5">
                        {[artwork.medium, artwork.dimensions, artwork.year]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </p>
                      {artwork.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {artwork.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
                            >
                              {tag}
                            </span>
                          ))}
                          {artwork.tags.length > 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 text-ink-400 dark:text-ink-300">
                              +{artwork.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Section */}
                    <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300 max-w-[150px]">
                      <button
                        type="button"
                        onClick={() => {
                          if (artwork.sectionId) {
                            setSectionFilter(artwork.sectionId);
                            setCurrentPage(1);
                          }
                        }}
                        disabled={!artwork.sectionId}
                        className="inline-block max-w-full truncate px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 text-xs text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono hover:border-sepia hover:text-sepia disabled:hover:border-black/10 disabled:hover:text-ink-400 disabled:cursor-default transition-colors"
                        title={
                          artwork.section?.name
                            ? `Filter by ${artwork.section.name}`
                            : undefined
                        }
                      >
                        {artwork.section?.name || "—"}
                      </button>
                    </td>

                    {/* Price */}
                    <td className="py-4 px-6">
                      {artwork.product ? (
                        <span className="font-jakarta text-sm font-bold tabular-nums text-ink dark:text-cream">
                          ₱{artwork.product.price.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-400 dark:text-ink-300">
                          —
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      {getStatusBadges(artwork)}
                      {artwork.shareCount > 0 && (
                        <span
                          title={`Shared ${artwork.shareCount} time${artwork.shareCount !== 1 ? "s" : ""}`}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-400 dark:text-ink-300 mt-1.5"
                        >
                          <Share2 size={10} />
                          {artwork.shareCount} share{artwork.shareCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Details */}
                        <button
                          onClick={() => setViewingItem(artwork)}
                          title="View Details"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Publish / Featured / New Release group */}
                        <ArtworkFlagToggles
                          artwork={artwork}
                          onTogglePublished={() => togglePublished(artwork)}
                          onToggleFeatured={() => toggleFeatured(artwork)}
                        />


                        {/* Edit */}
                        <button
                          onClick={() => openEdit(artwork)}
                          title="Edit"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => openDeleteConfirm(artwork.id)}
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
            {paginatedArtworks.map((artwork) => (
              <div key={artwork.id} className="p-4">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div
                    onClick={() => setViewingItem(artwork)}
                    className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer"
                  >
                    <Image
                      src={artwork.imageUrl}
                      alt={artwork.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Title & Details */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setViewingItem(artwork)}
                  >
                    <div className="font-semibold text-sm text-ink dark:text-cream truncate">
                      {artwork.title}
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-1 mt-0.5">
                      {[artwork.medium, artwork.dimensions, artwork.year]
                        .filter(Boolean)
                        .join(" • ") || "—"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (artwork.sectionId) {
                            setSectionFilter(artwork.sectionId);
                            setCurrentPage(1);
                          }
                        }}
                        disabled={!artwork.sectionId}
                        className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono disabled:cursor-default"
                      >
                        {artwork.section?.name || "No Section"}
                      </button>
                      {artwork.product && (
                        <span className="font-jakarta text-xs font-bold tabular-nums text-ink dark:text-cream">
                          ₱{artwork.product.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center justify-between gap-2 mt-3">
                  {getStatusBadges(artwork)}
                  {artwork.shareCount > 0 && (
                    <span
                      title={`Shared ${artwork.shareCount} time${artwork.shareCount !== 1 ? "s" : ""}`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-ink-400 dark:text-ink-300 shrink-0"
                    >
                      <Share2 size={10} />
                      {artwork.shareCount}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setViewingItem(artwork)}
                    title="View Details"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Eye size={16} />
                  </button>

                  <ArtworkFlagToggles
                    artwork={artwork}
                    onTogglePublished={() => togglePublished(artwork)}
                    onToggleFeatured={() => toggleFeatured(artwork)}
                  />


                  <button
                    onClick={() => openEdit(artwork)}
                    title="Edit"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(artwork.id)}
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
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
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
              <p className="text-cream font-jakarta text-sm text-center">{previewImage.title}</p>
            )}
          </div>
        </div>
      )}

      {/* VIEW ARTWORK DETAILS MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">
                  Piece Details
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
              {/* Image Preview */}
              <div
                onClick={() =>
                  setPreviewImage({
                    url: viewingItem.imageUrl,
                    title: viewingItem.title,
                  })
                }
                className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 cursor-pointer group"
              >
                <Image
                  src={viewingItem.imageUrl}
                  alt={viewingItem.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                    <ZoomIn size={14} /> View Full Image
                  </span>
                </div>
              </div>

              {/* Title & Status */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold text-ink dark:text-cream">{viewingItem.title}</h4>
                </div>
                {getStatusBadges(viewingItem)}
                <p className="text-sm text-ink-400 dark:text-ink-300 whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-3 rounded-xl mt-2 border border-black/5 dark:border-white/5">
                  {viewingItem.description}
                </p>
              </div>

              {/* Additional Media — extra angle/detail shots (imageUrls) and
                  the optional timelapse video(s) (videoUrl + videoUrls),
                  when present. */}
              {(viewingItem.imageUrls.length > 0 ||
                viewingItem.videoUrl ||
                viewingItem.videoUrls.length > 0) && (
                <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                    <ImagePlus size={12} /> Additional Media
                  </span>

                  {viewingItem.imageUrls.length > 0 && (
                    <div>
                      <p className="text-xs text-ink-400 dark:text-ink-300 mb-1.5">
                        {viewingItem.imageUrls.length} additional{" "}
                        {viewingItem.imageUrls.length === 1 ? "image" : "images"}
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {viewingItem.imageUrls.map((url, i) => (
                          <div
                            key={`${url}-${i}`}
                            onClick={() =>
                              setPreviewImage({
                                url,
                                title: `${viewingItem.title} — image ${i + 2}`,
                              })
                            }
                            className="relative aspect-square rounded-lg overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/50 cursor-pointer group"
                          >
                            <Image
                              src={url}
                              alt={`${viewingItem.title} additional image ${i + 1}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const allVideos = [viewingItem.videoUrl, ...viewingItem.videoUrls].filter(
                      (v): v is string => Boolean(v)
                    );
                    if (allVideos.length === 0) return null;
                    return (
                      <div>
                        <p className="flex items-center gap-1 text-xs text-ink-400 dark:text-ink-300 mb-1.5">
                          <Film size={11} />{" "}
                          {allVideos.length === 1
                            ? "Timelapse video"
                            : `Timelapse videos (${allVideos.length})`}
                        </p>
                        <div className={`grid gap-2 ${allVideos.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                          {allVideos.map((url, i) => (
                            <div
                              key={`${url}-${i}`}
                              className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/15 bg-black"
                            >
                              <video
                                src={url}
                                controls
                                playsInline
                                className={`w-full bg-black ${
                                  allVideos.length > 1 ? "max-h-36" : "max-h-56"
                                }`}
                              />
                              {allVideos.length > 1 && (
                                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-medium pointer-events-none">
                                  {i + 1}/{allVideos.length}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Details List */}
              <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Kind:</span>
                  <span className="font-medium text-ink dark:text-cream">{viewingItem.medium || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Dimensions:</span>
                  <span className="font-medium text-ink dark:text-cream">{viewingItem.dimensions || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Year:</span>
                  <span className="font-medium text-ink dark:text-cream">{viewingItem.year || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Section:</span>
                  <span className="font-medium text-ink dark:text-cream">{viewingItem.section?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Price:</span>
                  <span className="font-mono font-medium text-ink dark:text-cream">
                    {viewingItem.product ? `₱${viewingItem.product.price.toLocaleString()}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400 flex items-center gap-1.5">
                    <Share2 size={11} /> Shares:
                  </span>
                  <span className="font-mono font-medium text-ink dark:text-cream">
                    {viewingItem.shareCount}
                  </span>
                </div>
              </div>

              {viewingItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {viewingItem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons - EDIT BUTTON INSIDE VIEW MODAL*/}
              {/* <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
                <button
                  onClick={() => {
                    const prod = viewingItem;
                    setViewingItem(null);
                    openEdit(prod);
                  }}
                  className="flex-1 py-2 px-4 rounded-xl bg-sepia text-white text-xs font-medium hover:bg-sepia-dark transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={14} /> Edit Piece
                </button>
                <button
                  onClick={() => setViewingItem(null)}
                  className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
                >
                  Close
                </button>
              </div> */}
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
                {editing ? "Edit Piece" : "New Piece"}
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
              id="artwork-form"
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

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Image <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                {form.imageUrl ? (
                  <div className="relative">
                    {/* Image Container with View Full Image Overlay */}
                    <div
                      className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/60 cursor-pointer group"
                      onClick={() =>
                        setPreviewImage({
                          url: form.imageUrl,
                          title: form.title || "Preview",
                        })
                      }
                    >
                      <Image src={form.imageUrl} alt="Preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                          <ZoomIn size={14} /> View Full Image
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons below the Image */}
                    <div className="flex items-center gap-2 mt-3">
                      {/* Replace / Change Image Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <Upload size={12} />
                        Replace Image
                      </button>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, imageUrl: "" })}
                        className="text-xs text-red-500 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <X size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
                      {uploading ? "Uploading image..." : "Click or drag & drop image here"}
                    </p>
                    <p className="text-xs text-ink-400 dark:text-ink-400 mt-1">JPEG, PNG, WebP, GIF (Max 10 MB)</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
              </div>

              {/* Additional Images — extra angle/detail shots shown as a
                  thumbnail gallery in the public detail view, alongside the
                  cover above. Optional, up to MAX_EXTRA_IMAGES. */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Additional Images (optional)
                </label>
                <p className="text-xs text-ink-400 dark:text-ink-300 mb-3">
                  Extra angles, detail shots, or size-in-context photos — shown
                  as a thumbnail gallery next to the cover image above.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {form.imageUrls.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      className="relative aspect-square rounded-lg overflow-hidden border border-black/10 dark:border-white/15 bg-black/5 dark:bg-black/60 group"
                    >
                      <Image src={url} alt={`Additional image ${i + 1}`} fill className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAdditionalImage(i)}
                        title="Remove image"
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {form.imageUrls.length < MAX_EXTRA_IMAGES && (
                    <button
                      type="button"
                      onClick={() => extraFileInputRef.current?.click()}
                      disabled={uploadingExtra}
                      className="aspect-square rounded-lg border-2 border-dashed border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-ink-400 dark:text-ink-300 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                      <span className="text-[10px]">{uploadingExtra ? "Uploading…" : "Add"}</span>
                    </button>
                  )}
                </div>
                <input
                  ref={extraFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAdditionalImageUpload(file);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </div>

              {/* Timelapse Video — optional "making of" clip, max 60s (auto-
                  cropped client-side if longer). Grouped with the image
                  fields above since it's still artwork media. */}
              <ArtworkVideoUploader
                value={form.videoUrl}
                onChange={(url) => setForm((prev) => ({ ...prev, videoUrl: url }))}
              />

              {/* Additional Videos — up to MAX_EXTRA_VIDEOS more clips beyond
                  the primary timelapse above (alternate angles, extra
                  process footage). Same trim/upload pipeline, shown as a
                  compact list rather than another full uploader card. */}
              {form.videoUrl && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Additional Videos (optional)
                  </label>
                  <p className="text-xs text-ink-400 dark:text-ink-300 mb-3">
                    Up to {MAX_EXTRA_VIDEOS} more clips — alternate angles or
                    process footage — shown alongside the primary video above.
                  </p>
                  <div className="space-y-3">
                    {form.videoUrls.map((url, i) => (
                      <div
                        key={`${url}-${i}`}
                        className="relative rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 p-3"
                      >
                        <video
                          src={url}
                          controls
                          playsInline
                          className="w-full rounded-lg max-h-48 bg-black"
                        />
                        <button
                          type="button"
                          onClick={() => removeAdditionalVideo(i)}
                          title="Remove video"
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {form.videoUrls.length < MAX_EXTRA_VIDEOS && (
                      <button
                        type="button"
                        onClick={() => extraVideoInputRef.current?.click()}
                        disabled={uploadingExtraVideo}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30 bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] py-4 text-xs text-ink-400 dark:text-ink-300 transition-colors disabled:opacity-50"
                      >
                        {uploadingExtraVideo ? (
                          extraVideoTrimProgress !== null ? (
                            <span className="flex items-center gap-2">
                              <Scissors size={14} className="text-sepia animate-pulse" />
                              Trimming… {extraVideoTrimProgress}/{MAX_VIDEO_DURATION_SEC}s
                            </span>
                          ) : (
                            <span>Uploading…</span>
                          )
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Plus size={14} /> Add video
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                  <input
                    ref={extraVideoInputRef}
                    type="file"
                    accept={ALLOWED_VIDEO_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAdditionalVideoUpload(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* Kind & Size — "Kind" is the old Medium column: it reads on
                  the museum plaque as "Live photo · 2025", so presets keep
                  the wording consistent while still allowing anything. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Kind
                  </label>
                  <input
                    type="text"
                    list="piece-kind-presets"
                    placeholder="Live photo"
                    value={form.medium}
                    onChange={(e) => setForm({ ...form, medium: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                  <datalist id="piece-kind-presets">
                    {PIECE_KIND_PRESETS.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                  <p className="mt-1 font-body text-[11px] text-ink-400 dark:text-ink-300">Shown on the plaque with the year.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Size <span className="normal-case tracking-normal font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="A3 poster · 1080 × 1350"
                    value={form.dimensions}
                    onChange={(e) => setForm({ ...form, dimensions: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Year */}
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
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="abstract, blue, featured"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              {/* Section */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Section
                </label>
                <div className="relative">
                  <select
                    value={form.sectionId}
                    onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                    className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-white dark:bg-ink-900">No Section</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id} className="bg-white dark:bg-ink-900">
                        {sec.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
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
                  <span className="text-sm font-medium text-ink dark:text-cream">Featured</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.published}
                    onChange={(e) => setForm({ ...form, published: e.target.checked })}
                    className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-ink dark:text-cream">Published</span>
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
                form="artwork-form"
                disabled={loading || uploading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : editing ? "Save Changes" : "Add Piece"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">Delete Piece</h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              Are you sure you want to delete this artwork? This action cannot be undone.
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