// lib/sales.ts
//
// Shared vocabulary for the Sales Dashboard (/admin/sales) and anywhere else
// that has to answer "how much money did we actually make?".
//
// The Order model carries a single `status` column, so the moment a paid
// order is marked SHIPPED it stops saying "PAID" — even though the customer's
// money very much arrived. Any revenue figure that filters on `status: PAID`
// alone therefore *shrinks* as the admin fulfils orders, which is exactly
// backwards. REVENUE_STATUSES is the honest set: every status that implies
// the payment cleared.

import type { OrderStatus } from "@prisma/client";

/** Statuses that mean the money was actually collected. */
export const REVENUE_STATUSES: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

/** How far back the Sales Dashboard loads line items, in days. */
export const SALES_WINDOW_DAYS = 365;

/** Ranges offered by the dashboard's range picker, in days. */
export const SALES_RANGES = [7, 30, 90, 365] as const;
export type SalesRange = (typeof SALES_RANGES)[number];

export const SALES_RANGE_LABELS: Record<SalesRange, string> = {
  7: "7 days",
  30: "30 days",
  90: "90 days",
  365: "12 months",
};

/**
 * One order line, flattened to the few fields the dashboard actually charts.
 *
 * Short keys because this array is serialized into the client bundle on every
 * page load — with a year of orders it's the largest thing on the wire, and
 * `{d,a,t,s,q,r,p}` is roughly half the bytes of the spelled-out version.
 */
export interface SalesLine {
  /** Order id — so several lines of one order count as a single order. */
  o: string;
  /** Order date as a local `YYYY-MM-DD` day key. */
  d: string;
  /** Artwork id — the grouping key for "top-selling artworks". */
  a: string;
  /** Artwork title. */
  t: string;
  /** Section name, or null for artworks not filed under one. */
  s: string | null;
  /** Units sold on this line. */
  q: number;
  /** Revenue for this line (price × quantity). */
  r: number;
  /** Artwork thumbnail, for the top-sellers list. */
  p: string;
}

/** A single day in the revenue trend. */
export interface RevenuePoint {
  /** `YYYY-MM-DD` */
  day: string;
  revenue: number;
  /** Distinct orders that day. */
  orders: number;
  units: number;
}

/** A row in either "top artworks" or "top sections". */
export interface TopSeller {
  key: string;
  label: string;
  /** Thumbnail — artworks only; sections have none. */
  imageUrl?: string;
  revenue: number;
  units: number;
}

/**
 * Local-timezone `YYYY-MM-DD` key.
 *
 * `toISOString().slice(0,10)` would bucket by UTC, which shifts every evening
 * order in Manila (UTC+8) into the following day — so a day's takings show up
 * on the wrong bar of the chart.
 */
export function dayKey(date: Date | string): string {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight, `days` days ago, in local time. */
export function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

/**
 * Buckets lines into one point per day across the whole range — including the
 * days that sold nothing, which is the point: a trend line with the empty days
 * dropped silently redraws a quiet week as a busy one.
 *
 * The per-day `seenOrders` sets are what keep a three-item order from
 * registering as three orders in that day's count.
 */
export function buildRevenueTrend(lines: SalesLine[], days: number): RevenuePoint[] {
  const start = startOfDaysAgo(days);
  const points: RevenuePoint[] = [];
  const index = new Map<string, RevenuePoint>();

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const point: RevenuePoint = { day: dayKey(d), revenue: 0, orders: 0, units: 0 };
    points.push(point);
    index.set(point.day, point);
  }

  const seenOrders = new Map<string, Set<string>>();

  for (const line of lines) {
    const point = index.get(line.d);
    if (!point) continue; // outside the selected range
    point.revenue += line.r;
    point.units += line.q;

    let seen = seenOrders.get(line.d);
    if (!seen) {
      seen = new Set();
      seenOrders.set(line.d, seen);
    }
    if (!seen.has(line.o)) {
      seen.add(line.o);
      point.orders += 1;
    }
  }

  return points;
}

/** Groups lines by an arbitrary key and returns the biggest earners first. */
export function topSellers(
  lines: SalesLine[],
  keyOf: (line: SalesLine) => { key: string; label: string; imageUrl?: string } | null,
  limit = 5
): TopSeller[] {
  const totals = new Map<string, TopSeller>();

  for (const line of lines) {
    const id = keyOf(line);
    if (!id) continue;
    const existing = totals.get(id.key);
    if (existing) {
      existing.revenue += line.r;
      existing.units += line.q;
    } else {
      totals.set(id.key, {
        key: id.key,
        label: id.label,
        imageUrl: id.imageUrl,
        revenue: line.r,
        units: line.q,
      });
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .slice(0, limit);
}
