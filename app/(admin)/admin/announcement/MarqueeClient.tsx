// app/(admin)/admin/announcement/MarqueeClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ToggleLeft,
  ToggleRight,
  ScrollText,
  Gauge,
  Link as LinkIcon,
  ChevronDown,
} from "lucide-react";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";
import { getErrorMessage } from "@/lib/utils";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";
import {
  MARQUEE_CATEGORIES,
  MARQUEE_DEFAULTS,
  MARQUEE_FONTS,
  MARQUEE_SIZES,
  MARQUEE_SPEEDS,
  MAX_SPEED,
  MIN_SPEED,
  SEPARATORS,
  marqueeStatus,
  type Marquee,
  type MarqueeStatus,
} from "@/lib/marquee";

interface FormState {
  text: string;
  category: string;
  linkUrl: string;
  textColor: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  speed: number;
  separator: string;
  pauseOnHover: boolean;
  isActive: boolean;
  startDate: string;
  endDate: string;
  priority: number;
}

const EMPTY_FORM: FormState = { ...MARQUEE_DEFAULTS };

const ALL = "__ALL__";

function formatForDateTimeLocal(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const STATUS_STYLES: Record<MarqueeStatus, string> = {
  ACTIVE:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  SCHEDULED:
    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  EXPIRED:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  INACTIVE:
    "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
};

function StatusBadge({ status }: { status: MarqueeStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status]}`}
    >
      {status === "ACTIVE" && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5 animate-pulse" />
      )}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/**
 * Renders exactly what the visitor sees, using the same `.marquee-*` rules from
 * globals.css — so what the admin previews is what ships, not an approximation.
 */
function MarqueePreview({
  item,
  className = "",
}: {
  item: Pick<
    Marquee,
    | "text"
    | "textColor"
    | "backgroundColor"
    | "fontSize"
    | "fontFamily"
    | "speed"
    | "separator"
    | "pauseOnHover"
  >;
  className?: string;
}) {
  const text = item.text.trim() || "Your announcement text will appear here…";
  const copies = Math.min(
    12,
    Math.max(2, Math.ceil(80 / Math.max(text.length, 1)))
  );

  const half = (
    <div className="marquee-half">
      {Array.from({ length: copies }, (_, i) => (
        <span key={i} className="marquee-item">
          <span
            className="marquee-text"
            style={{ "--marquee-fs": item.fontSize } as React.CSSProperties}
          >
            {text}
          </span>
          <span className="marquee-sep">{item.separator}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div
      className={`marquee-bar ${className}`}
      data-pause-on-hover={item.pauseOnHover ? "true" : "false"}
      style={{
        backgroundColor: item.backgroundColor,
        color: item.textColor,
        fontFamily: item.fontFamily,
      }}
    >
      <div className="marquee-viewport">
        <div
          className="marquee-track"
          style={{ animationDuration: `${item.speed}s` }}
        >
          {half}
          {half}
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} colour picker`}
          className="h-10 w-12 shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-transparent cursor-pointer p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          aria-label={`${label} hex value`}
          className="w-full px-3 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-mono uppercase"
        />
      </div>
    </div>
  );
}

