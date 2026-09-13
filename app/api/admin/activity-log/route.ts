// app/api/admin/activity-log/route.ts
//
// GET    — a filtered, sorted, paginated page of the audit trail, plus the
//          per-category counts the panel's filter pills show and the total
//          row count its numbered pager needs.
// DELETE — purge. `?before=<ISO>` drops everything older than that date;
//          `?category=X` narrows it; with neither, it force-runs the ordinary
//          retention prune rather than wiping the table, because "clear the
//          log" is not a thing an audit trail should offer in one click.
//
// Backs components/admin/ActivityLogPanel.tsx (Dashboard ▸ Activity Log).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity, pruneActivityLogs } from "@/lib/activity-log-server";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_SORT_FIELDS,
  type ActivityCategory,
  type ActivitySortField,
} from "@/lib/activity-log";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function parseCategory(value: string | null): ActivityCategory | null {
  return value && (ACTIVITY_CATEGORIES as readonly string[]).includes(value)
    ? (value as ActivityCategory)
    : null;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const category = parseCategory(params.get("category"));
  const action = params.get("action")?.trim() || null;
  const actorType = params.get("actorType")?.trim() || null;
  const search = params.get("q")?.trim() || null;

  // Offset pagination with a total count, so the panel can offer the same
  // numbered pager every other admin list has (Orders, Artworks, Products…).
  // Those modules fetch their whole table and slice it in the browser; this
  // one can't — the trail is unbounded by design and includes visitor events
  // — so the identical UI is served from a real LIMIT/OFFSET instead.
  const pageSize = Math.min(
    100,
    Math.max(1, Number(params.get("pageSize")) || ACTIVITY_PAGE_SIZE)
  );
  const page = Math.max(1, Number(params.get("page")) || 1);

  // Only these three are sortable, and each is indexed — an admin sorting a
  // million-row table by an unindexed column is a request that never returns.
  const sortField = ACTIVITY_SORT_FIELDS.includes(params.get("sort") as ActivitySortField)
    ? (params.get("sort") as ActivitySortField)
    : "createdAt";
  const sortOrder = params.get("order") === "asc" ? "asc" : "desc";

  const where: Prisma.ActivityLogWhereInput = {
    ...(category ? { category } : {}),
    ...(action ? { action } : {}),
    ...(actorType ? { actorType } : {}),
    ...(search
      ? {
          OR: [
            { summary: { contains: search, mode: "insensitive" as const } },
            { actorLabel: { contains: search, mode: "insensitive" as const } },
            { actorEmail: { contains: search, mode: "insensitive" as const } },
            { entityId: search },
            { ipAddress: search },
          ],
        }
      : {}),
  };

  try {
    const [rows, total, counts] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        // `id` as a tiebreaker: createdAt has a real chance of collisions
        // here (a request that logs two events does so in the same
        // millisecond), and without a stable second key those rows can swap
        // places between page 1 and page 2 — showing one twice and hiding
        // the other.
        orderBy: [{ [sortField]: sortOrder }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activityLog.count({ where }),
      // Counts are unfiltered by category on purpose — the pills need to show
      // how many rows each category holds *given the other filters*, which is
      // what makes them useful for narrowing rather than just decorative.
      prisma.activityLog.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { ...where, category: undefined },
      }),
    ]);

    // Opportunistic retention enforcement — see pruneActivityLogs' comment on
    // why this rides along with the panel's own reads instead of a cron.
    // Deliberately not awaited: the admin's page should not wait on a delete.
    void pruneActivityLogs();

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: Object.fromEntries(
        ACTIVITY_CATEGORIES.map((c) => [
          c,
          counts.find((row) => row.category === c)?._count._all ?? 0,
        ])
      ),
    });
  } catch (error) {
    console.error("[activity-log] failed to list", error);
    return NextResponse.json({ error: "Could not load the activity log." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const category = parseCategory(params.get("category"));
  const beforeRaw = params.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : null;

  if (beforeRaw && (!before || Number.isNaN(before.getTime()))) {
    return NextResponse.json({ error: "Invalid `before` date." }, { status: 400 });
  }

  try {
    // No `before` and no `category` means "tidy up", not "erase the trail" —
    // run the ordinary retention windows immediately instead.
    if (!before && !category) {
      const removed = await pruneActivityLogs(true);
      void logActivity({
        category: "SYSTEM",
        action: "activity-log.pruned",
        summary: `Ran retention prune on the activity log — removed ${removed} row${removed === 1 ? "" : "s"}.`,
        metadata: { removed },
        request,
      });
      return NextResponse.json({ removed, mode: "prune" });
    }

    const result = await prisma.activityLog.deleteMany({
      where: {
        ...(category ? { category } : {}),
        ...(before ? { createdAt: { lt: before } } : {}),
      },
    });

    // The purge itself is an auditable act, so it goes into the very log it
    // just trimmed — written after the delete so it can't be caught by it.
    void logActivity({
      category: "SYSTEM",
      action: "activity-log.purged",
      summary: `Purged ${result.count} activity log row${result.count === 1 ? "" : "s"}${
        category ? ` in ${category}` : ""
      }${before ? ` older than ${before.toISOString().slice(0, 10)}` : ""}.`,
      metadata: { removed: result.count, category, before: before?.toISOString() ?? null },
      request,
    });

    return NextResponse.json({ removed: result.count, mode: "purge" });
  } catch (error) {
    console.error("[activity-log] failed to purge", error);
    return NextResponse.json({ error: "Could not purge the activity log." }, { status: 500 });
  }
}
