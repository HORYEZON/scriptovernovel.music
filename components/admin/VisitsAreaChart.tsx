// components/admin/VisitsAreaChart.tsx
"use client";

import { useState } from "react";
import type { DailyVisitPoint } from "@/lib/vercel-analytics";

const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 160;
const TOP_PAD = 10;
const BOTTOM_PAD = 4;

function formatShortDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(date);
}

function formatCompact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

/** Rounds up to a "nice" axis ceiling (1/2/5 × a power of 10) so the gridline
 *  label reads like a number a human would pick, not a raw data max. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

/** Picks a readable subset of x-axis label indices — every point when there
 *  are few, evenly spaced (always including first/last) when there are many. */
function pickLabelIndices(length: number, maxLabels = 6): number[] {
  if (length <= 1) return [0];
  if (length <= maxLabels) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (maxLabels - 1);
  return Array.from({ length: maxLabels }, (_, i) => Math.round(i * step));
}

/**
 * Two-line area chart — Page Views (filled, sepia) over Visitors (thin line,
 * muted) — with a hover tooltip. Hand-rolled inline SVG: no chart library in
 * this repo, and pulling one in for a single dashboard widget isn't worth it.
 * Kept deliberately spare (two gridlines, no axis frame, no legend chrome
 * beyond two small dots) to match the site's editorial aesthetic rather than
 * a default chart-library look.
 */
export function VisitsAreaChart({ data }: { data: DailyVisitPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const rawMax = Math.max(...data.map((d) => d.pageviews), ...data.map((d) => d.visitors), 1);
  const axisMax = niceCeil(rawMax);
  const usableHeight = VIEW_HEIGHT - TOP_PAD - BOTTOM_PAD;

  const xFor = (i: number) =>
    data.length <= 1 ? VIEW_WIDTH / 2 : (i / (data.length - 1)) * VIEW_WIDTH;
  const yFor = (value: number) => TOP_PAD + (1 - value / axisMax) * usableHeight;

  const pageviewPoints = data.map((d, i) => ({ x: xFor(i), y: yFor(d.pageviews) }));
  const visitorPoints = data.map((d, i) => ({ x: xFor(i), y: yFor(d.visitors) }));

  const lineFor = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const pageviewLine = lineFor(pageviewPoints);
  const pageviewArea =
    pageviewPoints.length > 0
      ? `${pageviewLine} L ${pageviewPoints[pageviewPoints.length - 1].x} ${VIEW_HEIGHT} L ${pageviewPoints[0].x} ${VIEW_HEIGHT} Z`
      : "";
  const visitorLine = lineFor(visitorPoints);

  const labelIndices = pickLabelIndices(data.length);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const fraction = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverIndex(Math.round(fraction * (data.length - 1)));
  }

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoveredX = hoverIndex !== null ? xFor(hoverIndex) : null;
  const tooltipLeftPct =
    hoveredX !== null ? Math.min(Math.max((hoveredX / VIEW_WIDTH) * 100, 8), 92) : 0;

  return (
    <div className="border border-black/10 dark:border-white/10 rounded-xl p-3 sm:p-4">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2">
        <span className="inline-flex items-center gap-1.5 font-body text-[10px] text-ink-400 dark:text-ink-300">
          <span className="w-2 h-2 rounded-full bg-sepia" />
          Page Views
        </span>
        <span className="inline-flex items-center gap-1.5 font-body text-[10px] text-ink-400 dark:text-ink-300">
          <span className="w-2 h-2 rounded-full bg-ink-300 dark:bg-ink-500" />
          Visitors
        </span>
      </div>

      <div
        className="relative"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        {/* Axis max label */}
        <span className="absolute left-0 top-0 font-jakarta text-[9px] sm:text-[10px] tabular-nums text-ink-300 dark:text-ink-600">
          {formatCompact(axisMax)}
        </span>

        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full h-32 sm:h-40"
          role="img"
          aria-label={`Page views and visitors per day, ${data.length} days`}
        >
          <defs>
            <linearGradient id="visitsAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" className="text-sepia" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-sepia" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
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

          {/* Page views — filled area + line */}
          <path d={pageviewArea} fill="url(#visitsAreaFill)" stroke="none" />
          <path
            d={pageviewLine}
            fill="none"
            className="stroke-sepia"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Visitors — thin comparison line */}
          <path
            d={visitorLine}
            fill="none"
            className="stroke-ink-300 dark:stroke-ink-500"
            strokeWidth={1.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover guide + markers */}
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
                cx={pageviewPoints[hoverIndex].x}
                cy={pageviewPoints[hoverIndex].y}
                r={3}
                className="fill-sepia"
              />
              <circle
                cx={visitorPoints[hoverIndex].x}
                cy={visitorPoints[hoverIndex].y}
                r={2.5}
                className="fill-ink-300 dark:fill-ink-500"
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hovered && (
          <div
            className="absolute -top-1 -translate-x-1/2 -translate-y-full pointer-events-none z-10 rounded-md bg-ink dark:bg-cream text-cream dark:text-ink px-2.5 py-1.5 shadow-lg whitespace-nowrap"
            style={{ left: `${tooltipLeftPct}%` }}
          >
            <p className="font-jakarta text-[10px] font-semibold">{formatShortDate(hovered.timestamp)}</p>
            <p className="font-body text-[9px] opacity-80">
              {hovered.pageviews.toLocaleString()} views · {hovered.visitors.toLocaleString()} visitors
            </p>
          </div>
        )}
      </div>

      {/* X-axis labels — first/last anchor to the edge instead of centering,
          so they don't clip off the container at 0%/100%. */}
      <div className="relative mt-2 h-3">
        {labelIndices.map((i, labelPos) => {
          const isFirst = labelPos === 0;
          const isLast = labelPos === labelIndices.length - 1;
          const anchorClass = isFirst ? "" : isLast ? "-translate-x-full" : "-translate-x-1/2";
          return (
            <span
              key={data[i].timestamp}
              className={`absolute font-body text-[9px] sm:text-[10px] text-ink-400 dark:text-ink-300 ${anchorClass}`}
              style={{ left: `${(xFor(i) / VIEW_WIDTH) * 100}%` }}
            >
              {formatShortDate(data[i].timestamp)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