export function MarqueeClient({
  initialMarquees,
}: {
  initialMarquees: Marquee[];
}) {
  const router = useRouter();
  const [marquees, setMarquees] = useState<Marquee[]>(initialMarquees);

  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Marquee | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // The category <select> flips to a free-text field when the admin picks
  // "New section…", so custom sections stay possible without leaving the modal.
  const [customCategory, setCustomCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Marquee | null>(null);
  function openDeleteConfirm(item: Marquee) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(item);
  }

  // Presets plus anything admins have already typed, so custom sections get a
  // tab of their own without needing a code change.
  const categories = useMemo(() => {
    const seen = new Set<string>(MARQUEE_CATEGORIES);
    marquees.forEach((m) => seen.add(m.category));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [marquees]);

  const countFor = (category: string) =>
    category === ALL
      ? marquees.length
      : marquees.filter((m) => m.category === category).length;

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return marquees.filter((m) => {
      if (activeCategory !== ALL && m.category !== activeCategory) return false;
      if (!q) return true;
      return (
        m.text.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.linkUrl ?? "").toLowerCase().includes(q)
      );
    });
  }, [marquees, activeCategory, searchQuery]);

  useEffect(() => {
    if (showModal || deleteConfirm) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal, deleteConfirm]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      category:
        activeCategory === ALL ? MARQUEE_DEFAULTS.category : activeCategory,
    });
    setCustomCategory(false);
    setValidationError(null);
    setShowModal(true);
  }

  function openEdit(item: Marquee) {
    setEditing(item);
    setCustomCategory(!categories.includes(item.category));
    setForm({
      text: item.text,
      category: item.category,
      linkUrl: item.linkUrl ?? "",
      textColor: item.textColor,
      backgroundColor: item.backgroundColor,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      speed: item.speed,
      separator: item.separator,
      pauseOnHover: item.pauseOnHover,
      isActive: item.isActive,
      startDate: formatForDateTimeLocal(item.startDate),
      endDate: formatForDateTimeLocal(item.endDate),
      priority: item.priority,
    });
    setValidationError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError(null);

    if (!form.text.trim()) {
      setValidationError("Marquee text is required.");
      return;
    }
    if (
      form.startDate &&
      form.endDate &&
      new Date(form.endDate) <= new Date(form.startDate)
    ) {
      setValidationError("End date & time must be after start date & time.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 0,
        speed: Number(form.speed),
        startDate: form.startDate
          ? new Date(form.startDate).toISOString()
          : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };

      const res = await fetch(
        editing ? `/api/marquees/${editing.id}` : "/api/marquees",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save marquee");
      }
      const saved: Marquee = await res.json();

      setMarquees((prev) =>
        editing
          ? prev.map((m) => (m.id === editing.id ? saved : m))
          : [saved, ...prev]
      );
      toast.success(editing ? "Marquee updated" : "Marquee created");
      setShowModal(false);
      router.refresh();
    } catch (err) {
      const message = getErrorMessage(err, "Something went wrong");
      setValidationError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(item: Marquee) {
    const next = !item.isActive;
    setMarquees((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, isActive: next } : m))
    );

    try {
      const res = await fetch(`/api/marquees/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next ? "Marquee is now live" : "Marquee deactivated");
      router.refresh();
    } catch {
      setMarquees((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, isActive: item.isActive } : m
        )
      );
      toast.error("Failed to update status");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/marquees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setMarquees((prev) => prev.filter((m) => m.id !== id));
      toast.success("Marquee moved to trash");
      setDeleteConfirm(null);
      router.refresh();
    } catch {
      toast.error("Failed to delete marquee");
    }
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
          New Marquee
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Live right now:{" "}
          <strong className="text-ink dark:text-cream">
            {marquees.filter((m) => marqueeStatus(m) === "ACTIVE").length}
          </strong>{" "}
          of {marquees.length}
        </div>
      </div>

      {/* Category tabs + search */}
      <div className="admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        <div className="flex flex-wrap gap-1">
          {[ALL, ...categories].map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
                activeCategory === category
                  ? "bg-sepia text-white border-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
            >
              {category === ALL ? "All" : category}
              <span className="ml-1.5 opacity-60 tabular-nums">
                {countFor(category)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative flex-1 lg:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search marquee text or link..."
            className="w-full pl-8 pr-8 py-1.5 font-body text-xs rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="admin-card border rounded-2xl p-12 text-center backdrop-blur-md shadow-xl">
          <ScrollText className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-ink dark:text-cream mb-1">
            {marquees.length === 0
              ? "No marquee banners yet"
              : "No matching marquees"}
          </h3>
          <p className="text-sm text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
            {marquees.length === 0
              ? "Create a scrolling ticker to run across the top of every public page."
              : "Try a different category or clear your search."}
          </p>
          {marquees.length === 0 ? (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all"
            >
              <Plus size={16} /> Create Marquee
            </button>
          ) : (
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory(ALL);
              }}
              className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <div
              key={item.id}
              className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-sm hover:shadow-lg transition-shadow"
            >
              {/* The row leads with the banner itself — the fastest way to tell
                  two announcements apart at a glance. */}
              <MarqueePreview item={item} />

              <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <StatusBadge status={marqueeStatus(item)} />
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[10px] text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10 font-mono">
                      P{item.priority}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-ink-400 dark:text-ink-300 font-mono">
                      <Gauge size={11} /> {item.speed}s
                    </span>
                  </div>

                  <p className="font-jakarta text-sm text-ink dark:text-cream truncate">
                    {item.text}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-400 dark:text-ink-300">
                    <span>
                      {item.startDate || item.endDate
                        ? `${
                            item.startDate
                              ? new Date(item.startDate).toLocaleString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  }
                                )
                              : "Always"
                          } – ${
                            item.endDate
                              ? new Date(item.endDate).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "No end"
                          }`
                        : "No schedule — runs whenever active"}
                    </span>
                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sepia hover:underline truncate max-w-[200px]"
                      >
                        <LinkIcon size={10} />
                        {item.linkUrl}
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(item)}
                    type="button"
                    title={item.isActive ? "Deactivate" : "Activate"}
                    aria-label={
                      item.isActive ? "Deactivate marquee" : "Activate marquee"
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      item.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                    }`}
                  >
                    {item.isActive ? (
                      <ToggleRight size={22} />
                    ) : (
                      <ToggleLeft size={22} />
                    )}
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    title="Edit"
                    aria-label="Edit marquee"
                    className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => openDeleteConfirm(item)}
                    title="Delete"
                    aria-label="Delete marquee"
                    className="p-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-3xl sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit Marquee" : "Create New Marquee"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Live preview, pinned under the header so it stays in view while
                the controls below are scrolled. */}
            <div className="px-6 pt-5 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                Live Preview
              </p>
              <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/15">
                <MarqueePreview item={form} />
              </div>
            </div>

            <form
              id="marquee-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {validationError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm font-jakarta">
                  {validationError}
                </div>
              )}

              {/* Text */}
              <div>
                <label
                  htmlFor="marquee-text"
                  className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                >
                  Marquee Text{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <textarea
                  id="marquee-text"
                  rows={2}
                  required
                  maxLength={500}
                  placeholder="e.g. Free shipping on all prints until Sunday!"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
                />
                <p className="text-[10px] text-ink-400 mt-1 text-right font-mono">
                  {form.text.length}/500
                </p>
              </div>

              {/* Category + link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="marquee-category"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Category / Section
                  </label>
                  {customCategory ? (
                    <input
                      id="marquee-category"
                      autoFocus
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                      placeholder="e.g. Product Promo"
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                    />
                  ) : (
                    <div className="relative">
                      <select
                        id="marquee-category"
                        value={form.category}
                        onChange={(e) => {
                          if (e.target.value === "__new__") {
                            setCustomCategory(true);
                            setForm({ ...form, category: "" });
                          } else {
                            setForm({ ...form, category: e.target.value });
                          }
                        }}
                        className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                      >
                        {categories.map((c) => (
                          <option
                            key={c}
                            value={c}
                            className="bg-white dark:bg-ink-900"
                          >
                            {c}
                          </option>
                        ))}
                        <option
                          value="__new__"
                          className="bg-white dark:bg-ink-900"
                        >
                          ＋ New section…
                        </option>
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                      />
                    </div>
                  )}
                  {customCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCategory(false);
                        setForm({ ...form, category: MARQUEE_DEFAULTS.category });
                      }}
                      className="mt-1.5 text-[10px] text-sepia hover:underline"
                    >
                      ← Back to existing sections
                    </button>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="marquee-link"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Click-through Link (Optional)
                  </label>
                  <input
                    id="marquee-link"
                    type="text"
                    placeholder="/shop or https://example.com"
                    value={form.linkUrl}
                    onChange={(e) =>
                      setForm({ ...form, linkUrl: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Colours */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ColorField
                  label="Text Colour"
                  value={form.textColor}
                  onChange={(v) => setForm({ ...form, textColor: v })}
                />
                <ColorField
                  label="Background Colour"
                  value={form.backgroundColor}
                  onChange={(v) => setForm({ ...form, backgroundColor: v })}
                />
              </div>

              {/* Typography */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="marquee-font"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Font Family
                  </label>
                  <div className="relative">
                    <select
                      id="marquee-font"
                      value={form.fontFamily}
                      onChange={(e) =>
                        setForm({ ...form, fontFamily: e.target.value })
                      }
                      className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                    >
                      {MARQUEE_FONTS.map((f) => (
                        <option
                          key={f.css}
                          value={f.css}
                          className="bg-white dark:bg-ink-900"
                        >
                          {f.label}
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
                  <label
                    htmlFor="marquee-size"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Font Size
                  </label>
                  <div className="relative">
                    <select
                      id="marquee-size"
                      value={form.fontSize}
                      onChange={(e) =>
                        setForm({ ...form, fontSize: e.target.value })
                      }
                      className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                    >
                      {MARQUEE_SIZES.map((s) => (
                        <option
                          key={s.css}
                          value={s.css}
                          className="bg-white dark:bg-ink-900"
                        >
                          {s.label} ({s.css})
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
                  <label
                    htmlFor="marquee-separator"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Separator
                  </label>
                  <div className="relative">
                    <select
                      id="marquee-separator"
                      value={form.separator}
                      onChange={(e) =>
                        setForm({ ...form, separator: e.target.value })
                      }
                      className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
                    >
                      {SEPARATORS.map((s) => (
                        <option
                          key={s}
                          value={s}
                          className="bg-white dark:bg-ink-900"
                        >
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                    />
                  </div>
                </div>
              </div>

              {/* Speed */}
              <div>
                <label
                  htmlFor="marquee-speed"
                  className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                >
                  Scroll Speed —{" "}
                  <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                    {form.speed}s per loop
                  </span>
                </label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    id="marquee-speed"
                    type="range"
                    min={MIN_SPEED}
                    max={MAX_SPEED}
                    value={form.speed}
                    onChange={(e) =>
                      setForm({ ...form, speed: Number(e.target.value) })
                    }
                    className="flex-1 accent-sepia cursor-pointer"
                  />
                  <div className="flex gap-1 shrink-0">
                    {MARQUEE_SPEEDS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, speed: preset.value })
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                          form.speed === preset.value
                            ? "bg-sepia text-white border-sepia font-medium"
                            : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-ink-400 mt-1.5">
                  Lower is faster. A longer message needs more seconds to stay
                  readable.
                </p>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="marquee-start"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Start Date & Time (Optional)
                  </label>
                  <AdminDatePicker
                    id="marquee-start"
                    withTime
                    value={form.startDate}
                    onChange={(startDate) => setForm({ ...form, startDate })}
                    placeholder="No start bound"
                    className="px-4 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="marquee-end"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    End Date & Time (Optional)
                  </label>
                  <AdminDatePicker
                    id="marquee-end"
                    withTime
                    value={form.endDate}
                    onChange={(endDate) => setForm({ ...form, endDate })}
                    placeholder="No end bound"
                    className="px-4 py-2.5 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-ink-400 -mt-3">
                Leave a date blank for no bound — an active marquee with no
                dates runs continuously.
              </p>

              {/* Priority & switches */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div>
                  <label
                    htmlFor="marquee-priority"
                    className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
                  >
                    Priority (Highest on top)
                  </label>
                  <input
                    id="marquee-priority"
                    type="number"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        priority: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm font-mono"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.pauseOnHover}
                      onChange={(e) =>
                        setForm({ ...form, pauseOnHover: e.target.checked })
                      }
                      className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-ink dark:text-cream">
                      Pause on hover
                    </span>
                  </label>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm({ ...form, isActive: e.target.checked })
                      }
                      className="w-5 h-5 rounded bg-black/10 dark:bg-white/10 border-black/20 dark:border-white/20 text-sepia focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm font-medium text-ink dark:text-cream">
                      Active
                    </span>
                  </label>
                </div>
              </div>
            </form>

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
                form="marquee-form"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Marquee"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">
              Delete Marquee
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-6">
              &ldquo;{deleteConfirm.text.slice(0, 80)}
              {deleteConfirm.text.length > 80 ? "…" : ""}&rdquo; will be moved
              to the Trash, where you can restore it later.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
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
