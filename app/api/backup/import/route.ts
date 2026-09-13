// app/api/backup/import/route.ts
//
// Writes a backup's rows back into the database.
//
// Upsert by primary key, never delete: a restore adds back what's missing and
// overwrites what's there, and leaves anything created since the backup alone.
// That is the behaviour that can't lose work — "make the database look exactly
// like the file" would silently destroy every row added after the export, which
// is not something an admin clicking Restore is asking for.
//
// Order matters and is not this route's to guess: BACKUP_GROUPS lists its
// models parents-first, and the groups themselves are ordered so the museum's
// join rows land after the artworks, stories, games and cosplays they point at.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { groupsFromIds } from "@/lib/backup/groups";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PrismaDelegate = {
  upsert: (args: unknown) => Promise<unknown>;
};

export interface ImportReport {
  restored: Record<string, number>;
  /** model → the rows that wouldn't go in, with the reason. Never fatal: one
   *  bad row shouldn't abandon the other four thousand. */
  skipped: { model: string; id: string; reason: string }[];
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const groupIds: string[] = Array.isArray(body?.groups) ? body.groups : [];
    const data = body?.data as Record<string, unknown[]> | undefined;
    const groups = groupsFromIds(groupIds);

    if (groups.length === 0 || !data || typeof data !== "object") {
      return NextResponse.json({ error: "Nothing to restore" }, { status: 400 });
    }

    const report: ImportReport = { restored: {}, skipped: [] };

    for (const group of groups) {
      for (const model of group.models) {
        const rows = data[model];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const delegate = (prisma as unknown as Record<string, PrismaDelegate>)[model];
        if (!delegate?.upsert) continue;

        let restored = 0;
        for (const raw of rows) {
          const row = raw as Record<string, unknown>;
          const id = row?.id;
          if (typeof id !== "string" && typeof id !== "number") {
            report.skipped.push({
              model,
              id: String(id ?? "?"),
              reason: "row has no id to match on",
            });
            continue;
          }
          try {
            // `create` and `update` get the same object because the row is the
            // whole truth either way — this is a restore, not a merge of two
            // versions. Dates arrive as ISO strings over JSON and Prisma wants
            // Date objects, so they're revived on the way in (see reviveDates).
            const values = reviveDates(row);
            await delegate.upsert({
              where: { id },
              create: values,
              update: values,
            });
            restored++;
          } catch (error) {
            report.skipped.push({
              model,
              id: String(id),
              reason: getErrorMessage(error, "write failed"),
            });
          }
        }
        report.restored[model] = restored;
      }
    }

    // Everything public reads from these tables, and force-dynamic pages aside,
    // a restore changes essentially the whole site at once.
    revalidatePath("/", "layout");

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Restore failed") },
      { status: 500 }
    );
  }
}

/**
 * ISO date strings back into Date objects.
 *
 * JSON has no date type, so every `createdAt`, `deletedAt` and `year`-adjacent
 * timestamp arrives as a string and Prisma rejects it. Matched on the value's
 * shape rather than on a list of column names, for the same reason
 * collectMediaUrls walks blindly: a per-column list would be missing whichever
 * timestamp was added to the schema last. The pattern is strict enough (full
 * ISO-8601 with a `T` and a zone) that ordinary admin-typed text can't trip it.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reviveDates(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value;
  }
  return out;
}
