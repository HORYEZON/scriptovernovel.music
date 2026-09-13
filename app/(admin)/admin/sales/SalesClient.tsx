// app/(admin)/admin/sales/SalesClient.tsx
"use client";

import { useMemo, useState } from "react";
import Image from "@/components/ui/SafeImage";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  ShoppingBag,
  Receipt,
  Layers,
  Download,
  ArrowUpRight,
  Trophy,
  CalendarRange,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { toCsv, downloadCsv, timestampedFilename } from "@/lib/csv";
import { RevenueTrendChart } from "@/components/admin/RevenueTrendChart";
import toast from "@/lib/toast";
import {
  SALES_RANGES,
  SALES_RANGE_LABELS,
  buildRevenueTrend,
  dayKey,
  startOfDaysAgo,
  topSellers,
  type SalesLine,
  type SalesRange,
} from "@/lib/sales";

/** Icon chip tint per stat. Kept as whole class strings so Tailwind sees them. */
const STAT_ACCENTS: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sepia: "bg-sepia/10 text-sepia",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

/** Matching hairline that runs across the top of each tile. */
const STAT_RULES: Record<string, string> = {
  emerald: "from-emerald-500/60",
  sepia: "from-sepia/60",
  indigo: "from-indigo-500/60",
  blue: "from-blue-500/60",
};

/** Podium colours for the first three rows of a top-sellers list. */
const RANK_STYLES = [
  "bg-amber-400/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400/30",
  "bg-slate-400/15 text-slate-600 dark:text-slate-300 ring-1 ring-slate-400/30",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30",
];

