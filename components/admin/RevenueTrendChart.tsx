// components/admin/RevenueTrendChart.tsx
"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { RevenuePoint } from "@/lib/sales";

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 180;
const TOP_PAD = 12;
const BOTTOM_PAD = 4;

function formatShortDate(day: string): string {
  // `YYYY-MM-DD` parsed with `new Date(day)` is treated as UTC midnight, which
  // renders as the *previous* day in any timezone behind UTC. Split it and
  // build a local date so the label matches the bucket it belongs to.
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d)
  );
}

/** Compact peso axis label — ₱12.5K rather than ₱12,500. */
function formatCompactPeso(n: number): string {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `₱${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `₱${Math.round(n).toLocaleString()}`;
}

/** Rounds up to a "nice" axis ceiling (1/2/5 × a power of 10). */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function pickLabelIndices(length: number, maxLabels = 6): number[] {
  if (length <= 1) return [0];
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

/**
 * Daily revenue as a filled area chart with a hover readout.
 *
 * Deliberately the same hand-rolled inline-SVG approach as VisitsAreaChart —
 * there is still no chart library in this repo, and the two charts sit two
 * tabs apart in the admin, so they should look like siblings.
 *
 * One difference: long ranges get smoothed. 365 daily points across 600 view
 * units is under two pixels per point — a spiky mess that hides the trend it
 * exists to show — so anything past ~90 points is averaged into ~90 buckets
 * before drawing. The tooltip reports the bucket's span, not a fake single day.
 */
export function RevenueTrendChart({ data }: { data: RevenuePoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Each drawn point, plus how many days it stands for (>1 once smoothed).
  const points = useMemo(() => {
    const MAX_POINTS = 90;
    if (data.length <= MAX_POINTS) {
      return data.map((p) => ({ ...p, from: p.day, to: p.day, days: 1 }));
    }
    const bucketSize = Math.ceil(data.length / MAX_POINTS);
    const out: (RevenuePoint & { from: string; to: string; days: number })[] = [];
    for (let i = 0; i < data.length; i += bucketSize) {
      const slice = data.slice(i, i + bucketSize);
      out.push({
        day: slice[0].day,
        from: slice[0].day,
        to: slice[slice.length - 1].day,
        days: slice.length,
        revenue: slice.reduce((s, p) => s + p.revenue, 0),
        orders: slice.reduce((s, p) => s + p.orders, 0),
        units: slice.reduce((s, p) => s + p.units, 0),
      });
    }
    return out;
  }, [data]);

  const axisMax = niceCeil(Math.max(...points.map((p) => p.revenue), 1));
  const usableHeight = VIEW_HEIGHT - TOP_PAD - BOTTOM_PAD;

  const xFor = (i: number) =>
    points.length <= 1 ? VIEW_WIDTH / 2 : (i / (points.length - 1)) * VIEW_WIDTH;
  const yFor = (value: number) => TOP_PAD + (1 - value / axisMax) * usableHeight;

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.revenue) }));
  const line = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area =
    coords.length > 0
      ? `${line} L ${coords[coords.length - 1].x} ${VIEW_HEIGHT} L ${coords[0].x} ${VIEW_HEIGHT} Z`
      : "";

  const labelIndices = pickLabelIndices(points.length);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverIndex(Math.round(fraction * (points.length - 1)));
  }

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? xFor(hoverIndex) : null;
  const tooltipLeftPct =
    hoveredX !== null ? Math.min(Math.max((hoveredX / VIEW_WIDTH) * 100, 10), 90) : 0;

  const hasRevenue = points.some((p) => p.revenue > 0);

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="inline-flex items-center gap-1.5 font-body text-[10px] text-ink-400 dark:text-ink-300">
          <span className="w-2 h-2 rounded-full bg-sepia" />
          Revenue{points[0]?.days > 1 ? ` (${points[0].days}-day totals)` : " per day"}
        </span>
        {!hasRevenue && (
          <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
            No paid orders in this range
          </span>
        )}
      </div>

      <div
        className="relative"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <span className="absolute left-0 top-0 font-jakarta text-[9px] sm:text-[10px] tabular-nums text-ink-300 dark:text-ink-600">
          {formatCompactPeso(axisMax)}
        </span>

        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full h-36 sm:h-48"
          role="img"
          aria-label={`Revenue trend across ${data.length} days`}
        >
          <defs>
            <linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" className="text-sepia" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-sepia" />
            </linearGradient>
          </defs>

          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={yFor(axisMax)}
            y2={yFor(axisMax)}
            className="stroke-black/10 dark:stroke-white/10"
            strokeWidth={1}
          />
          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={yFor(axisMax / 2)}
            y2={yFor(axisMax / 2)}
            className="stroke-black/5 dark:stroke-white/5"
            strokeWidth={1}
          />

          <path d={area} fill="url(#revenueAreaFill)" stroke="none" />
          <path
            d={line}
            fill="none"
            className="stroke-sepia"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {hoverIndex !== null && hoveredX !== null && (
            <g>
              <line
                x1={hoveredX}
                x2={hoveredX}
                y1={TOP_PAD}
                y2={VIEW_HEIGHT}
                className="stroke-black/15 dark:stroke-white/15"
                strokeWidth={1}
              />
              <circle
                cx={coords[hoverIndex].x}
                cy={coords[hoverIndex].y}
                r={3}
                className="fill-sepia"
              />
            </g>
          )}
        </svg>

        {hovered && (
          <div
            className="absolute -top-1 -translate-x-1/2 -translate-y-full pointer-events-none z-10 rounded-md bg-ink dark:bg-cream text-cream dark:text-ink px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="font-jakarta text-[10px] font-semibold">
              {hovered.days > 1
                ? `${formatShortDate(hovered.from)} – ${formatShortDate(hovered.to)}`
                : formatShortDate(hovered.day)}
            </p>
            <p className="font-body text-[9px] opacity-80">
              {formatPrice(hovered.revenue)} · {hovered.orders} order
              {hovered.orders !== 1 ? "s" : ""} · {hovered.units} item
              {hovered.units !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>

      {/* X-axis labels — first/last anchor to the edge so they don't clip. */}
      <div className="relative mt-2 h-3">
        {labelIndices.map((i, labelPos) => {
          const isFirst = labelPos === 0;
          const isLast = labelPos === labelIndices.length - 1;
          const anchorClass = isFirst ? "" : isLast ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <span
              key={points[i].day}
              className={`absolute font-body text-[9px] sm:text-[10px] text-ink-400 dark:text-ink-300 ${anchorClass}`}
              style={{ left: `${(xFor(i) / VIEW_WIDTH) * 100}%` }}
            >
              {formatShortDate(points[i].day)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
