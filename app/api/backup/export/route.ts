// app/api/backup/export/route.ts
//
// Reads every row of the groups an admin ticked and hands them back as JSON.
//
// Deliberately does *not* build the archive. The browser does that (see
// lib/backup/zip.ts): it also has to fetch every uploaded file from the storage
// CDN, which can run to hundreds of megabytes, and a serverless function
// streaming all of that through itself would be fighting its memory ceiling on
// the one operation that must not fail halfway. This route's job is the part
// only the server can do — read the database.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  BACKUP_FORMAT_VERSION,
  REDACTED_FIELDS,
  groupsFromIds,
  type BackupFile,
} from "@/lib/backup/groups";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";
// A full read of every table takes longer than the default on a large site,
// and a backup that times out three-quarters through is worse than no backup.
export const maxDuration = 60;

type PrismaDelegate = { findMany: (args?: unknown) => Promise<unknown[]> };

function redact(model: string, rows: unknown[]): unknown[] {
  const fields = REDACTED_FIELDS[model];
  if (!fields) return rows;
  return rows.map((row) => {
    const copy = { ...(row as Record<string, unknown>) };
    for (const field of fields) delete copy[field];
    return copy;
  });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const groupIds: string[] = Array.isArray(body?.groups) ? body.groups : [];
    const groups = groupsFromIds(groupIds);
    if (groups.length === 0) {
      return NextResponse.json({ error: "Pick at least one thing to back up" }, { status: 400 });
    }

    const data: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};

    for (const group of groups) {
      for (const model of group.models) {
        const delegate = (prisma as unknown as Record<string, PrismaDelegate>)[model];
        // A model renamed in the schema without being renamed here should show
        // up as a missing table in the manifest, not as a 500 that leaves the
        // admin with no backup at all.
        if (!delegate?.findMany) {
          data[model] = [];
          counts[model] = 0;
          continue;
        }
        // Soft-deleted rows come along on purpose: they're what the Trash
        // module restores from, and a backup that quietly emptied the Trash
        // would be losing data the site still considers recoverable.
        const rows = await delegate.findMany();
        data[model] = redact(model, rows);
        counts[model] = rows.length;
      }
    }

    const payload: BackupFile = {
      manifest: {
        version: BACKUP_FORMAT_VERSION,
        exportedAt: new Date().toISOString(),
        groups: groups.map((g) => g.id),
        counts,
        // The browser flips this when it actually bundles the files; the server
        // has no say in whether media came along.
        includesMedia: false,
      },
      data,
    };

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to build the backup") },
      { status: 500 }
    );
  }
}
