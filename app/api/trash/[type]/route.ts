// app/api/trash/[type]/route.ts
//
// Every trashed row of one type at once — the Trash module's "Restore All"
// and "Empty" buttons.
//
// Scoped to a single type on purpose. The buttons sit inside a category tab
// and act on the list the admin is looking at, so what is about to happen is
// on screen rather than implied; a single "empty the whole Trash" control
// would destroy rows across a dozen modules that were never in view.
//
// Both verbs run per row through the same lib/trash-actions.ts helpers the
// single-item route uses, rather than one bulk `updateMany`/`deleteMany`.
// That is deliberate: restoring a section revives only the rows trashed in
// the same breath, purging a story hunts down its page images but spares a
// cover borrowed from an artwork, purging an event takes its media files.
// A set-based query would silently skip all of it. Trash holds tens of rows,
// not millions, so the extra round-trips are worth the correctness.
//
// A row that fails is counted and skipped rather than aborting the run: with
// twenty items and one bad row, finishing the other nineteen is far more
// useful than rolling back and leaving the admin to guess which one broke.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  isTrashType,
  listTrashedIds,
  restoreTrashItem,
  purgeTrashItem,
  revalidateForTrashType,
} from "@/lib/trash-actions";

export interface BulkTrashResult {
  /** How many rows the verb actually succeeded on. */
  done: number;
  /** How many were attempted and threw — already gone, or a constraint. */
  failed: number;
}

async function runBulk(
  type: string,
  verb: "restore" | "purge"
): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (!isTrashType(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const ids = await listTrashedIds(type);
    let done = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        if (verb === "restore") await restoreTrashItem(type, id);
        else await purgeTrashItem(type, id);
        done++;
      } catch {
        // Most often P2025 — a cascade from an earlier row in this same pass
        // already took this one (purging a Freedom Wall event destroys its
        // notes, which may be sitting in the trash themselves). Not an error
        // worth failing the run over: the row is gone either way.
        failed++;
      }
    }

    // Once for the whole pass, not once per row — see revalidateForTrashType.
    revalidateForTrashType(type);

    return NextResponse.json({ done, failed } satisfies BulkTrashResult);
  } catch {
    return NextResponse.json(
      { error: verb === "restore" ? "Failed to restore items" : "Failed to empty" },
      { status: 500 }
    );
  }
}

// PATCH /api/trash/[type] — restore every trashed row of this type
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  return runBulk(type, "restore");
}

// DELETE /api/trash/[type] — permanently delete every trashed row of this type
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  return runBulk(type, "purge");
}
