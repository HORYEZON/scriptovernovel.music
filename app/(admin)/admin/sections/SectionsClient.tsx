// app/(admin)/admin/sections/SectionsClient.tsx
"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/SafeImage";
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Eye,
  ArrowUp,
  ArrowDown,
  Upload,
  FolderOpen,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ZoomIn,
  LayoutGrid,
  List,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { getErrorMessage } from "@/lib/utils";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";

interface Section {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  coverImageUrl: string | null;
  isPublished: boolean;
  _count: { artworks: number };
}

interface SectionArtwork {
  id: string;
  title: string;
  imageUrl: string;
  published: boolean;
}

type StatusFilter = "ALL" | "PUBLISHED" | "HIDDEN";
type SortOption = "order" | "name" | "artworks";
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "grid";

const EMPTY_FORM = {
  name: "",
  coverImageUrl: "",
  isPublished: true,
};

// Publish / Hidden status badge shown in the table row, mobile card, grid card & details modal
function getSectionStatusBadge(section: Section) {
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border ${
        section.isPublished
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10"
      }`}
    >
      {section.isPublished ? "Published" : "Hidden"}
    </span>
  );
}

export function SectionsClient({
  initialSections,
}: {
  initialSections: Section[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Section[]>(initialSections);

  // Search, Filter & Sort States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("order");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // View Mode State (table rows vs. grid cards)
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [viewingSection, setViewingSection] = useState<Section | null>(null);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Section | null>(null);
  function openDeleteConfirm(section: Section) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(section);
  }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Full Image View Lightbox State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // Linked Artworks Modal State (opened from "Linked Artworks" field in Section Details)
  const [artworksModalSection, setArtworksModalSection] =
    useState<Section | null>(null);
  const [sectionArtworks, setSectionArtworks] = useState<SectionArtwork[]>([]);
  const [loadingSectionArtworks, setLoadingSectionArtworks] = useState(false);

  // Lock body scroll when any modal or lightbox overlay is active
  useLockBodyScroll(
    showModal ||
      Boolean(viewingSection) ||
      Boolean(deleteConfirm) ||
      Boolean(previewImage) ||
      Boolean(artworksModalSection)
  );

  // Fetch and display the artworks linked to a section
  const openSectionArtworks = useCallback(async (section: Section) => {
    setArtworksModalSection(section);
    setSectionArtworks([]);
    setLoadingSectionArtworks(true);
    try {
      const res = await fetch(`/api/sections/${section.id}`);
      if (!res.ok) throw new Error("Failed to load artworks");
      const data = await res.json();
      setSectionArtworks(data.artworks || []);
    } catch {
      toast.error("Failed to load linked artworks");
    } finally {
      setLoadingSectionArtworks(false);
    }
  }, []);

  // Compute filtered & sorted list
  const processedSections = useMemo(() => {
    return sections
      .filter((section) => {
        // Status Filter
        if (statusFilter === "PUBLISHED" && !section.isPublished) return false;
        if (statusFilter === "HIDDEN" && section.isPublished) return false;

        // Search Query
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const nameMatch = section.name.toLowerCase().includes(q);
          const slugMatch = section.slug.toLowerCase().includes(q);
          return nameMatch || slugMatch;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "artworks":
            comparison = a._count.artworks - b._count.artworks;
            break;
          case "order":
          default:
            comparison = a.displayOrder - b.displayOrder;
            break;
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [sections, searchQuery, statusFilter, sortBy, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(processedSections.length / pageSize);
  const paginatedSections = processedSections.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const isReorderingAllowed =
    searchQuery === "" &&
    statusFilter === "ALL" &&
    sortBy === "order" &&
    sortOrder === "asc";

  function handleResetFilters() {
    setSearchQuery("");
    setStatusFilter("ALL");
    setSortBy("order");
    setSortOrder("asc");
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(section: Section) {
    setEditing(section);
    setForm({
      name: section.name,
      coverImageUrl: section.coverImageUrl || "",
      isPublished: section.isPublished,
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
      setForm((prev) => ({ ...prev, coverImageUrl: url }));
      toast.success("Cover image uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (editing) {
        const res = await fetch(`/api/sections/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to update");
        const data = await res.json();
        setSections(sections.map((s) => (s.id === editing.id ? data : s)));
        toast.success("Section updated");
      } else {
        const res = await fetch("/api/sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to create");
        const data = await res.json();
        setSections([...sections, data]);
        toast.success("Section created");
      }
      setShowModal(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(section: Section) {
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setSections(sections.filter((s) => s.id !== section.id));
      setDeleteConfirm(null);
      toast.success("Section moved to Trash");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  }

  async function togglePublished(section: Section) {
    try {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !section.isPublished }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setSections(sections.map((s) => (s.id === section.id ? updated : s)));
      toast.success(
        updated.isPublished ? "Section published" : "Section hidden"
      );
      router.refresh();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function moveSection(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;

    const reordered = [...sections];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    const order = reordered.map((s, i) => ({ id: s.id, displayOrder: i }));

    // Optimistic update
    setSections(reordered.map((s, i) => ({ ...s, displayOrder: i })));

    try {
      const res = await fetch("/api/sections/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSections(data);
      router.refresh();
    } catch {
      setSections(sections); // Revert on error
      toast.error("Failed to reorder");
    }
  }

  return (
    <>
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New Section
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Showing{" "}
          <strong className="text-ink dark:text-cream">
            {processedSections.length}
          </strong>{" "}
          of{" "}
          <strong className="text-ink dark:text-cream">
            {sections.length}
          </strong>{" "}
          sections
        </div>
      </div>

      {/* Filter, Search & Sort Control Panel */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(["ALL", "PUBLISHED", "HIDDEN"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
                statusFilter === status
                  ? "bg-sepia text-white border-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Search Bar */}
          <div className="relative sm:w-60">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sections or slug..."
              className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Secondary controls — a fixed 2-up grid on mobile so every chip
              gets a predictable, compact spot (no overflow, nothing hidden);
              reverts to a free-flowing wrap once there's room at sm+ */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {/* Sort Group */}
            <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
              <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 flex-1 min-w-0 sm:flex-none">
                <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="flex-1 min-w-0 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
                >
                  <option value="order" className="bg-white dark:bg-ink-900">
                    Display Order
                  </option>
                  <option value="name" className="bg-white dark:bg-ink-900">
                    Name
                  </option>
                  <option value="artworks" className="bg-white dark:bg-ink-900">
                    Artworks Count
                  </option>
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
              </div>

              {/* Sort Order Direction Toggle */}
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="p-2 rounded-xl admin-input border text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors shrink-0"
                title={
                  sortOrder === "asc" ? "Ascending order" : "Descending order"
                }
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
            <div className="flex items-center justify-center sm:justify-start gap-0.5 rounded-xl admin-input border p-1 col-span-2 sm:w-auto sm:shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table view"
                aria-label="Table view"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "table"
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
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === "grid"
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

      {/* Quick status message for manual reordering */}
      {!isReorderingAllowed && (
        <div className="mb-4 font-body text-[11px] text-ink-400 dark:text-ink-500 italic px-1">
          * Reordering is disabled when search, filter, or sort is active.
        </div>
      )}

      {/* Sections List */}
      {processedSections.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-jakarta font-medium text-ink dark:text-cream mb-1">
              {sections.length === 0
                ? "No sections yet"
                : "No matching sections"}
            </h3>
            <p className="text-sm font-body text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {sections.length === 0
                ? 'Create sections to organize your artworks into categories like "Traditional Arts", "Character Design", etc.'
                : "Try adjusting your search query or status filter criteria."}
            </p>
            {sections.length === 0 ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-jakarta font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Create First Section
              </button>
            ) : (
              <button
                onClick={handleResetFilters}
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
          {paginatedSections.map((section) => {
            const originalIndex = sections.findIndex(
              (s) => s.id === section.id
            );
            const reorderTitle = isReorderingAllowed
              ? undefined
              : "Clear search/filter & set sort to 'Display Order' to reorder";

            return (
              <div
                key={section.id}
                className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-sm hover:shadow-lg transition-shadow group"
              >
                {/* Cover */}
                <div
                  className="relative aspect-[4/3] overflow-hidden cursor-pointer bg-black/5 dark:bg-black/50"
                  onClick={() => setViewingSection(section)}
                >
                  {section.coverImageUrl ? (
                    <>
                      <Image
                        src={section.coverImageUrl}
                        alt={section.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5 rounded-lg">
                          <ZoomIn size={14} /> View Details
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-400 dark:text-ink-300">
                      <FolderOpen size={32} />
                    </div>
                  )}
                  {!section.isPublished && (
                    <div className="absolute top-2 right-2 pointer-events-none">
                      {getSectionStatusBadge(section)}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-4">
                  <h3
                    onClick={() => setViewingSection(section)}
                    className="font-jakarta text-base font-semibold tracking-tight truncate text-ink dark:text-cream cursor-pointer hover:underline"
                  >
                    {section.name}
                  </h3>
                  <p className="font-body text-xs font-mono text-ink-400 dark:text-ink-300 mt-1">
                    /{section.slug}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                        #{section.displayOrder}
                      </span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveSection(originalIndex, "up")}
                          disabled={!isReorderingAllowed || originalIndex === 0}
                          title={reorderTitle || "Move up"}
                          className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          onClick={() => moveSection(originalIndex, "down")}
                          disabled={
                            !isReorderingAllowed ||
                            originalIndex === sections.length - 1
                          }
                          title={reorderTitle || "Move down"}
                          className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                        >
                          <ArrowDown size={11} />
                        </button>
                      </div>
                    </div>
                    <span className="text-[11px] text-ink-400 dark:text-ink-300 shrink-0">
                      {section._count.artworks} artwork
                      {section._count.artworks !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className="mt-3">{getSectionStatusBadge(section)}</div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => setViewingSection(section)}
                      title="View Details"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      onClick={() => togglePublished(section)}
                      title={
                        section.isPublished ? "Hide section" : "Publish section"
                      }
                      className={`p-2 rounded-lg transition-colors ${
                        !section.isPublished
                          ? "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {section.isPublished ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>

                    <button
                      onClick={() => openEdit(section)}
                      title="Edit"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => openDeleteConfirm(section)}
                      title="Delete"
                      className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors ml-auto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold">Preview</th>
                  <th className="py-4 px-6 font-semibold">Title & Details</th>
                  <th className="py-4 px-6 font-semibold">Order</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {paginatedSections.map((section) => {
                  const originalIndex = sections.findIndex(
                    (s) => s.id === section.id
                  );
                  const reorderTitle = isReorderingAllowed
                    ? undefined
                    : "Clear search/filter & set sort to 'Display Order' to reorder";

                  return (
                    <tr
                      key={section.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="py-4 px-6 w-24">
                        {section.coverImageUrl ? (
                          <div
                            onClick={() => setViewingSection(section)}
                            className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                          >
                            <Image
                              src={section.coverImageUrl}
                              alt={section.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => setViewingSection(section)}
                            className="w-14 h-14 rounded-lg border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0 cursor-pointer"
                          >
                            <FolderOpen size={20} />
                          </div>
                        )}
                      </td>

                      {/* Title & Details */}
                      <td className="py-4 px-6 max-w-xs">
                        <div
                          onClick={() => setViewingSection(section)}
                          className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                        >
                          {section.name}
                        </div>
                        <p className="text-xs font-mono text-ink-400 dark:text-ink-300 mt-0.5">
                          /{section.slug}
                        </p>
                        <p className="text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                          {section._count.artworks} artwork
                          {section._count.artworks !== 1 ? "s" : ""}
                        </p>
                      </td>

                      {/* Order */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 text-xs text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                            #{section.displayOrder}
                          </span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveSection(originalIndex, "up")}
                              disabled={
                                !isReorderingAllowed || originalIndex === 0
                              }
                              title={reorderTitle || "Move up"}
                              className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              onClick={() => moveSection(originalIndex, "down")}
                              disabled={
                                !isReorderingAllowed ||
                                originalIndex === sections.length - 1
                              }
                              title={reorderTitle || "Move down"}
                              className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {getSectionStatusBadge(section)}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Details */}
                          <button
                            onClick={() => setViewingSection(section)}
                            title="View Details"
                            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Publish / Hide Toggle */}
                          <button
                            onClick={() => togglePublished(section)}
                            title={
                              section.isPublished
                                ? "Hide section"
                                : "Publish section"
                            }
                            className={`p-2 rounded-lg transition-colors ${
                              !section.isPublished
                                ? "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            {section.isPublished ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEdit(section)}
                            title="Edit"
                            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => openDeleteConfirm(section)}
                            title="Delete"
                            className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-black/5 dark:divide-white/5">
            {paginatedSections.map((section) => {
              const originalIndex = sections.findIndex(
                (s) => s.id === section.id
              );
              const reorderTitle = isReorderingAllowed
                ? undefined
                : "Clear search/filter & set sort to 'Display Order' to reorder";

              return (
                <div key={section.id} className="p-4">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    {section.coverImageUrl ? (
                      <div
                        onClick={() => setViewingSection(section)}
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer"
                      >
                        <Image
                          src={section.coverImageUrl}
                          alt={section.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        onClick={() => setViewingSection(section)}
                        className="w-16 h-16 rounded-lg border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0 cursor-pointer"
                      >
                        <FolderOpen size={20} />
                      </div>
                    )}

                    {/* Title & Details */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => setViewingSection(section)}
                    >
                      <div className="font-semibold text-sm text-ink dark:text-cream truncate">
                        {section.name}
                      </div>
                      <p className="text-xs font-mono text-ink-400 dark:text-ink-300 mt-0.5">
                        /{section.slug}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                          #{section.displayOrder}
                        </span>
                        <span className="text-[11px] text-ink-400 dark:text-ink-300">
                          {section._count.artworks} artwork
                          {section._count.artworks !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status + Reorder */}
                  <div className="flex items-center justify-between mt-3">
                    {getSectionStatusBadge(section)}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => moveSection(originalIndex, "up")}
                        disabled={!isReorderingAllowed || originalIndex === 0}
                        title={reorderTitle || "Move up"}
                        className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        onClick={() => moveSection(originalIndex, "down")}
                        disabled={
                          !isReorderingAllowed ||
                          originalIndex === sections.length - 1
                        }
                        title={reorderTitle || "Move down"}
                        className="text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => setViewingSection(section)}
                      title="View Details"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      onClick={() => togglePublished(section)}
                      title={
                        section.isPublished ? "Hide section" : "Publish section"
                      }
                      className={`p-2 rounded-lg transition-colors ${
                        !section.isPublished
                          ? "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {section.isPublished ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>

                    <button
                      onClick={() => openEdit(section)}
                      title="Edit"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => openDeleteConfirm(section)}
                      title="Delete"
                      className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
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
                className={`w-8 h-8 rounded-xl text-xs font-medium transition-all ${
                  isActive
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

      {/* Full Image Preview Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-ink/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          {/* Top Bar / Controls */}
          <div
            className="w-full max-w-5xl flex items-center justify-between mb-4 text-cream"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-jakarta text-base sm:text-lg font-medium truncate pr-4">
              {previewImage.title || "Image Preview"}
            </h3>
            <button
              onClick={() => setPreviewImage(null)}
              className="p-2 hover:bg-white/10 transition-colors text-cream rounded-full"
              title="Close (Esc)"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image Container */}
          <div
            className="relative w-full max-w-5xl h-[75vh] sm:h-[80vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={previewImage.url}
              alt={previewImage.title || "Full Image Preview"}
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}

      {/* View Section Details Modal */}
      {viewingSection && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="bg-cream dark:bg-ink-900 w-full max-w-md max-h-[90vh] overflow-y-auto border border-ink-100 dark:border-ink-700">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-ink-100 dark:border-ink-700">
              <div>
                <h2 className="font-jakarta text-xl font-semibold text-ink dark:text-cream">
                  Section Details
                </h2>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  ID: {viewingSection.id}
                </p>
              </div>
              <button
                onClick={() => setViewingSection(null)}
                className="text-ink dark:text-cream shrink-0 ml-3"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Cover Preview - click to view full image */}
              <div
                className={`relative w-full h-48 bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 overflow-hidden group ${
                  viewingSection.coverImageUrl ? "cursor-pointer" : ""
                }`}
                onClick={() =>
                  viewingSection.coverImageUrl &&
                  setPreviewImage({
                    url: viewingSection.coverImageUrl,
                    title: viewingSection.name,
                  })
                }
              >
                {viewingSection.coverImageUrl ? (
                  <>
                    <Image
                      src={viewingSection.coverImageUrl}
                      alt={viewingSection.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5">
                        <ZoomIn size={14} /> View Full Image
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-ink-300 dark:text-ink-600 gap-2">
                    <FolderOpen size={32} />
                    <p className="font-body text-xs">No cover image set</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-3 font-body text-sm">
                <div className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-400">Section Name:</span>
                  <span className="font-semibold text-ink dark:text-cream">
                    {viewingSection.name}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-400">URL Slug:</span>
                  <span className="font-mono text-xs text-ink dark:text-cream">
                    {viewingSection.slug}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-400">Display Order:</span>
                  <span className="text-ink dark:text-cream">
                    #{viewingSection.displayOrder}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-400">Linked Artworks:</span>
                  <button
                    type="button"
                    onClick={() => openSectionArtworks(viewingSection)}
                    className="font-semibold text-sepia hover:underline underline-offset-2 transition-colors"
                    title="View linked artworks"
                  >
                    {viewingSection._count.artworks} item(s)
                  </button>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100 dark:border-ink-800">
                  <span className="text-ink-400">Visibility:</span>
                  <span
                    className={`font-body text-[10px] uppercase tracking-wider px-2 py-0.5 ${
                      viewingSection.isPublished
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-ink-100 text-ink-600 dark:bg-ink-700 dark:text-ink-300"
                    }`}
                  >
                    {viewingSection.isPublished ? "Published" : "Hidden"}
                  </span>
                </div>
              </div>

              {/* Action Links - EDIT BUTTON INSIDE VIEW MODAL */}
              {/* <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const sec = viewingSection;
                    setViewingSection(null);
                    openEdit(sec);
                  }}
                  className="flex-1 text-xs px-3.5 py-2 rounded-lg border border-sepia bg-sepia text-white hover:bg-sepia-dark flex items-center justify-center gap-1.5 transition-colors font-medium shadow-sm"
                >
                  <Pencil size={14} /> Edit Section
                </button>

                {/* Close Button */}
              {/* <button
                  type="button"
                  onClick={() => setViewingSection(null)}
                  className="text-xs px-3.5 py-2 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                >
                  Close
                </button>
              </div> */}
            </div>
          </div>
        </div>
      )}

      {/* Linked Artworks Modal — lists artworks belonging to a section */}
      {artworksModalSection && (
        <div
          className="fixed inset-0 z-[55] bg-ink/70 flex items-center justify-center p-4"
          onClick={() => setArtworksModalSection(null)}
        >
          <div
            className="bg-cream dark:bg-ink-900 w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-ink-100 dark:border-ink-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-ink-100 dark:border-ink-700 sticky top-0 bg-cream dark:bg-ink-900 z-10">
              <div>
                <h2 className="font-jakarta text-xl font-semibold text-ink dark:text-cream">
                  Linked Artworks
                </h2>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  {artworksModalSection.name}
                </p>
              </div>
              <button
                onClick={() => setArtworksModalSection(null)}
                className="text-ink dark:text-cream shrink-0 ml-3"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {loadingSectionArtworks ? (
                <div className="flex items-center justify-center py-16 text-ink-400 dark:text-ink-500 font-body text-sm">
                  Loading artworks…
                </div>
              ) : sectionArtworks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-ink-300 dark:text-ink-600 gap-2">
                  <FolderOpen size={32} />
                  <p className="font-body text-xs">
                    No artworks linked to this section
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sectionArtworks.map((artwork) => (
                    <button
                      key={artwork.id}
                      type="button"
                      onClick={() =>
                        setPreviewImage({
                          url: artwork.imageUrl,
                          title: artwork.title,
                        })
                      }
                      className="group text-left"
                    >
                      <div className="relative w-full aspect-square bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 overflow-hidden">
                        <Image
                          src={artwork.imageUrl}
                          alt={artwork.title}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ZoomIn size={18} className="text-cream" />
                        </div>
                        {!artwork.published && (
                          <span className="absolute top-1.5 right-1.5 font-body text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-ink/80 text-cream">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs text-ink dark:text-cream mt-1.5 truncate">
                        {artwork.title}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/70 flex items-center justify-center p-4">
          <div className="bg-cream dark:bg-ink-900 w-full max-w-lg max-h-[90vh] overflow-auto border border-ink-100 dark:border-ink-700">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-ink-100 dark:border-ink-700">
              <h2 className="font-jakarta text-xl sm:text-2xl font-semibold text-ink dark:text-cream">
                {editing ? "Edit Section" : "New Section"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink dark:text-cream"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
              <div>
                <label className="label">Section Name *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-field"
                  placeholder="TRADITIONAL ARTS"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="label">Cover Image (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                {form.coverImageUrl ? (
                  <div className="relative">
                    <div
                      className="relative w-full h-40 border border-ink-100 dark:border-ink-700 cursor-pointer group"
                      onClick={() =>
                        setPreviewImage({
                          url: form.coverImageUrl,
                          title: form.name || "Cover Preview",
                        })
                      }
                    >
                      <Image
                        src={form.coverImageUrl}
                        alt="Cover preview"
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-ink/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5">
                          <ZoomIn size={14} /> Click to View Full Image
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {/* Replace Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                      >
                        <Upload size={12} />
                        Replace
                      </button>

                      {/* Remove Button */}
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
                  <div
                    className={`border-2 border-dashed ${
                      dragOver
                        ? "border-sepia bg-sepia/5"
                        : "border-ink-200 dark:border-ink-600 hover:border-ink-400 dark:hover:border-ink-400"
                    } transition-colors p-6 text-center cursor-pointer`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 border-2 border-ink-200 dark:border-ink-600 border-t-ink dark:border-t-cream rounded-full animate-spin" />
                        <p className="font-body text-sm text-ink-400 dark:text-ink-300">
                          Uploading...
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload
                          size={20}
                          className="text-ink-300 dark:text-ink-600"
                          strokeWidth={1}
                        />
                        <p className="font-body text-sm text-ink-600 dark:text-ink-200">
                          Drop an image or click to browse
                        </p>
                        <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                          Used as album thumbnail · Max 10 MB
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Published toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-ink dark:text-cream">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <span className="font-body text-sm">
                  Published (visible on public gallery)
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-black/10 dark:border-white/10">
                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs px-3.5 py-2 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                >
                  Cancel
                </button>

                {/* Submit / Action Button */}
                <button
                  type="submit"
                  disabled={loading || !form.name.trim()}
                  className="text-xs px-3.5 py-2 rounded-lg border border-sepia bg-sepia text-white hover:bg-sepia-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  {loading
                    ? "Saving..."
                    : editing
                      ? "Save Changes"
                      : "Create Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-vermillion" />
              </div>
            </div>
            <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream">
              Move &quot;{deleteConfirm.name}&quot; to Trash?
            </p>
            <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-2">
              You can restore it from the Trash module at any time.
            </p>
            <div className="bg-vermillion/10 border border-vermillion/20 p-3 mb-6 text-left">
              <p className="font-body text-sm text-vermillion font-medium mb-1">
                The following will be moved to Trash together:
              </p>
              <ul className="font-body text-xs text-ink-500 dark:text-ink-300 space-y-1 list-disc list-inside">
                <li>The section &quot;{deleteConfirm.name}&quot;</li>
                <li>
                  <strong>{deleteConfirm._count.artworks}</strong> linked
                  artwork
                  {deleteConfirm._count.artworks !== 1 ? "s" : ""} (and their
                  product listings)
                </li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Move to Trash
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
