// app/api/certificates/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { deleteArtworkImage } from "@/lib/supabase/storage";
import { getErrorCode } from "@/lib/utils";

// PATCH /api/certificates/:id — update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, issuer, dateAwarded, description, imageUrl, displayOrder } = body;

    const data: Prisma.CertificateAwardUpdateInput = {};
    if (title !== undefined) data.title = title.trim();
    if (issuer !== undefined) data.issuer = issuer?.trim() || null;
    if (dateAwarded !== undefined) data.dateAwarded = dateAwarded ? new Date(dateAwarded) : null;
    if (description !== undefined) data.description = description?.trim() || null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl || null;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const cert = await prisma.certificateAward.update({
      where: { id },
      data,
    });

    return NextResponse.json(cert);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/certificates/:id — delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    // Clean up image from storage if exists
    const cert = await prisma.certificateAward.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    await prisma.certificateAward.delete({ where: { id } });

    if (cert?.imageUrl) {
      deleteArtworkImage(cert.imageUrl).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
