// app/(admin)/admin/announcement/AnnouncementClient.tsx
"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "@/components/ui/SafeImage";
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Eye,
  Upload,
  Calendar,
  Link as LinkIcon,
  Megaphone,
  ArrowUpRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ZoomIn,
  ToggleLeft,
  ToggleRight,
  LayoutGrid,
  List
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { getErrorMessage } from "@/lib/utils";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";

export interface Announcement {
  id: string;
  title: string;
  message: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  startDate: string;
  endDate: string;
  isHidden: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  title: string;
  message: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  startDate: string;
  endDate: string;
  priority: number;
  isHidden: boolean;
}

type StatusFilter = "ALL" | "ACTIVE" | "SCHEDULED" | "EXPIRED" | "HIDDEN";
type SortOption = "priority" | "title" | "startDate" | "endDate";
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "grid";

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  imageUrl: "",
  linkUrl: "",
  linkLabel: "Click here to check more info",
  startDate: "",
  endDate: "",
  priority: 0,
  isHidden: false,
};

// Format Date object to YYYY-MM-THH:mm format for datetime-local input
function formatForDateTimeLocal(dateInput?: string | Date): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AnnouncementClient({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);

  // Search, Filter & Sort States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("priority");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc"); // Default highest priority first

  // View Mode State (table rows vs. grid cards)
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<Announcement | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  function openDeleteConfirm(id: string) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(id);
  }
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Full Image View Lightbox State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // Process Filtered and Sorted Announcements
  const processedAnnouncements = useMemo(() => {
    const now = new Date();

    return announcements
      .filter((item) => {
        // Status Filter
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);

        if (statusFilter === "HIDDEN" && !item.isHidden) return false;
        if (statusFilter === "ACTIVE" && (item.isHidden || now < start || now > end)) return false;
        if (statusFilter === "SCHEDULED" && (item.isHidden || now >= start)) return false;
        if (statusFilter === "EXPIRED" && (item.isHidden || now <= end)) return false;

        // Search Query
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const titleMatch = item.title.toLowerCase().includes(q);
          const messageMatch = item.message ? item.message.toLowerCase().includes(q) : false;
          const linkMatch = item.linkUrl ? item.linkUrl.toLowerCase().includes(q) : false;
          const labelMatch = item.linkLabel ? item.linkLabel.toLowerCase().includes(q) : false;
          return titleMatch || messageMatch || linkMatch || labelMatch;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "title":
            comparison = a.title.localeCompare(b.title);
            break;
          case "startDate":
            comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            break;
          case "endDate":
            comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
            break;
          case "priority":
          default:
            comparison = a.priority - b.priority;
            break;
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [announcements, searchQuery, statusFilter, sortBy, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(processedAnnouncements.length / pageSize);
  const paginatedAnnouncements = processedAnnouncements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  function openCreate() {
    setEditing(null);
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days
    setForm({
      ...EMPTY_FORM,
      startDate: formatForDateTimeLocal(now),
      endDate: formatForDateTimeLocal(defaultEnd),
    });
    setValidationError(null);
    setShowModal(true);
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setForm({
      title: item.title,
      message: item.message || "",
      imageUrl: item.imageUrl || "",
      linkUrl: item.linkUrl || "",
      linkLabel: item.linkLabel || "Click here to check more info",
      startDate: formatForDateTimeLocal(item.startDate),
      endDate: formatForDateTimeLocal(item.endDate),
      priority: item.priority ?? 0,
      isHidden: item.isHidden ?? false,
    });
    setValidationError(null);
    setShowModal(true);
  }

  // Lock background scroll while any modal is open
  useEffect(() => {
    if (showModal || deleteConfirm || viewingItem || previewImage) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal, deleteConfirm, viewingItem, previewImage]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPEG, PNG, WebP, GIF)");
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
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const { url } = await res.json();
      setForm((prev) => ({ ...prev, imageUrl: url }));
      toast.success("Image uploaded successfully");
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
    setValidationError(null);

    if (!form.title.trim()) {
      setValidationError("Title is required.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setValidationError("Start and end date & time are required.");
      return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setValidationError("Please enter valid dates.");
      return;
    }

    if (end <= start) {
      setValidationError("End date & time must be strictly after Start date & time.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        priority: Number(form.priority) || 0,
      };

      if (editing) {
        const res = await fetch(`/api/announcements/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to update announcement");
        }
        const data = await res.json();
        setAnnouncements((prev) => prev.map((a) => (a.id === editing.id ? data : a)));
        toast.success("Announcement updated");
      } else {
        const res = await fetch("/api/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create announcement");
        }
        const data = await res.json();
        setAnnouncements((prev) => [data, ...prev]);
        toast.success("Announcement created");
      }
      setShowModal(false);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleHide(item: Announcement) {
    const updatedState = !item.isHidden;

    // Optimistic UI update
    setAnnouncements((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, isHidden: updatedState } : a))
    );

    try {
      const res = await fetch(`/api/announcements/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: updatedState }),
      });

      if (!res.ok) {
        throw new Error("Failed to toggle status");
      }
      toast.success(updatedState ? "Announcement hidden" : "Announcement visible");
      router.refresh();
    } catch {
      // Revert optimistic update
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, isHidden: item.isHidden } : a))
      );
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success("Announcement deleted");
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete announcement");
    }
  }

  function getStatusBadge(item: Announcement) {
    const now = new Date();
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);

    if (item.isHidden) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
          Hidden
        </span>
      );
    }
    if (now < start) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          Scheduled
        </span>
      );
    }
    if (now > end) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Expired
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5 animate-pulse" />
        Active
      </span>
    );
  }

  function formatDateRange(startDateStr: string, endDateStr: string) {
    const s = new Date(startDateStr);
    const e = new Date(endDateStr);
    const format = (d: Date) =>
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    return `${format(s)} – ${format(e)}`;
  }

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          New Announcement
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Total Announcements: <strong className="text-ink dark:text-cream">{announcements.length}</strong>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-1">
          {(["ALL", "ACTIVE", "SCHEDULED", "EXPIRED", "HIDDEN"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${statusFilter === status
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
          {/* Search Input */}
          <div className="relative sm:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, message or link..."
              className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
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
            {/* Sort Dropdown & Toggle */}
            <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
              <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 flex-1 min-w-0 sm:flex-none">
                <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="flex-1 min-w-0 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
                >
                  <option value="priority" className="bg-white dark:bg-ink-900">Priority</option>
                  <option value="title" className="bg-white dark:bg-ink-900">Title</option>
                  <option value="startDate" className="bg-white dark:bg-ink-900">Start Date</option>
                  <option value="endDate" className="bg-white dark:bg-ink-900">End Date</option>
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
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
            <div className="flex items-center justify-center sm:justify-start gap-0.5 rounded-xl admin-input border p-1 col-span-2 sm:w-auto sm:shrink-0">
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

      {/* Announcements List */}
      {processedAnnouncements.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <Megaphone className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-ink dark:text-cream mb-1">
              {announcements.length === 0 ? "No announcements yet" : "No matching announcements"}
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {announcements.length === 0
                ? "Create your first announcement to display popup alerts on the public homepage."
                : "Try adjusting your search query or status filter criteria."}
            </p>
            {announcements.length === 0 ? (
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all"
              >
                <Plus size={16} />
                Create Announcement
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedAnnouncements.map((item) => (
            <div
              key={item.id}
              className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-sm hover:shadow-lg transition-shadow group"
            >
              {/* Banner */}
              <div
                className="relative aspect-[16/9] overflow-hidden cursor-pointer bg-black/5 dark:bg-black/50"
                onClick={() => setViewingItem(item)}
              >
                {item.imageUrl ? (
                  <>
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-ink/80 px-3 py-1.5 rounded-lg">
                        <Eye size={14} /> View Details
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-ink-400 dark:text-ink-300">
                    <Megaphone size={32} />
                  </div>
                )}
                <div className="absolute top-2 right-2 pointer-events-none">
                  {getStatusBadge(item)}
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <h3
                  onClick={() => setViewingItem(item)}
                  className="font-jakarta text-base font-semibold tracking-tight truncate text-ink dark:text-cream cursor-pointer hover:underline"
                >
                  {item.title}
                </h3>
                {item.message && (
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 line-clamp-2 mt-1">
                    {item.message}
                  </p>
                )}
                {item.linkUrl && (
                  <a
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-sepia hover:underline mt-1.5 gap-1"
                  >
                    <LinkIcon size={10} />
                    <span className="truncate max-w-[180px]">{item.linkLabel || item.linkUrl}</span>
                    <ArrowUpRight size={10} />
                  </a>
                )}

                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-ink-400 dark:text-ink-300 min-w-0">
                    <Calendar size={12} className="text-sepia shrink-0" />
                    <span className="truncate">{formatDateRange(item.startDate, item.endDate)}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono shrink-0">
                    P{item.priority}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => setViewingItem(item)}
                    title="View Details"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Eye size={16} />
                  </button>

                  <button
                    onClick={() => handleToggleHide(item)}
                    type="button"
                    title={item.isHidden ? "Make Visible" : "Hide"}
                    className={`p-2 rounded-lg transition-colors ${item.isHidden
                      ? "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                  >
                    {item.isHidden ? <ToggleLeft size={22} /> : <ToggleRight size={22} />}
                  </button>

                  <button
                    onClick={() => openEdit(item)}
                    title="Edit"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => openDeleteConfirm(item.id)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wider font-jakarta bg-black/5 dark:bg-white/5">
                  <th className="py-4 px-6 font-semibold">Preview</th>
                  <th className="py-4 px-6 font-semibold">Title & Details</th>
                  <th className="py-4 px-6 font-semibold">Date Window</th>
                  <th className="py-4 px-6 font-semibold">Priority</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 text-sm text-ink dark:text-cream font-jakarta">
                {paginatedAnnouncements.map((item) => (
                  <tr key={item.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    {/* Thumbnail */}
                    <td className="py-4 px-6 w-24">
                      {item.imageUrl ? (
                        <div
                          onClick={() => setViewingItem(item)}
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                        >
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => setViewingItem(item)}
                          className="w-14 h-14 rounded-lg border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-ink-400 dark:text-ink-300 shrink-0 cursor-pointer"
                        >
                          <Megaphone size={20} />
                        </div>
                      )}
                    </td>

                    {/* Title & Details */}
                    <td className="py-4 px-6 max-w-xs">
                      <div
                        onClick={() => setViewingItem(item)}
                        className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                      >
                        {item.title}
                      </div>
                      {item.message && (
                        <p className="text-xs text-ink-400 dark:text-ink-300 line-clamp-1 mt-0.5">
                          {item.message}
                        </p>
                      )}
                      {item.linkUrl && (
                        <a
                          href={item.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-sepia hover:underline mt-1 gap-1"
                        >
                          <LinkIcon size={10} />
                          <span className="truncate max-w-[180px]">{item.linkLabel || item.linkUrl}</span>
                          <ArrowUpRight size={10} />
                        </a>
                      )}
                    </td>

                    {/* Date Window */}
                    <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300">
                      <div className="flex items-center gap-1.5 text-ink dark:text-cream">
                        <Calendar size={13} className="text-sepia" />
                        <span>{formatDateRange(item.startDate, item.endDate)}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 text-xs text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                        P{item.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">{getStatusBadge(item)}</td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Details */}
                        <button
                          onClick={() => setViewingItem(item)}
                          title="View Details"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Show/Hide Toggle */}
                        <button
                          onClick={() => handleToggleHide(item)}
                          type="button"
                          title={item.isHidden ? "Make Visible" : "Hide"}
                          className={`p-2 rounded-lg transition-colors ${item.isHidden
                            ? "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                        >
                          {item.isHidden ? (
                            <ToggleLeft size={22} />
                          ) : (
                            <ToggleRight size={22} />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openEdit(item)}
                          title="Edit"
                          className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        >
                          <Pencil size={16} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => openDeleteConfirm(item.id)}
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
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
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

      {/* VIEW ANNOUNCEMENT DETAILS MODAL */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">
                  Announcement Details
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
              {/* Banner Preview */}
              <div
                onClick={() =>
                  viewingItem.imageUrl &&
                  setPreviewImage({
                    url: viewingItem.imageUrl,
                    title: viewingItem.title || "Image Preview",
                  })
                }
                className={`relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 ${viewingItem.imageUrl ? "cursor-pointer group" : ""
                  }`}
              >
                {viewingItem.imageUrl ? (
                  <>
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
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-ink-400 dark:text-ink-300 gap-2">
                    <Megaphone size={32} />
                    <p className="text-xs">No banner image set</p>
                  </div>
                )}
              </div>

              {/* Title & Status */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-base font-semibold text-ink dark:text-cream">{viewingItem.title}</h4>
                  <div>{getStatusBadge(viewingItem)}</div>
                </div>
                {viewingItem.message && (
                  <p className="text-sm text-ink-400 dark:text-ink-300 whitespace-pre-wrap bg-black/5 dark:bg-white/5 p-3 rounded-xl mt-2 border border-black/5 dark:border-white/5">
                    {viewingItem.message}
                  </p>
                )}
              </div>

              {/* Details List */}
              <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Priority Score:</span>
                  <span className="font-mono font-medium text-ink dark:text-cream">P{viewingItem.priority}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Date Window:</span>
                  <span className="font-medium text-ink dark:text-cream text-right">
                    {formatDateRange(viewingItem.startDate, viewingItem.endDate)}
                  </span>
                </div>
                {viewingItem.linkUrl && (
                  <div className="flex justify-between py-1">
                    <span className="text-ink-400">Action Link:</span>
                    <a
                      href={viewingItem.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sepia hover:underline truncate max-w-[200px] inline-flex items-center gap-1"
                    >
                      {viewingItem.linkLabel || "View Link"} <ArrowUpRight size={10} />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Buttons - EDIT BUTTON INSIDE VIEW MODAL*/}
              {/* <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
                <button
                  onClick={() => {
                    const item = viewingItem;
                    setViewingItem(null);
                    openEdit(item);
                  }}
                  className="flex-1 py-2 px-4 rounded-xl bg-sepia text-white text-xs font-medium hover:bg-sepia-dark transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={14} /> Edit Announcement
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
                {editing ? "Edit Announcement" : "Create New Announcement"}
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
              id="announcement-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {validationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm font-jakarta">
                  {validationError}
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Title (Internal Label) <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Art Exhibition Announcement"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              {/* Image Upload Area */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Popup Banner Image (Optional)
                </label>
                {form.imageUrl ? (
                  <div className="relative">
                    {/* Image Container with View Full Image Overlay */}
                    <div
                      className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/60 cursor-pointer group"
                      onClick={() =>
                        setPreviewImage({
                          url: form.imageUrl,
                          title: form.title || "Image Preview",
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
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  className="hidden"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  Popup Message / Body Text (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter detailed message to display inside the popup..."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
              </div>

              {/* Link URL & Link Label */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Action Link URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/gallery"
                    value={form.linkUrl}
                    onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Button Text / Label
                  </label>
                  <input
                    type="text"
                    placeholder="Click here to check more info"
                    value={form.linkLabel}
                    onChange={(e) => setForm({ ...form, linkLabel: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Start Date & Time <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <AdminDatePicker
                    withTime
                    required
                    clearable={false}
                    value={form.startDate}
                    onChange={(startDate) => setForm({ ...form, startDate })}
                    className="px-4 py-2.5 text-sm"
                    ariaLabel="Start date and time"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    End Date & Time <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <AdminDatePicker
                    withTime
                    required
                    clearable={false}
                    value={form.endDate}
                    onChange={(endDate) => setForm({ ...form, endDate })}
                    className="px-4 py-2.5 text-sm"
                    ariaLabel="End date and time"
                  />
                </div>
              </div>

              {/* Priority & IsHidden */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Priority Number (Highest shows first)
                  </label>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm font-mono"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isHidden}
                      onChange={(e) => setForm({ ...form, isHidden: e.target.checked })}
                      className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-ink dark:text-cream">Manually Hide Announcement</span>
                  </label>
                </div>
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
                form="announcement-form"
                disabled={loading || uploading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading ? "Saving..." : editing ? "Save Changes" : "Create Announcement"}
              </button>
            </div>
          </div>
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
              />
            </div>
            {previewImage.title && (
              <p className="text-cream font-jakarta text-sm text-center">{previewImage.title}</p>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">Delete Announcement</h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              Are you sure you want to delete this announcement? This action cannot be undone.
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
    </div>
  );
}