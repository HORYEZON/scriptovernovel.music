// app/api/band-members/[id]/route.ts — partial update and soft delete.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { changedFields, logContentChange } from "@/lib/activity-log-server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import { MAX_MEMBER_BLURB, MAX_MEMBER_NAME, MAX_MEMBER_ROLE } from "@/lib/band-members";
import { revalidateMemberPaths } from "@/lib/band-members-server";

const EDITABLE = ["name", "role", "photoUrl", "blurb", "published", "sortOrder"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, role, photoUrl, blurb, published, sortOrder } = body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
      if (name.trim().length > MAX_MEMBER_NAME) return NextResponse.json({ error: `Name is at most ${MAX_MEMBER_NAME} characters.` }, { status: 400 });
      data.name = name.trim();
    }
    if (role !== undefined) {
      if (typeof role !== "string" || !role.trim()) return NextResponse.json({ error: "Role cannot be empty." }, { status: 400 });
      if (role.trim().length > MAX_MEMBER_ROLE) return NextResponse.json({ error: `Role is at most ${MAX_MEMBER_ROLE} characters.` }, { status: 400 });
      data.role = role.trim();
    }
    if (photoUrl !== undefined) data.photoUrl = typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null;
    if (blurb !== undefined) {
      if (blurb !== null && (typeof blurb !== "string" || blurb.length > MAX_MEMBER_BLURB)) return NextResponse.json({ error: `Blurb is at most ${MAX_MEMBER_BLURB} characters.` }, { status: 400 });
      data.blurb = typeof blurb === "string" ? blurb.trim() || null : null;
    }
    if (published !== undefined) {
      if (typeof published !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.published = published;
    }
    if (sortOrder !== undefined) {
      if (!Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.sortOrder = sortOrder;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    const member = await prisma.bandMember.update({ where: { id }, data });
    revalidateMemberPaths();
    logContentChange("updated", "band-member", { id, name: member.name }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json(member);
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Band member not found" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update band member") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deleted = await prisma.bandMember.update({ where: { id }, data: { deletedAt: new Date() }, select: { name: true } });
    revalidateMemberPaths();
    revalidatePath("/admin/trash");
    logContentChange("deleted", "band-member", { id, name: deleted.name }, { request });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to delete band member" }, { status: 500 });
  }
}
