// app/api/chase-companions/[id]/route.ts
//
// PATCH — toggle a companion's enabled flag, or replace its asset
// (admin only). DELETE — remove one entirely, freeing a slot toward the
// 5-companion cap (admin only, hard delete).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

function revalidateCompanionPaths() {
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { enabled?: boolean; assetType?: string; assetUrl?: string } = {};

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.enabled = body.enabled;
    }
    if (body.assetType !== undefined || body.assetUrl !== undefined) {
      if (body.assetType !== "model" && body.assetType !== "image") {
        return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
      }
      const assetUrl = typeof body.assetUrl === "string" ? body.assetUrl.trim() : "";
      if (!assetUrl) {
        return NextResponse.json({ error: "Missing asset URL" }, { status: 400 });
      }
      data.assetType = body.assetType;
      data.assetUrl = assetUrl;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const companion = await prisma.chaseCompanion.update({ where: { id }, data });
    revalidateCompanionPaths();
    return NextResponse.json(companion);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Companion not found" }, { status: 404 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update companion") }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.chaseCompanion.delete({ where: { id } });
    revalidateCompanionPaths();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Companion not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete companion" }, { status: 500 });
  }
}
