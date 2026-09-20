// app/(admin)/admin/orders/OrdersClient.tsx
"use client";

import { orderItemTitle, orderItemImageOrPlaceholder } from "@/lib/orders/item-display";
import { useState, useMemo, useEffect } from "react";
import Image from "@/components/ui/SafeImage";
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
  Eye,
  User,
  Mail,
  Hash,
  Calendar,
  CreditCard,
  LayoutGrid,
  List,
  ShoppingBag,
  MapPin,
  Phone,
  StickyNote,
  Download,
  Archive,
  ArchiveRestore,
  ReceiptText,
  Maximize2,
} from "lucide-react";
import { formatPrice, formatDate, ORDER_STATUS_COLORS } from "@/lib/utils";
import { toCsv, downloadCsv, timestampedFilename } from "@/lib/csv";
import { RowsPerPageSelect } from "@/components/admin/RowsPerPageSelect";
import { AdminSelect } from "@/components/admin/AdminSelect";
import toast from "@/lib/toast";

/**
 * Column widths for the desktop list view, shared by the header strip and every
 * row so Reference / Amount / Status / Update line up down the page instead of
 * each row sizing itself to its own content.
 */
const COL = {
  ref: "hidden md:block md:w-44 shrink-0",
  amount: "w-24 sm:w-28 shrink-0 text-right",
  status: "hidden sm:flex sm:w-28 shrink-0 justify-center",
  update: "hidden md:block md:w-32 shrink-0",
  actions: "shrink-0 flex items-center justify-end gap-1 sm:w-[104px]",
};

type OrderStatus =
  "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "SHIPPED" | "DELIVERED";
type SortOption = "date" | "total" | "customer" | "items" | "status";
type SortOrder = "asc" | "desc";
type ViewMode = "list" | "grid";

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  variantLabel?: string | null;
  /** Null once the product has been permanently deleted — the line then
   *  reads from its snapshots (lib/orders/item-display.ts). */
  product: {
    id: string;
    title?: string | null;
    images?: string[];
    artwork: { title: string; imageUrl: string } | null;
  } | null;
  titleSnapshot?: string | null;
  imageSnapshot?: string | null;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  total: number;
  paymentId: string | null;
  paymongoRef: string | null;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  deliveryNotes?: string | null;
  items: OrderItem[];
  createdAt: Date | string;
  /** Set once the admin files the order away — see Order.archivedAt. */
  archivedAt?: Date | string | null;
}

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "SHIPPED",
  "DELIVERED",
];

/** Column headers for the CSV export, in order. */
const CSV_HEADERS = [
  "Order ID",
  "Reference",
  "Date",
  "Customer",
  "Email",
  "Status",
  "Archived",
  "Items",
  "Units",
  "Total (PHP)",
  "Shipping Address",
  "Shipping Phone",
  "Delivery Notes",
  "Payment ID",
  "Line Items",
];

/** One export row per order — line items collapsed into a single readable cell. */
function csvRow(order: Order): unknown[] {
  return [
    order.id,
    order.paymongoRef ?? "",
    new Date(order.createdAt).toISOString(),
    order.customerName,
    order.customerEmail,
    order.status,
    order.archivedAt ? "Yes" : "No",
    order.items.length,
    order.items.reduce((sum, i) => sum + i.quantity, 0),
    // Raw number, not formatPrice — "₱28,000" is a string to a spreadsheet,
    // and an export you can't SUM() is an export you can't use.
    order.total.toFixed(2),
    order.shippingAddress ?? "",
    order.shippingPhone ?? "",
    order.deliveryNotes ?? "",
    order.paymentId ?? "",
    order.items
      .map(
        (i) =>
          `${orderItemTitle(i)}${i.variantLabel ? ` (${i.variantLabel})` : ""} ×${i.quantity} @ ${i.price}`
      )
      .join("; "),
  ];
}

