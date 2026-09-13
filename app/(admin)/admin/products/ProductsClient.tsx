// app/(admin)/admin/products/ProductsClient.tsx
"use client";

import { useState, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "@/components/ui/SafeImage";
import {
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  X,
  ToggleLeft,
  ToggleRight,
  Search,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  LayoutGrid,
  List,
  ZoomIn,
  Package,
  Ruler,
  Star,
  Sparkles,
} from "lucide-react";
import { formatPrice, formatPriceRange } from "@/lib/utils";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";
import toast from "@/lib/toast";
import { playSoundEffect } from "@/lib/sound/engine";

interface ProductVariant {
  id: string;
  label: string;
  price: number;
  stock: number;
}

// Draft row while editing in the modal — string-typed inputs like the rest
// of this form (price/stock), plus an id only once persisted.
interface VariantDraft {
  id?: string;
  label: string;
  price: string;
  stock: string;
}

interface Product {
  id: string;
  price: number;
  stock: number;
  available: boolean;
  createdAt?: Date | string;
  variants: ProductVariant[];
  artwork: {
    id: string;
    title: string;
    imageUrl: string;
    medium: string | null;
    featured: boolean;
    isNewRelease: boolean;
    published: boolean;
  };
}

// Lowest/highest variant price, for the "₱X–₱Y" range display when a product
// has sizes; falls back to the flat price otherwise. The logic itself lives
// in lib/utils now — the museum's Services Room wall and info panel need the
// exact same answer, and two copies of "what does this product cost" is
// precisely the thing that drifts.
function priceRange(product: Product): string {
  return formatPriceRange(product.price, product.variants.map((v) => v.price));
}

function totalStock(product: Product): number {
  return product.variants.length > 0
    ? product.variants.reduce((sum, v) => sum + v.stock, 0)
    : product.stock;
}

// ── Price input formatting ──────────────────────────────────────────────────
// A peso figure with no separators ("30000000") is genuinely hard to read back,
// so the price fields group thousands as you type. Only the *display* is
// grouped: form state stays the bare numeric string these fields always held,
// so parseFloat(form.price) at submit time is unchanged and the API sees the
// same payload as before.

/** Everything a price can legally contain: digits, one decimal point, at most
 * two decimal places. Anything else the field receives is dropped rather than
 * rejected, so pasting "₱1,000.00" or "1 000" lands as "1000.00". A leading
 * "-" is stripped too, which is what replaced the old type="number" min="0". */
function toRawPrice(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const whole = cleaned.slice(0, firstDot);
  const fraction = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return `${whole}.${fraction}`;
}

/** "1000000" → "1,000,000". Only the whole part is grouped; the decimals ride
 * along untouched, and a trailing "." mid-typing is preserved so the field
 * doesn't fight someone who's about to type cents. */
function groupThousands(raw: string): string {
  if (!raw) return "";
  const [whole, fraction] = raw.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return raw.includes(".") ? `${grouped}.${fraction ?? ""}` : grouped;
}

/**
 * Text input that shows a comma-grouped price while reporting the raw numeric
 * string to its parent.
 *
 * The caret bookkeeping is the whole reason this is a component rather than an
 * inline onChange: re-formatting on every keystroke changes the string's
 * length, and a controlled input re-render would otherwise drop the caret at
 * the end — fine while typing a fresh number, maddening while correcting a
 * digit in the middle of one. So the handler counts how many *significant*
 * characters (digits and the dot; commas are decoration) sit before the caret,
 * then puts the caret back after that same count in the reformatted string.
 *
 * type="text" rather than type="number" because a number input rejects commas
 * outright — it would show nothing at all. inputMode="decimal" keeps the
 * numeric keypad on phones, and toRawPrice above enforces what min/step used to.
 */
function PriceInput({
  value,
  onChange,
  className,
  placeholder,
  required,
}: {
  /** Raw numeric string, e.g. "1000000.50". */
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  // Runs before paint, so the caret never visibly lands in the wrong spot.
  // Safe on the server: this only mounts inside the product modal, which is
  // gated behind a state flag that starts false.
  useLayoutEffect(() => {
    if (caretRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const typed = e.target.value;
    const caret = e.target.selectionStart ?? typed.length;
    const significantBefore = typed.slice(0, caret).replace(/[^\d.]/g, "").length;

    const raw = toRawPrice(typed);
    const formatted = groupThousands(raw);

    let seen = 0;
    let nextCaret = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (seen >= significantBefore) {
        nextCaret = i;
        break;
      }
      if (formatted[i] !== ",") seen++;
    }
    caretRef.current = nextCaret;
    onChange(raw);
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      required={required}
      placeholder={placeholder}
      value={groupThousands(value)}
      onChange={handleChange}
      className={className}
    />
  );
}

interface Artwork {
  id: string;
  title: string;
  imageUrl: string;
}

interface ProductForm {
  artworkId: string;
  price: string;
  stock: string;
}

type FilterStatus = "ALL" | "LIVE" | "HIDDEN" | "OUT_OF_STOCK";
type SortOption =
  | "date"
  | "title"
  | "price"
  | "stock"
  | "featured"
  | "newRelease"
  | "draft";
type SortOrder = "asc" | "desc";
type ViewMode = "list" | "grid";

export function ProductsClient({
  initialProducts,
  artworksWithoutProduct,
}: {
  initialProducts: Product[];
  artworksWithoutProduct: Artwork[];
}) {
  const queryClient = useQueryClient();
  const PRODUCTS_KEY = ["admin-products"] as const;

  // Cached client-side, seeded with the server-fetched list so there's no
  // loading flash — refetches on window focus / staleness like the rest of
  // the admin panel now does.
  const { data: products = initialProducts } = useQuery<Product[]>({
    queryKey: PRODUCTS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    initialData: initialProducts,
  });

  const [availableArtworks, setAvailableArtworks] = useState(
    artworksWithoutProduct
  );
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  function openDeleteConfirm(id: string) {
    playSoundEffect("admin.deleteConfirm");
    setDeleteConfirm(id);
  }
  const [form, setForm] = useState({ artworkId: "", price: "", stock: "1" });
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);

  // Artwork select dropdown (custom, shows thumbnails) state
  const [artworkDropdownOpen, setArtworkDropdownOpen] = useState(false);
  // Type-to-filter inside that dropdown. The list is every artwork that
  // doesn't have a product yet, which on a stocked library is long enough
  // that scrolling to find one by eye stops being reasonable — so this is a
  // combobox, not a plain picker. Cleared whenever the dropdown closes (see
  // closeArtworkDropdown) so reopening it always starts from the full list.
  const [artworkSearch, setArtworkSearch] = useState("");
  const artworkDropdownRef = useRef<HTMLDivElement>(null);
  const artworkSearchRef = useRef<HTMLInputElement>(null);
  const selectedArtwork = useMemo(
    () => availableArtworks.find((a) => a.id === form.artworkId) ?? null,
    [availableArtworks, form.artworkId]
  );
  const filteredArtworks = useMemo(() => {
    const query = artworkSearch.trim().toLowerCase();
    if (!query) return availableArtworks;
    return availableArtworks.filter((a) => a.title.toLowerCase().includes(query));
  }, [availableArtworks, artworkSearch]);

  function closeArtworkDropdown() {
    setArtworkDropdownOpen(false);
    setArtworkSearch("");
  }

  // Filter & Search & Sort States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Tag Filters — independent toggles pulled from the linked artwork, same
  // pattern as the Artworks module (a product can be both Featured and a
  // New Release at once, and "Draft" here means the artwork isn't published
  // yet, distinct from the product-level LIVE/HIDDEN availability above)
  const [featuredFilter, setFeaturedFilter] = useState(false);
  const [newReleaseFilter, setNewReleaseFilter] = useState(false);
  const [draftFilter, setDraftFilter] = useState(false);

  // View Mode State (table rows vs. grid cards)
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Full Image View Lightbox State
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // Lock background scroll while any modal is open
  useEffect(() => {
    if (showModal || deleteConfirm || viewingProduct || previewImage) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [showModal, deleteConfirm, viewingProduct, previewImage]);

  // Close the artwork dropdown when clicking outside of it
  useEffect(() => {
    if (!artworkDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        artworkDropdownRef.current &&
        !artworkDropdownRef.current.contains(e.target as Node)
      ) {
        setArtworkDropdownOpen(false);
        setArtworkSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [artworkDropdownOpen]);

  // Focus the filter box the moment the dropdown opens, so opening it and
  // typing a title is one gesture instead of open-then-click-then-type.
  // Not autoFocus on the input itself: it's conditionally mounted inside a
  // modal that's also grabbing focus, and this runs after both have settled.
  useEffect(() => {
    if (artworkDropdownOpen) artworkSearchRef.current?.focus();
  }, [artworkDropdownOpen]);

  function openCreate() {
    setEditing(null);
    setForm({ artworkId: "", price: "", stock: "1" });
    setVariantDrafts([]);
    closeArtworkDropdown();
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      artworkId: product.artwork.id,
      price: product.price.toString(),
      stock: product.stock.toString(),
    });
    setVariantDrafts(
      product.variants.map((v) => ({
        id: v.id,
        label: v.label,
        price: v.price.toString(),
        stock: v.stock.toString(),
      }))
    );
    setShowModal(true);
  }

  function addVariantDraft() {
    setVariantDrafts((prev) => [...prev, { label: "", price: "", stock: "1" }]);
  }

  function updateVariantDraft(index: number, patch: Partial<VariantDraft>) {
    setVariantDrafts((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v))
    );
  }

  function removeVariantDraft(index: number) {
    setVariantDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  // Create/update share one mutation since they share a form and a modal —
  // the branch on `editing` decides the endpoint, same as before.
  const saveMutation = useMutation({
    mutationFn: async ({
      editing,
      form,
      variants,
    }: {
      editing: Product | null;
      form: ProductForm;
      variants: VariantDraft[];
    }) => {
      if (editing) {
        const res = await fetch(`/api/products/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            price: parseFloat(form.price),
            stock: parseInt(form.stock),
            variants,
          }),
        });
        if (!res.ok) throw new Error();
        return { type: "update" as const, product: (await res.json()) as Product };
      }
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: form.artworkId,
          price: parseFloat(form.price),
          stock: parseInt(form.stock),
          variants,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      return { type: "create" as const, product: (await res.json()) as Product };
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Product[]>(PRODUCTS_KEY, (old = []) =>
        result.type === "update"
          ? old.map((p) => (p.id === result.product.id ? result.product : p))
          : [result.product, ...old]
      );
      if (result.type === "create") {
        setAvailableArtworks((prev) =>
          prev.filter((a) => a.id !== result.product.artwork.id)
        );
      }
      toast.success(result.type === "update" ? "Product updated" : "Product created");
      setShowModal(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save product");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Blank rows (no label typed yet) are dropped rather than sent — the
    // API filters these too, but skipping them here keeps optimistic state
    // in sync with what actually gets persisted.
    const variants = variantDrafts.filter((v) => v.label.trim());
    saveMutation.mutate({ editing, form, variants });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      return id;
    },
    onSuccess: (id) => {
      const product = products.find((p) => p.id === id);
      queryClient.setQueryData<Product[]>(PRODUCTS_KEY, (old = []) =>
        old.filter((p) => p.id !== id)
      );
      if (product) {
        setAvailableArtworks((prev) => [
          ...prev,
          {
            id: product.artwork.id,
            title: product.artwork.title,
            imageUrl: product.artwork.imageUrl,
          },
        ]);
      }
      setDeleteConfirm(null);
      toast.success("Product removed");
    },
    onError: () => {
      toast.error("Failed to delete");
    },
  });

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  const toggleMutation = useMutation({
    mutationFn: async (product: Product) => {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ available: !product.available }),
      });
      if (!res.ok) throw new Error();
      return (await res.json()) as Product;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Product[]>(PRODUCTS_KEY, (old = []) =>
        old.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success(updated.available ? "Listed in shop" : "Hidden from shop");
    },
    onError: () => {
      toast.error("Failed to update");
    },
  });

  function toggleAvailable(product: Product) {
    toggleMutation.mutate(product);
  }

  // Filter, Search, and Sort Logic
  const processedProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (statusFilter === "LIVE" && !p.available) return false;
        if (statusFilter === "HIDDEN" && p.available) return false;
        if (statusFilter === "OUT_OF_STOCK" && totalStock(p) > 0) return false;

        if (featuredFilter && !p.artwork.featured) return false;
        if (newReleaseFilter && !p.artwork.isNewRelease) return false;
        if (draftFilter && p.artwork.published) return false;

        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase();
          const titleMatch = p.artwork.title.toLowerCase().includes(q);
          const mediumMatch =
            p.artwork.medium?.toLowerCase().includes(q) ?? false;
          return titleMatch || mediumMatch;
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "title":
            comparison = a.artwork.title.localeCompare(b.artwork.title);
            break;
          case "price":
            comparison = a.price - b.price;
            break;
          case "stock":
            comparison = totalStock(a) - totalStock(b);
            break;
          case "featured":
            comparison = Number(b.artwork.featured) - Number(a.artwork.featured);
            if (comparison === 0)
              comparison = a.artwork.title.localeCompare(b.artwork.title);
            break;
          case "newRelease":
            comparison =
              Number(b.artwork.isNewRelease) - Number(a.artwork.isNewRelease);
            if (comparison === 0)
              comparison = a.artwork.title.localeCompare(b.artwork.title);
            break;
          case "draft":
            comparison = Number(a.artwork.published) - Number(b.artwork.published);
            if (comparison === 0)
              comparison = a.artwork.title.localeCompare(b.artwork.title);
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
    products,
    statusFilter,
    featuredFilter,
    newReleaseFilter,
    draftFilter,
    searchQuery,
    sortBy,
    sortOrder,
  ]);

  // Pagination Logic
  const totalPages = Math.ceil(processedProducts.length / pageSize);
  const paginatedProducts = processedProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Counts for tabs
  const counts = {
    ALL: products.length,
    LIVE: products.filter((p) => p.available).length,
    HIDDEN: products.filter((p) => !p.available).length,
    OUT_OF_STOCK: products.filter((p) => totalStock(p) === 0).length,
  };

  function getStatusBadge(product: Product) {
    if (totalStock(product) === 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Out of Stock
        </span>
      );
    }
    if (!product.available) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20">
          Hidden
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mr-1.5 animate-pulse" />
        Live
      </span>
    );
  }

  return (
    <>
      {/* Top Bar: Add Product */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto"
        >
          <Plus size={18} />
          Add Product
        </button>

        <div className="font-body text-xs text-ink-400 dark:text-ink-300 mb-6">
          Total Products:{" "}
          <strong className="text-ink dark:text-cream">
            {products.length}
          </strong>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { label: "ALL", key: "ALL" },
              { label: "LIVE", key: "LIVE" },
              { label: "HIDDEN", key: "HIDDEN" },
              { label: "OUT OF STOCK", key: "OUT_OF_STOCK" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
                statusFilter === tab.key
                  ? "bg-sepia text-white border-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}

          {/* Tag Filters — from the linked artwork, independent of the
              product-level status tabs above */}
          <span className="w-px h-4 bg-black/10 dark:bg-white/10 mx-1" />
          <button
            onClick={() => {
              setFeaturedFilter((v) => !v);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
              featuredFilter
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            <Star size={10} className={featuredFilter ? "fill-current" : ""} />
            Featured
          </button>
          <button
            onClick={() => {
              setNewReleaseFilter((v) => !v);
              setCurrentPage(1);
            }}
            className={`inline-flex items-center gap-1 font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
              newReleaseFilter
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            <Sparkles size={10} className={newReleaseFilter ? "fill-current" : ""} />
            New
          </button>
          <button
            onClick={() => {
              setDraftFilter((v) => !v);
              setCurrentPage(1);
            }}
            className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
              draftFilter
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            Draft
          </button>
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
              placeholder="Search artwork or medium..."
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
            {/* Sort Group */}
            <div className="flex items-center gap-1 w-full sm:w-auto sm:shrink-0">
              <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 flex-1 min-w-0 sm:flex-none">
                <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => {
                    const next = e.target.value as SortOption;
                    setSortBy(next);
                    // Tagged-first is the useful default for these — flip to
                    // ascending so switching into them doesn't silently bury
                    // Featured/New/Draft items under the untagged pile if the
                    // toggle was left on "desc" from a prior sort.
                    if (
                      next === "featured" ||
                      next === "newRelease" ||
                      next === "draft"
                    ) {
                      setSortOrder("asc");
                    }
                  }}
                  className="flex-1 min-w-0 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
                >
                  <option value="date" className="bg-white dark:bg-ink-900">
                    Date Added
                  </option>
                  <option value="title" className="bg-white dark:bg-ink-900">
                    Artwork Title
                  </option>
                  <option value="price" className="bg-white dark:bg-ink-900">
                    Price
                  </option>
                  <option value="stock" className="bg-white dark:bg-ink-900">
                    Stock
                  </option>
                  <option value="featured" className="bg-white dark:bg-ink-900">
                    Featured
                  </option>
                  <option value="newRelease" className="bg-white dark:bg-ink-900">
                    New Release
                  </option>
                  <option value="draft" className="bg-white dark:bg-ink-900">
                    Draft
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
            <div className="flex items-center justify-center sm:justify-start gap-0.5 rounded-xl admin-input border p-1 col-span-2 sm:w-auto sm:shrink-0">
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

      {availableArtworks.length === 0 && products.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-ink-900 border border-dashed border-ink-200 dark:border-ink-600">
          <p className="font-body text-sm text-ink-400 dark:text-ink-300 px-4">
            No artworks available to list. Create artworks first.
          </p>
        </div>
      )}

      {/* Products List (Table) / Grid */}
      {viewMode === "grid" ? (
        processedProducts.length === 0 ? (
          products.length > 0 && (
            <div className="py-16 text-center bg-white dark:bg-ink-900 border border-dashed border-ink-200 dark:border-ink-600">
              <p className="font-body text-sm text-ink-400 dark:text-ink-300 italic">
                No products matching your search/filter criteria.
              </p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedProducts.map((product) => (
              <div
                key={product.id}
                className="admin-modal border flex flex-col"
              >
                {/* Thumbnail */}
                <div
                  className="relative w-full aspect-[4/3] bg-ink-50 dark:bg-ink-800 cursor-pointer group overflow-hidden"
                  onClick={() =>
                    setPreviewImage({
                      url: product.artwork.imageUrl,
                      title: product.artwork.title,
                    })
                  }
                >
                  <Image
                    src={product.artwork.imageUrl}
                    alt={product.artwork.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                      <ZoomIn size={14} /> View Full Image
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col flex-1">
                  <p
                    onClick={() => setViewingProduct(product)}
                    className="font-jakarta text-base font-semibold tracking-tight truncate text-sepia dark:text-cream cursor-pointer hover:underline"
                  >
                    {product.artwork.title}
                  </p>
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 uppercase tracking-wider mt-0.5">
                    {product.artwork.medium || "—"}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <p className="font-jakarta text-lg font-bold tabular-nums tracking-tight text-ink dark:text-cream">
                        {priceRange(product)}
                      </p>
                      <p className="font-jakarta text-[10px] text-ink-400 dark:text-ink-300 uppercase tracking-widest mt-0.5">
                        {totalStock(product)} in stock
                        {product.variants.length > 0 &&
                          ` · ${product.variants.length} size${product.variants.length !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-black/5 dark:border-white/5">
                    <button
                      onClick={() => setViewingProduct(product)}
                      title="View Details"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      onClick={() => toggleAvailable(product)}
                      type="button"
                      title={product.available ? "Hide" : "Make Visible"}
                      className={`p-2 rounded-lg transition-colors ${
                        product.available
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                      }`}
                    >
                      {product.available ? (
                        <ToggleRight size={22} />
                      ) : (
                        <ToggleLeft size={22} />
                      )}
                    </button>

                    <button
                      onClick={() => openEdit(product)}
                      title="Edit"
                      className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      onClick={() => openDeleteConfirm(product.id)}
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
        )
      ) : (
        /* Products Table (List view) */
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          {processedProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-ink dark:text-cream mb-1">
                {products.length === 0
                  ? "No products yet"
                  : "No matching products"}
              </h3>
              <p className="text-sm text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
                {products.length === 0
                  ? "List an artwork as a product to make it available in the shop."
                  : "Try adjusting your search query or status filter criteria."}
              </p>
              {products.length === 0 ? (
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all"
                >
                  <Plus size={16} />
                  Add Product
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setFeaturedFilter(false);
                    setNewReleaseFilter(false);
                    setDraftFilter(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-all font-medium"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="py-4 px-6 w-24">
                        <div
                          onClick={() =>
                            setPreviewImage({
                              url: product.artwork.imageUrl,
                              title: product.artwork.title,
                            })
                          }
                          className="relative w-14 h-14 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 cursor-pointer group"
                        >
                          <Image
                            src={product.artwork.imageUrl}
                            alt={product.artwork.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      </td>

                      {/* Title & Details */}
                      <td className="py-4 px-6 max-w-xs">
                        <div
                          onClick={() => setViewingProduct(product)}
                          className="font-semibold text-ink dark:text-cream truncate cursor-pointer hover:underline"
                        >
                          {product.artwork.title}
                        </div>
                        <p className="text-xs text-ink-400 dark:text-ink-300 uppercase tracking-wider mt-0.5">
                          {product.artwork.medium || "—"}
                        </p>
                      </td>

                      {/* Order (Price & Stock) */}
                      <td className="py-4 px-6 text-xs text-ink-400 dark:text-ink-300">
                        <div className="font-jakarta text-lg font-bold tabular-nums text-ink dark:text-cream">
                          {priceRange(product)}
                        </div>
                        <div className="mt-0.5">
                          {totalStock(product)} in stock
                          {product.variants.length > 0 &&
                            ` · ${product.variants.length} size${product.variants.length !== 1 ? "s" : ""}`}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">{getStatusBadge(product)}</td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Details */}
                          <button
                            onClick={() => setViewingProduct(product)}
                            title="View Details"
                            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Show/Hide Toggle */}
                          <button
                            onClick={() => toggleAvailable(product)}
                            type="button"
                            title={product.available ? "Hide" : "Make Visible"}
                            className={`p-2 rounded-lg transition-colors ${
                              product.available
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-black/5 dark:bg-white/5 text-ink-300 dark:text-ink-600 hover:bg-black/10 dark:hover:bg-white/10"
                            }`}
                          >
                            {product.available ? (
                              <ToggleRight size={22} />
                            ) : (
                              <ToggleLeft size={22} />
                            )}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEdit(product)}
                            title="Edit"
                            className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                          >
                            <Pencil size={16} />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => openDeleteConfirm(product.id)}
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
          )}
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

      {/* VIEW PRODUCT DETAILS MODAL */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              <div>
                <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream">
                  Product Details
                </h3>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  ID: {viewingProduct.id}
                </p>
              </div>
              <button
                onClick={() => setViewingProduct(null)}
                className="p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 font-jakarta">
              {/* Product Artwork Image */}
              <div
                onClick={() =>
                  setPreviewImage({
                    url: viewingProduct.artwork.imageUrl,
                    title: viewingProduct.artwork.title || "Image Preview",
                  })
                }
                className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 cursor-pointer group"
              >
                <Image
                  src={viewingProduct.artwork.imageUrl}
                  alt={viewingProduct.artwork.title}
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
                  <h4 className="text-base font-semibold text-ink dark:text-cream">
                    {viewingProduct.artwork.title}
                  </h4>
                  <div>{getStatusBadge(viewingProduct)}</div>
                </div>
                <p className="text-xs text-ink-400 dark:text-ink-300 uppercase tracking-wider">
                  {viewingProduct.artwork.medium || "—"}
                </p>
              </div>

              {/* Details List */}
              <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Base Price:</span>
                  <span className="font-jakarta font-medium text-ink dark:text-cream">
                    {formatPrice(viewingProduct.price)}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-400">Base Stock:</span>
                  <span className="font-medium text-ink dark:text-cream">
                    {viewingProduct.stock} pcs
                  </span>
                </div>
              </div>

              {/* Variants List */}
              {viewingProduct.variants.length > 0 && (
                <div className="space-y-2 text-xs border-t border-black/10 dark:border-white/10 pt-3">
                  <p className="flex items-center gap-1.5 text-ink-400 uppercase tracking-wider mb-1">
                    <Ruler size={12} /> Sizes
                  </p>
                  {viewingProduct.variants.map((v) => (
                    <div key={v.id} className="flex justify-between py-1">
                      <span className="text-ink dark:text-cream">{v.label}</span>
                      <span className="font-jakarta font-medium text-ink dark:text-cream">
                        {formatPrice(v.price)} · {v.stock} pcs
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons inside View Modal - EDIT BUTTON INSIDE VIEW MODAL */}
              {/* <div className="flex gap-2 pt-3 border-t border-black/10 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const prod = viewingProduct;
                    setViewingProduct(null);
                    openEdit(prod);
                  }}
                  className="flex-1 py-2 px-4 rounded-xl bg-sepia text-white text-xs font-medium hover:bg-sepia-dark transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={14} /> Edit Product
                </button>
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
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
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 w-full h-full sm:h-auto sm:max-w-md sm:max-h-[90vh] rounded-none sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header - stays fixed */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <h2 className="text-xl font-jakarta font-semibold text-ink dark:text-cream">
                {editing ? "Edit Product" : "New Product"}
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
              id="product-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {!editing && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                    Select Artwork{" "}
                    <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <div className="relative" ref={artworkDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        artworkDropdownOpen
                          ? closeArtworkDropdown()
                          : setArtworkDropdownOpen(true)
                      }
                      aria-haspopup="listbox"
                      aria-expanded={artworkDropdownOpen}
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm flex items-center gap-2.5 text-left"
                    >
                      {selectedArtwork ? (
                        <>
                          <div className="relative w-7 h-7 shrink-0 rounded-lg overflow-hidden bg-black/5 dark:bg-black/50">
                            <Image
                              src={selectedArtwork.imageUrl}
                              alt={selectedArtwork.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span className="truncate flex-1">
                            {selectedArtwork.title}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-400 flex-1">
                          Choose an artwork...
                        </span>
                      )}
                      {artworkDropdownOpen ? (
                        <ArrowUp size={16} className="shrink-0 opacity-60" />
                      ) : (
                        <ArrowDown size={16} className="shrink-0 opacity-60" />
                      )}
                    </button>

                    {/* Hidden input so native form validation still enforces a selection */}
                    <input
                      tabIndex={-1}
                      aria-hidden="true"
                      required
                      value={form.artworkId}
                      onChange={() => {}}
                      className="absolute inset-x-0 bottom-0 h-0 w-full opacity-0 pointer-events-none"
                    />

                    {artworkDropdownOpen && (
                      <div className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-xl bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 shadow-lg">
                        {/* Sticky so the filter box stays reachable while
                            scrolling a long result list — the same treatment
                            the toolbar search above the table gets. */}
                        <div className="sticky top-0 z-10 p-2 bg-white dark:bg-[#1a1a1a] border-b border-black/5 dark:border-white/10">
                          <div className="relative">
                            <Search
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                            />
                            <input
                              ref={artworkSearchRef}
                              type="text"
                              value={artworkSearch}
                              onChange={(e) => setArtworkSearch(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  closeArtworkDropdown();
                                } else if (e.key === "Enter") {
                                  // This input lives inside <form
                                  // id="product-form">, so a bare Enter would
                                  // submit a half-filled product. Take it as
                                  // "pick the top match" instead.
                                  e.preventDefault();
                                  const first = filteredArtworks[0];
                                  if (first) {
                                    setForm({ ...form, artworkId: first.id });
                                    closeArtworkDropdown();
                                  }
                                }
                              }}
                              placeholder="Search artworks by title..."
                              className="w-full pl-9 pr-8 py-2 rounded-lg admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm"
                            />
                            {artworkSearch && (
                              <button
                                type="button"
                                onClick={() => {
                                  setArtworkSearch("");
                                  artworkSearchRef.current?.focus();
                                }}
                                title="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {availableArtworks.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-ink-400 dark:text-ink-300">
                            No artworks available
                          </p>
                        ) : filteredArtworks.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-ink-400 dark:text-ink-300">
                            No artwork matches &quot;{artworkSearch.trim()}&quot;
                          </p>
                        ) : (
                          filteredArtworks.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, artworkId: a.id });
                                closeArtworkDropdown();
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${
                                form.artworkId === a.id
                                  ? "bg-sepia/10 dark:bg-sepia/20"
                                  : ""
                              }`}
                            >
                              <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-black/5 dark:bg-black/50">
                                <Image
                                  src={a.imageUrl}
                                  alt={a.title}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                              <span className="truncate text-sm text-ink dark:text-cream">
                                {a.title}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Preview of the selected artwork's image */}
                  {selectedArtwork && (
                    <div className="mt-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                        Image Preview
                      </label>
                      <div
                        onClick={() =>
                          setPreviewImage({
                            url: selectedArtwork.imageUrl,
                            title: selectedArtwork.title || "Image Preview",
                          })
                        }
                        className="relative w-full h-44 rounded-xl border border-black/10 dark:border-white/15 overflow-hidden bg-black/5 dark:bg-black/50 cursor-pointer group"
                      >
                        <Image
                          src={selectedArtwork.imageUrl}
                          alt={selectedArtwork.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="flex items-center gap-1.5 text-cream font-body text-xs bg-black/70 px-3 py-1.5 rounded-lg backdrop-blur-md">
                            <ZoomIn size={14} /> View Full Image
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {editing && (
                <div className="flex items-center gap-3 p-3 rounded-xl admin-input border">
                  <div
                    onClick={() =>
                      setPreviewImage({
                        url: editing.artwork.imageUrl,
                        title: editing.artwork.title || "Image Preview",
                      })
                    }
                    className="relative w-12 h-12 shrink-0 rounded-lg cursor-pointer group overflow-hidden"
                  >
                    <Image
                      src={editing.artwork.imageUrl}
                      alt={editing.artwork.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ZoomIn size={14} className="text-cream" />
                    </div>
                  </div>
                  <p className="font-jakarta font-semibold tracking-tight text-base text-ink dark:text-cream truncate">
                    {editing.artwork.title}
                  </p>
                </div>
              )}

              {/* Price */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  {variantDrafts.length > 0 ? "Base Price (PHP)" : "Price (PHP)"}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <PriceInput
                  required
                  placeholder="30,000.00"
                  value={form.price}
                  onChange={(price) => setForm({ ...form, price })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta"
                />
              </div>

              {/* Stock */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  {variantDrafts.length > 0 ? "Base Stock" : "Stock"}{" "}
                  <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  placeholder="1"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta"
                />
              </div>

              {/* Size / Variant Options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                    Sizes / Variants{" "}
                    <span className="normal-case font-normal text-ink-300 dark:text-ink-600">
                      (optional)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={addVariantDraft}
                    className="inline-flex items-center gap-1 font-body text-xs text-sepia hover:underline"
                  >
                    <Plus size={12} /> Add Size
                  </button>
                </div>
                {variantDrafts.length === 0 ? (
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 italic">
                    Sells at the base price/stock above. Add sizes if this piece
                    comes in more than one format (e.g. A4 / A3 prints).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {variantDrafts.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Label (e.g. A4 Print)"
                          value={v.label}
                          onChange={(e) => updateVariantDraft(i, { label: e.target.value })}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs font-jakarta"
                        />
                        {/* Same grouping as the base price above — a size's
                            price is the same kind of figure, so it would read
                            as an oversight if only one of them formatted. */}
                        <PriceInput
                          required
                          placeholder="Price"
                          value={v.price}
                          onChange={(price) => updateVariantDraft(i, { price })}
                          className="w-24 px-3 py-2 rounded-lg admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs font-jakarta"
                        />
                        <input
                          type="number"
                          required
                          min="0"
                          placeholder="Stock"
                          value={v.stock}
                          onChange={(e) => updateVariantDraft(i, { stock: e.target.value })}
                          className="w-20 px-3 py-2 rounded-lg admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs font-jakarta"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariantDraft(i)}
                          className="p-2 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          title="Remove size"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>

            {/* Footer - stays fixed */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="product-form"
                disabled={saveMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-all disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Product"}
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
              <p className="text-cream font-jakarta text-sm text-center">
                {previewImage.title}
              </p>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          {/* max-h + scroll (same min(vh, 100%) form the museum panels use, so
              it still resolves correctly inside a transformed ancestor) — the
              museum warning below made this modal tall enough to run off the
              bottom of a phone held in landscape. */}
          <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[min(85vh,100%)] overflow-y-auto">
            <h3 className="text-lg font-semibold text-ink dark:text-cream mb-2">
              Delete Product
            </h3>
            <p className="text-sm text-ink-400 dark:text-ink-300 mb-4">
              Are you sure you want to delete this product? This action cannot
              be undone.
            </p>
            {/* The Services Room's wall mirrors the live shop listing rather
                than a hand-picked selection (lib/museum/servicesRoom.ts), so
                deleting here also takes the frame down inside the museum —
                worth saying out loud, since nothing about this screen would
                otherwise suggest a 3D room is affected. */}
            <div className="bg-vermillion/10 border border-vermillion/20 rounded-xl p-3 mb-6 text-left">
              <p className="font-body text-sm text-vermillion font-medium mb-1">
                This also removes it from the museum
              </p>
              <p className="font-body text-xs text-ink-500 dark:text-ink-300">
                The product is currently hung on the wall of the{" "}
                <strong>Services Room</strong> in the Digital Museum. Deleting it takes that
                frame down too, along with any placement you set for it in the Museum Scene
                Editor. The artwork itself stays in your library.
              </p>
            </div>
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
