// app/api/trash/[type]/[id]/route.ts
//
// One trashed row: restore it, or destroy it for good.
//
// What either verb *means* per type — the cascades, the storage cleanup, the
// paths to revalidate — lives in lib/trash-actions.ts, because the per-tab
// "Restore All" / "Empty" buttons in the Trash module need exactly the same
// behaviour and that logic must not exist twice (see that file's header).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getErrorCode } from "@/lib/utils";
import {
  isTrashType,
  restoreTrashItem,
  purgeTrashItem,
  revalidateForTrashType,
} from "@/lib/trash-actions";

// PATCH /api/trash/[type]/[id] — restore item (set deletedAt = null)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { type, id } = await params;
    if (!isTrashType(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    await restoreTrashItem(type, id);
    revalidateForTrashType(type);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to restore" }, { status: 500 });
  }
}

// DELETE /api/trash/[type]/[id] — permanently delete item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { type, id } = await params;
    if (!isTrashType(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    await purgeTrashItem(type, id);
    revalidateForTrashType(type);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