export function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  // Search & Modal States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Sorting States
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View Mode State (accordion list vs. grid cards)
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Archive scope. Archived orders are hidden by default — the working list
  // should only hold business the admin still has to do something about.
  const [showArchived, setShowArchived] = useState(false);

  // Full Image View Lightbox State — same shape the other admin modules use.
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // Lock background scroll while a modal or the lightbox is open.
  useEffect(() => {
    if (selectedOrder || previewImage) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [selectedOrder, previewImage]);

  // Esc closes the lightbox first, then the order modal.
  useEffect(() => {
    if (!selectedOrder && !previewImage) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (previewImage) setPreviewImage(null);
      else setSelectedOrder(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedOrder, previewImage]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();

      // Update main state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: updated.status } : o
        )
      );

      // Update selected modal order if open
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) =>
          prev ? { ...prev, status: updated.status } : null
        );
      }

      toast.success(`Order status → ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  async function setArchived(orderId: string, archived: boolean) {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, archivedAt: updated.archivedAt } : o
        )
      );
      // Archiving from inside the modal would leave it showing a row that's no
      // longer in the list, so close it.
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      if (expanded === orderId) setExpanded(null);

      toast.success(archived ? "Order archived" : "Order restored");
    } catch {
      toast.error(archived ? "Failed to archive order" : "Failed to restore order");
    }
  }

  /** Opens the printable receipt in a new tab (see lib/receipt.ts). */
  function downloadReceipt(orderId: string) {
    const tab = window.open(`/api/orders/${orderId}/receipt`, "_blank", "noopener");
    if (!tab) toast.error("Allow pop-ups to download the receipt");
  }

  // Orders in the current archive scope — everything below (counts, filters,
  // the export) works off this, so "Showing 12 of 12" never counts rows the
  // admin can't see.
  const scopedOrders = useMemo(
    () => orders.filter((o) => (showArchived ? !!o.archivedAt : !o.archivedAt)),
    [orders, showArchived]
  );

  const archivedCount = useMemo(
    () => orders.filter((o) => !!o.archivedAt).length,
    [orders]
  );

  // Filtered, Searched, and Sorted Orders Logic
  const processedOrders = useMemo(() => {
    return scopedOrders
      .filter((o) => {
        // 1. Status Filter
        const matchesStatus = filter === "ALL" || o.status === filter;

        // 2. Search Query Filter (Name, Email, IDs, or Artwork Titles)
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          o.customerName.toLowerCase().includes(query) ||
          o.customerEmail.toLowerCase().includes(query) ||
          o.id.toLowerCase().includes(query) ||
          (o.paymongoRef && o.paymongoRef.toLowerCase().includes(query)) ||
          o.items.some((item) =>
            orderItemTitle(item).toLowerCase().includes(query)
          );

        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "customer":
            comparison = a.customerName.localeCompare(b.customerName);
            break;
          case "total":
            comparison = a.total - b.total;
            break;
          case "items": {
            const countA = a.items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            const countB = b.items.reduce(
              (sum, item) => sum + item.quantity,
              0
            );
            comparison = countA - countB;
            break;
          }
          case "status":
            comparison = a.status.localeCompare(b.status);
            break;
          case "date":
          default: {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            comparison = dateA - dateB;
            break;
          }
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [scopedOrders, filter, searchQuery, sortBy, sortOrder]);

  // Pagination Logic
  const totalPages = Math.ceil(processedOrders.length / pageSize);
  const paginatedOrders = processedOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const counts: Record<string, number> = { ALL: scopedOrders.length };
  STATUS_OPTIONS.forEach((s) => {
    counts[s] = scopedOrders.filter((o) => o.status === s).length;
  });

  /**
   * Exports exactly what's on screen — current archive scope, status filter,
   * search and sort order, all of it, but every matching row rather than just
   * the current page. An export that silently ignored the filters would be a
   * different report from the one the admin is looking at.
   */
  function exportCsv() {
    if (processedOrders.length === 0) {
      toast.error("No orders to export");
      return;
    }
    const csv = toCsv(CSV_HEADERS, processedOrders.map(csvRow));
    downloadCsv(timestampedFilename(showArchived ? "orders-archived" : "orders"), csv);
    toast.success(
      `Exported ${processedOrders.length} order${processedOrders.length !== 1 ? "s" : ""}`
    );
  }

  return (
    <>
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="font-body text-xs text-ink-400 dark:text-ink-300">
          Showing{" "}
          <strong className="text-ink dark:text-cream">
            {processedOrders.length}
          </strong>{" "}
          of{" "}
          <strong className="text-ink dark:text-cream">
            {scopedOrders.length}
          </strong>{" "}
          {showArchived ? "archived orders" : "orders"}
        </div>

        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-black/10 dark:border-white/10 font-body text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
          title="Download the orders matching the current filters as CSV"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Filter, Search & Sort Control Panel */}
      <div className="mb-6 admin-card border rounded-2xl p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1">
          {["ALL", ...STATUS_OPTIONS].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
                filter === s
                  ? "bg-sepia text-white border-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
            >
              {s} ({counts[s] ?? 0})
            </button>
          ))}

          {/* Archive scope — a separate axis from the status tabs above, so
              it gets its own chip with a divider rather than a seventh tab. */}
          <span
            className="hidden sm:block w-px h-5 mx-1.5 bg-black/10 dark:bg-white/10"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => {
              setShowArchived((v) => !v);
              setCurrentPage(1);
            }}
            aria-pressed={showArchived}
            className={`inline-flex items-center gap-1.5 font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase border transition-all ${
              showArchived
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            }`}
            title={showArchived ? "Back to active orders" : "Show archived orders"}
          >
            <Archive size={12} />
            Archived ({archivedCount})
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
              placeholder="Search name, email, order ID..."
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
              {/* Chevron is drawn, not the browser's — see AdminSelect. */}
              <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 flex-1 min-w-0 sm:flex-none">
                <ArrowUpDown size={12} className="text-ink-400 shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="flex-1 min-w-0 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer"
                >
                  <option value="date" className="bg-white dark:bg-ink-900">
                    Date Created
                  </option>
                  <option value="total" className="bg-white dark:bg-ink-900">
                    Total Amount
                  </option>
                  <option value="customer" className="bg-white dark:bg-ink-900">
                    Customer Name
                  </option>
                  <option value="items" className="bg-white dark:bg-ink-900">
                    Items Count
                  </option>
                  <option value="status" className="bg-white dark:bg-ink-900">
                    Status
                  </option>
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
              </div>

              {/* Sort Order Toggle */}
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

            {/* View Mode Toggle (List rows vs. Grid cards) */}
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

      {/* Orders List / Grid */}
      {processedOrders.length === 0 ? (
        <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
          <div className="p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-ink-400 dark:text-ink-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-jakarta font-medium text-ink dark:text-cream mb-1">
              {showArchived
                ? "No archived orders"
                : orders.length === 0
                  ? "No orders yet"
                  : "No matching orders"}
            </h3>
            <p className="text-sm font-body text-ink-400 dark:text-ink-300 mb-6 max-w-md mx-auto">
              {showArchived
                ? "Orders you archive get filed here. They stay in your revenue figures and exports — archiving only clears them out of the working list."
                : orders.length === 0
                  ? "Orders placed by customers will appear here once checkout is completed."
                  : "Try adjusting your search query or status filter criteria."}
            </p>
            {scopedOrders.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setFilter("ALL");
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedOrders.map((order) => (
            <div
              key={order.id}
              className="admin-modal border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="p-4 flex flex-col flex-1">
                {/* Status + Date */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-block font-body text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-md ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {order.status}
                  </span>
                  <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 shrink-0">
                    {formatDate(order.createdAt)}
                  </span>
                </div>

                {/* Customer */}
                <div className="mt-3">
                  <p
                    onClick={() => setSelectedOrder(order)}
                    className="font-jakarta text-base font-semibold tracking-tight text-sepia dark:text-cream truncate cursor-pointer hover:underline"
                  >
                    {order.customerName}
                  </p>
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate mt-0.5">
                    {order.customerEmail}
                  </p>
                </div>

                {/* Item thumbnails */}
                <div className="flex items-center gap-1.5 mt-3">
                  {order.items.slice(0, 4).map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() =>
                        setPreviewImage({
                          url: orderItemImageOrPlaceholder(item),
                          title: orderItemTitle(item),
                        })
                      }
                      className="group relative w-9 h-9 shrink-0 border border-ink-100 dark:border-ink-700 rounded-lg overflow-hidden cursor-zoom-in"
                      title={orderItemTitle(item)}
                    >
                      <Image
                        src={orderItemImageOrPlaceholder(item)}
                        alt={orderItemTitle(item)}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </button>
                  ))}
                  {order.items.length > 4 && (
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-ink-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 flex items-center justify-center">
                      <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                        +{order.items.length - 4}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ref */}
                <p className="font-jakarta text-[10px] tabular-nums tracking-tight text-ink-400 dark:text-ink-300 mt-3">
                  {order.paymongoRef || order.id.slice(0, 12)}
                </p>

                {/* Total */}
                <div className="mt-2">
                  <p className="font-jakarta text-lg font-bold tabular-nums tracking-tight text-ink dark:text-cream">
                    {formatPrice(order.total)}
                  </p>
                  <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                    {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-100 dark:border-ink-700">
                  <AdminSelect
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(order.id, e.target.value as OrderStatus)
                    }
                    wrapperClassName="flex-1 min-w-0"
                    className="font-body text-xs py-1.5"
                    title="Update order status"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-ink-900">
                        {s}
                      </option>
                    ))}
                  </AdminSelect>
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title="View Full Order Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => downloadReceipt(order.id)}
                    className="p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title="Download Receipt (opens a printable receipt — Save as PDF)"
                  >
                    <ReceiptText size={16} />
                  </button>
                  <button
                    onClick={() => setArchived(order.id, !order.archivedAt)}
                    className="p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title={order.archivedAt ? "Restore to active orders" : "Archive Order"}
                  >
                    {order.archivedAt ? (
                      <ArchiveRestore size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Orders table (accordion list) */
        <div className="admin-modal border rounded-2xl overflow-hidden shadow-sm">
          {/* Column header — desktop only. Every cell below uses the same COL
              widths, so the columns run straight down the page. */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 bg-ink-50/70 dark:bg-ink-800/50 border-b border-ink-100 dark:border-ink-700">
            <span className="w-6 shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0 font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
              Customer
            </span>
            <span className={`${COL.ref} font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300`}>
              Reference
            </span>
            <span className={`${COL.amount} font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300`}>
              Amount
            </span>
            <span className={`${COL.status} font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300`}>
              Status
            </span>
            <span className={`${COL.update} font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300`}>
              Update
            </span>
            <span className={`${COL.actions} font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300`}>
              Actions
            </span>
          </div>

          <div className="divide-y divide-ink-50 dark:divide-ink-800">
          {paginatedOrders.map((order) => (
            <div key={order.id}>
              <div className="w-full flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors">
                {/* Expand toggle */}
                <button
                  onClick={() =>
                    setExpanded(expanded === order.id ? null : order.id)
                  }
                  className="text-ink-400 dark:text-ink-300 shrink-0 w-6 flex justify-center hover:text-ink dark:hover:text-cream"
                  title="Toggle items"
                >
                  {expanded === order.id ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {/* Customer */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() =>
                    setExpanded(expanded === order.id ? null : order.id)
                  }
                >
                  <p className="font-jakarta text-sm font-semibold tracking-tight text-sepia dark:text-cream truncate">
                    {order.customerName}
                  </p>
                  <p className="hidden sm:block font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                    {order.customerEmail}
                  </p>
                  {/* Mobile: status badge inline under name */}
                  <span
                    className={`sm:hidden inline-block font-body text-[9px] tracking-widest uppercase px-1.5 py-0.5 mt-1 rounded-md ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Ref */}
                <div className={COL.ref}>
                  <p className="font-jakarta text-[10px] tabular-nums tracking-tight text-ink-400 dark:text-ink-300 truncate">
                    {order.paymongoRef || order.id.slice(0, 12)}
                  </p>
                  <p className="font-body text-[10px] text-ink-300 dark:text-ink-500 mt-0.5">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                {/* Amount */}
                <div className={COL.amount}>
                  <p className="font-jakarta text-sm sm:text-base font-bold tabular-nums tracking-tight text-ink dark:text-cream">
                    {formatPrice(order.total)}
                  </p>
                  <p className="hidden sm:block font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                    {order.items.length} item
                    {order.items.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Status badge — desktop only. Fixed-width cell with a
                    full-width pill, so short (PAID) and long (CANCELLED)
                    statuses occupy the same column. */}
                <div className={COL.status}>
                  <span
                    className={`w-full text-center font-body text-[10px] tracking-widest uppercase px-2 py-1 rounded-md ${ORDER_STATUS_COLORS[order.status]}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Status Update */}
                <AdminSelect
                  value={order.status}
                  onChange={(e) =>
                    updateStatus(order.id, e.target.value as OrderStatus)
                  }
                  wrapperClassName={COL.update}
                  className="font-body text-xs py-1.5"
                  title="Update order status"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-white dark:bg-ink-900">
                      {s}
                    </option>
                  ))}
                </AdminSelect>

                {/* Actions */}
                <div className={COL.actions}>
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title="View Full Order Details"
                  >
                    <Eye size={16} />
                  </button>

                  {/* Receipt — hidden on the narrowest screens, where it'd crowd
                      the row out; still reachable from the modal and grid card. */}
                  <button
                    onClick={() => downloadReceipt(order.id)}
                    className="hidden sm:block p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title="Download Receipt (opens a printable receipt — Save as PDF)"
                  >
                    <ReceiptText size={16} />
                  </button>

                  <button
                    onClick={() => setArchived(order.id, !order.archivedAt)}
                    className="hidden sm:block p-1.5 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-lg shrink-0 transition-all"
                    title={order.archivedAt ? "Restore to active orders" : "Archive Order"}
                  >
                    {order.archivedAt ? (
                      <ArchiveRestore size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded items (Accordion View) */}
              {expanded === order.id && (
                <div className="px-3 sm:px-6 pb-4 sm:pb-5 bg-ink-50/50 dark:bg-ink-800/50 border-t border-ink-100 dark:border-ink-700">
                  <div className="pt-4 space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 sm:gap-4"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: orderItemImageOrPlaceholder(item),
                              title: orderItemTitle(item),
                            })
                          }
                          className="group relative w-10 h-10 shrink-0 border border-ink-100 dark:border-ink-700 rounded-lg overflow-hidden cursor-zoom-in"
                          title={`View ${orderItemTitle(item)}`}
                        >
                          <Image
                            src={orderItemImageOrPlaceholder(item)}
                            alt={orderItemTitle(item)}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                        </button>
                        <p className="font-jakarta text-sm font-semibold tracking-tight flex-1 min-w-0 truncate text-sepia dark:text-cream">
                          {orderItemTitle(item)}
                          {item.variantLabel && (
                            <span className="font-body text-xs font-normal text-ink-400 dark:text-ink-300">
                              {" "}
                              — {item.variantLabel}
                            </span>
                          )}
                        </p>
                        <p className="font-body text-xs text-ink-400 dark:text-ink-300 shrink-0">
                          × {item.quantity}
                        </p>
                        <p className="font-jakarta text-sm font-bold tabular-nums tracking-tight text-ink dark:text-cream shrink-0">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Mobile: ref + date */}
                  <p className="md:hidden font-jakarta text-[10px] tabular-nums tracking-tight text-ink-400 dark:text-ink-300 mt-4">
                    {order.paymongoRef || order.id.slice(0, 12)} ·{" "}
                    {formatDate(order.createdAt)}
                  </p>

                  {order.paymentId && (
                    <p className="font-jakarta text-[10px] tabular-nums tracking-tight text-ink-400 dark:text-ink-300 mt-1">
                      PayMongo ID: {order.paymentId}
                    </p>
                  )}

                  {order.archivedAt && (
                    <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1 inline-flex items-center gap-1">
                      <Archive size={10} /> Archived {formatDate(order.archivedAt)}
                    </p>
                  )}

                  {/* Mobile status update */}
                  <AdminSelect
                    value={order.status}
                    onChange={(e) =>
                      updateStatus(order.id, e.target.value as OrderStatus)
                    }
                    wrapperClassName="mt-4 md:hidden"
                    className="font-body text-xs py-2"
                    title="Update order status"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-ink-900">
                        {s}
                      </option>
                    ))}
                  </AdminSelect>

                  {/* Mobile receipt + archive — the row's own buttons are
                      sm:-only, so this is the only way to reach them there. */}
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                    <button
                      onClick={() => downloadReceipt(order.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ink-200 dark:border-ink-600 font-body text-xs text-ink dark:text-cream"
                    >
                      <ReceiptText size={13} /> Receipt
                    </button>
                    <button
                      onClick={() => setArchived(order.id, !order.archivedAt)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-ink-200 dark:border-ink-600 font-body text-xs text-ink dark:text-cream"
                    >
                      {order.archivedAt ? (
                        <>
                          <ArchiveRestore size={13} /> Restore
                        </>
                      ) : (
                        <>
                          <Archive size={13} /> Archive
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
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

      {/* View Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="admin-modal border w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-ink-100 dark:border-ink-700">
              <div>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <span
                    className={`inline-block font-body text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md ${ORDER_STATUS_COLORS[selectedOrder.status]}`}
                  >
                    {selectedOrder.status}
                  </span>
                  {selectedOrder.archivedAt && (
                    <span className="inline-flex items-center gap-1 font-body text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-md bg-ink-500/10 text-ink-500 dark:text-ink-300 border border-ink-500/20">
                      <Archive size={10} /> Archived
                    </span>
                  )}
                </div>
                <h3 className="font-jakarta text-lg font-bold text-ink dark:text-cream">
                  Order Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-ink-400 hover:text-ink dark:hover:text-cream transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-ink-50/50 dark:bg-ink-800/40 p-3.5 border border-ink-100 dark:border-ink-800 rounded-xl">
                <div className="space-y-1">
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
                    <User size={13} /> Customer
                  </p>
                  <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream">
                    {selectedOrder.customerName}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
                    <Mail size={13} /> Email
                  </p>
                  <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream truncate">
                    {selectedOrder.customerEmail}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
                    <Calendar size={13} /> Placed On
                  </p>
                  <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream">
                    {formatDate(selectedOrder.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
                    <Hash size={13} /> PayMongo Ref / ID
                  </p>
                  <p className="font-jakarta text-xs font-semibold tabular-nums text-ink dark:text-cream truncate">
                    {selectedOrder.paymongoRef || selectedOrder.id}
                  </p>
                </div>
              </div>

              {/* Shipping Info */}
              {(selectedOrder.shippingAddress || selectedOrder.shippingPhone) && (
                <div className="space-y-3 bg-ink-50/50 dark:bg-ink-800/40 p-3.5 border border-ink-100 dark:border-ink-800 rounded-xl">
                  <h4 className="font-jakarta text-xs uppercase tracking-widest text-ink-400 dark:text-ink-300">
                    Shipping
                  </h4>
                  {selectedOrder.shippingAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin size={14} className="text-ink-400 dark:text-ink-300 mt-0.5 shrink-0" />
                      <p className="font-jakarta text-sm text-ink dark:text-cream whitespace-pre-line">
                        {selectedOrder.shippingAddress}
                      </p>
                    </div>
                  )}
                  {selectedOrder.shippingPhone && (
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-ink-400 dark:text-ink-300 shrink-0" />
                      <p className="font-jakarta text-sm text-ink dark:text-cream">
                        {selectedOrder.shippingPhone}
                      </p>
                    </div>
                  )}
                  {selectedOrder.deliveryNotes && (
                    <div className="flex items-start gap-2">
                      <StickyNote size={14} className="text-ink-400 dark:text-ink-300 mt-0.5 shrink-0" />
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300 whitespace-pre-line">
                        {selectedOrder.deliveryNotes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <div>
                <h4 className="font-jakarta text-xs uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-3">
                  Purchased Items (
                  {selectedOrder.items.reduce((s, i) => s + i.quantity, 0)})
                </h4>
                <div className="divide-y divide-ink-100 dark:divide-ink-800 border-t border-b border-ink-100 dark:border-ink-800">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center gap-3 sm:gap-4">
                      {/* Click the thumbnail to see the artwork full-size. */}
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: orderItemImageOrPlaceholder(item),
                            title: orderItemTitle(item),
                          })
                        }
                        className="group relative w-12 h-12 shrink-0 border border-ink-100 dark:border-ink-700 rounded-lg overflow-hidden cursor-zoom-in"
                        title={`View ${orderItemTitle(item)}`}
                      >
                        <Image
                          src={orderItemImageOrPlaceholder(item)}
                          alt={orderItemTitle(item)}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Maximize2
                            size={14}
                            className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </span>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream truncate">
                          {orderItemTitle(item)}
                        </p>
                        {item.variantLabel && (
                          <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                            {item.variantLabel}
                          </p>
                        )}
                        <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                          {formatPrice(item.price)} each
                        </p>
                      </div>
                      {/* Fixed-width so Qty and the line totals stack into
                          straight columns however long the titles run. */}
                      <p className="w-14 shrink-0 text-right font-body text-xs tabular-nums text-ink-400 dark:text-ink-300">
                        Qty: {item.quantity}
                      </p>
                      <p className="w-24 shrink-0 text-right font-jakarta text-sm font-bold tabular-nums text-ink dark:text-cream">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Status & Payment Info */}
              {selectedOrder.paymentId && (
                <div className="flex items-center gap-2 font-body text-xs text-ink-400 dark:text-ink-300">
                  <CreditCard size={14} /> Payment ID:{" "}
                  <span className="font-jakarta text-ink dark:text-cream">
                    {selectedOrder.paymentId}
                  </span>
                </div>
              )}

              {/* Quick Status Modifier inside Modal */}
              <div className="flex items-center justify-between pt-2 border-t border-ink-100 dark:border-ink-800">
                <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                  Update Order Status:
                </span>
                <AdminSelect
                  value={selectedOrder.status}
                  onChange={(e) =>
                    updateStatus(
                      selectedOrder.id,
                      e.target.value as OrderStatus
                    )
                  }
                  wrapperClassName="w-40 shrink-0"
                  className="font-body text-xs py-1.5"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s} className="bg-white dark:bg-ink-900">
                      {s}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-700 flex items-center justify-between">
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                Total Amount
              </span>
              <p className="font-jakarta text-xl font-bold text-ink dark:text-cream">
                {formatPrice(selectedOrder.total)}
              </p>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => downloadReceipt(selectedOrder.id)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-xs font-medium hover:bg-sepia/90 transition-colors"
                title="Opens a printable receipt in a new tab — Save as PDF from the print dialog"
              >
                <ReceiptText size={14} />
                Download Receipt
              </button>
              <button
                onClick={() => setArchived(selectedOrder.id, !selectedOrder.archivedAt)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 font-jakarta text-xs font-medium text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {selectedOrder.archivedAt ? (
                  <>
                    <ArchiveRestore size={14} /> Restore Order
                  </>
                ) : (
                  <>
                    <Archive size={14} /> Archive Order
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 font-body text-[10px] text-ink-400 dark:text-ink-300 text-center">
              Archiving files the order out of the active list. It stays in your
              revenue figures, the Sales Dashboard and every export.
            </p>
          </div>
        </div>
      )}

      {/* FULL IMAGE PREVIEW LIGHTBOX — same behaviour as Artworks/Products:
          click anywhere (or Esc) to close. Sits above the order modal. */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Close preview"
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
    </>
  );
}