/** Percentage change vs. the immediately preceding window of the same length. */
function deltaPercent(current: number, previous: number): number | null {
  // No baseline to compare against — "+100%" off zero is noise, not a trend.
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2 py-0.5 font-body text-[10px] text-ink-400 dark:text-ink-300">
        <Minus size={10} /> no prior data
      </span>
    );
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] font-medium ${
        up
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
    >
      <Icon size={10} />
      {up ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

/** Horizontal bar row shared by the artworks and sections lists. */
function SellerRow({
  label,
  imageUrl,
  revenue,
  units,
  share,
  sharePct,
  rank,
}: {
  label: string;
  imageUrl?: string;
  revenue: number;
  units: number;
  /** Width of the bar, relative to the leader (1 = leader). */
  share: number;
  /** This row's cut of the range's total revenue, as a percentage. */
  sharePct: number;
  rank: number;
}) {
  return (
    <div className="group flex items-center gap-3 py-3 px-2 -mx-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors">
      <span
        className={`w-6 h-6 shrink-0 rounded-lg flex items-center justify-center font-jakarta text-[11px] font-semibold tabular-nums ${
          RANK_STYLES[rank - 1] ??
          "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
        }`}
      >
        {rank}
      </span>
      {imageUrl ? (
        <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
          <Image
            src={imageUrl}
            alt={label}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="w-11 h-11 shrink-0 rounded-lg bg-sepia/10 text-sepia flex items-center justify-center">
          <Layers size={16} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
            {label}
          </p>
          <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300 shrink-0">
            {sharePct.toFixed(0)}%
          </span>
        </div>
        {/* Bar is relative to the top row, so the leader always fills it —
            absolute peso widths would leave every bar a stub on a big month. */}
        <div className="mt-1.5 h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sepia/70 to-sepia transition-[width] duration-500"
            style={{ width: `${Math.max(share * 100, 2)}%` }}
          />
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-jakarta text-sm font-semibold tabular-nums text-ink dark:text-cream">
          {formatPrice(revenue)}
        </p>
        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
          {units} sold
        </p>
      </div>
    </div>
  );
}

/** Shared shell for the two top-sellers lists. */
function SellerCard({
  title,
  icon: Icon,
  linkHref,
  linkLabel,
  rows,
  totalRevenue,
  emptyNote,
}: {
  title: string;
  icon: typeof ShoppingBag;
  linkHref: string;
  linkLabel: string;
  rows: { key: string; label: string; imageUrl?: string; revenue: number; units: number }[];
  totalRevenue: number;
  emptyNote: string;
}) {
  const max = rows[0]?.revenue ?? 0;
  return (
    <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] flex items-center justify-between gap-3">
        <h2 className="font-jakarta text-sm sm:text-base font-semibold text-ink dark:text-cream flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-sepia/10 text-sepia flex items-center justify-center shrink-0">
            <Icon size={15} strokeWidth={1.75} />
          </span>
          {title}
        </h2>
        <Link
          href={linkHref}
          className="font-body text-xs text-sepia hover:underline inline-flex items-center gap-1 shrink-0"
        >
          {linkLabel} <ArrowUpRight size={12} />
        </Link>
      </div>
      <div className="px-5 py-1 divide-y divide-black/5 dark:divide-white/5 flex-1">
        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <Trophy
              size={22}
              className="mx-auto mb-2 text-ink-300 dark:text-ink-600"
              strokeWidth={1.5}
            />
            <p className="font-body text-sm text-ink-400 dark:text-ink-300">{emptyNote}</p>
          </div>
        ) : (
          rows.map((seller, i) => (
            <SellerRow
              key={seller.key}
              rank={i + 1}
              label={seller.label}
              imageUrl={seller.imageUrl}
              revenue={seller.revenue}
              units={seller.units}
              share={max > 0 ? seller.revenue / max : 0}
              sharePct={totalRevenue > 0 ? (seller.revenue / totalRevenue) * 100 : 0}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function SalesClient({
  lines,
  lifetimeRevenue,
  lifetimeOrders,
}: {
  lines: SalesLine[];
  lifetimeRevenue: number;
  lifetimeOrders: number;
}) {
  const [range, setRange] = useState<SalesRange>(30);

  // Everything below derives from these two slices: the selected window, and
  // the equally-long window immediately before it (for the vs.-previous deltas).
  const { current, previous } = useMemo(() => {
    const currentKey = dayKey(startOfDaysAgo(range));
    const previousKey = dayKey(startOfDaysAgo(range * 2));
    return {
      current: lines.filter((l) => l.d >= currentKey),
      previous: lines.filter((l) => l.d >= previousKey && l.d < currentKey),
    };
  }, [lines, range]);

  const trend = useMemo(() => buildRevenueTrend(current, range), [current, range]);

  const totals = useMemo(() => {
    const revenue = current.reduce((s, l) => s + l.r, 0);
    const units = current.reduce((s, l) => s + l.q, 0);
    const orders = new Set(current.map((l) => l.o)).size;
    return {
      revenue,
      units,
      orders,
      average: orders > 0 ? revenue / orders : 0,
    };
  }, [current]);

  const previousTotals = useMemo(() => {
    const revenue = previous.reduce((s, l) => s + l.r, 0);
    const units = previous.reduce((s, l) => s + l.q, 0);
    const orders = new Set(previous.map((l) => l.o)).size;
    return {
      revenue,
      units,
      orders,
      average: orders > 0 ? revenue / orders : 0,
    };
  }, [previous]);

  /** Best single day in the range — the one number the chart can't state outright. */
  const peak = useMemo(
    () => trend.reduce<(typeof trend)[number] | null>(
      (best, p) => (p.revenue > (best?.revenue ?? 0) ? p : best),
      null
    ),
    [trend]
  );

  const topArtworks = useMemo(
    () =>
      topSellers(current, (l) => ({ key: l.a, label: l.t, imageUrl: l.p }), 8),
    [current]
  );

  const topSections = useMemo(
    () =>
      topSellers(
        current,
        (l) => (l.s ? { key: l.s, label: l.s } : { key: "__none", label: "Unsectioned" }),
        8
      ),
    [current]
  );

  const stats = [
    {
      label: "Revenue",
      value: formatPrice(totals.revenue),
      hint: `${formatPrice(previousTotals.revenue)} previous`,
      delta: deltaPercent(totals.revenue, previousTotals.revenue),
      icon: TrendingUp,
      color: "emerald",
    },
    {
      label: "Orders",
      value: totals.orders.toLocaleString(),
      hint: `${previousTotals.orders.toLocaleString()} previous`,
      delta: deltaPercent(totals.orders, previousTotals.orders),
      icon: Package,
      color: "blue",
    },
    {
      label: "Items Sold",
      value: totals.units.toLocaleString(),
      hint: `${previousTotals.units.toLocaleString()} previous`,
      delta: deltaPercent(totals.units, previousTotals.units),
      icon: ShoppingBag,
      color: "indigo",
    },
    {
      label: "Avg. Order Value",
      value: formatPrice(totals.average),
      hint: `${formatPrice(previousTotals.average)} previous`,
      delta: deltaPercent(totals.average, previousTotals.average),
      icon: Receipt,
      color: "sepia",
    },
  ];

  function exportSalesCsv() {
    if (trend.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const csv = toCsv(
      ["Date", "Revenue (PHP)", "Orders", "Items Sold"],
      trend.map((p) => [p.day, p.revenue.toFixed(2), p.orders, p.units])
    );
    downloadCsv(timestampedFilename(`sales-${range}d`), csv);
    toast.success(`Exported ${trend.length} days of sales`);
  }

  return (
    <>
      {/* Range picker + export */}
      <div className="mb-4 sm:mb-6 admin-card border rounded-2xl p-3 sm:p-4 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarRange
            size={15}
            className="text-ink-400 dark:text-ink-300 shrink-0 hidden sm:block"
          />
          {/* Segmented control — one tinted track, so the four ranges read as
              one switch instead of four loose buttons. */}
          <div
            role="tablist"
            aria-label="Date range"
            className="flex items-center gap-0.5 p-0.5 rounded-xl bg-black/5 dark:bg-white/5 overflow-x-auto"
          >
            {SALES_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`font-body text-[10px] sm:text-xs px-3 py-1.5 rounded-lg tracking-wider uppercase whitespace-nowrap transition-all ${
                  range === r
                    ? "bg-sepia text-white font-medium shadow-sm"
                    : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                }`}
              >
                {SALES_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 justify-between lg:justify-end">
          <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
            <span className="hidden sm:inline">All time: </span>
            <span className="font-jakarta font-semibold text-ink dark:text-cream tabular-nums">
              {formatPrice(lifetimeRevenue)}
            </span>{" "}
            · {lifetimeOrders} order{lifetimeOrders !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={exportSalesCsv}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 font-body text-xs text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            title="Download the daily revenue series as CSV"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="admin-card border rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-sm relative overflow-hidden hover:shadow-md transition-shadow"
          >
            <span
              className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent ${STAT_RULES[stat.color]}`}
            />
            <div className="flex items-start justify-between gap-2">
              <p className="font-body text-[10px] sm:text-[11px] text-ink-400 dark:text-ink-300 uppercase tracking-widest">
                {stat.label}
              </p>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENTS[stat.color]}`}
              >
                <stat.icon size={16} strokeWidth={1.75} />
              </div>
            </div>
            <p className="font-jakarta text-xl sm:text-2xl font-semibold tracking-tight text-ink dark:text-cream truncate mt-2 tabular-nums">
              {stat.value}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <DeltaBadge value={stat.delta} />
              <span className="font-body text-[10px] text-ink-300 dark:text-ink-600 truncate">
                {stat.hint}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="admin-card border rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-sm mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div>
            <h2 className="font-jakarta text-sm sm:text-base font-semibold text-ink dark:text-cream flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-sepia/10 text-sepia flex items-center justify-center shrink-0">
                <TrendingUp size={15} strokeWidth={1.75} />
              </span>
              Revenue Trend
            </h2>
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1 ml-9">
              Last {SALES_RANGE_LABELS[range]} · paid, shipped and delivered orders
            </p>
          </div>
          {peak && peak.revenue > 0 && (
            <span className="font-body text-[10px] sm:text-[11px] text-ink-400 dark:text-ink-300 rounded-full bg-black/5 dark:bg-white/5 px-2.5 py-1">
              Best day{" "}
              <span className="font-jakarta font-semibold text-ink dark:text-cream tabular-nums">
                {formatPrice(peak.revenue)}
              </span>
            </span>
          )}
        </div>
        <RevenueTrendChart data={trend} />
      </div>

      {/* Top sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SellerCard
          title="Top-Selling Artworks"
          icon={ShoppingBag}
          linkHref="/admin/products"
          linkLabel="Products"
          rows={topArtworks}
          totalRevenue={totals.revenue}
          emptyNote="No sales in this range yet."
        />
        <SellerCard
          title="Top-Selling Sections"
          icon={Layers}
          linkHref="/admin/artworks"
          linkLabel="Sections"
          rows={topSections}
          totalRevenue={totals.revenue}
          emptyNote="No sales in this range yet."
        />
      </div>
    </>
  );
}
