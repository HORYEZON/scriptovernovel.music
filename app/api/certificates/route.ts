// app/api/certificates/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/certificates — list all
export async function GET() {
  try {
    const certificates = await prisma.certificateAward.findMany({
      orderBy: { displayOrder: "asc" },
    });
    return NextResponse.json(certificates);
  } catch {
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 });
  }
}

// POST /api/certificates — create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { title, issuer, dateAwarded, description, imageUrl } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const maxOrder = await prisma.certificateAward.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const cert = await prisma.certificateAward.create({
      data: {
        title: title.trim(),
        issuer: issuer?.trim() || null,
        dateAwarded: dateAwarded ? new Date(dateAwarded) : null,
        description: description?.trim() || null,
        imageUrl: imageUrl || null,
        displayOrder,
      },
    });

    return NextResponse.json(cert, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create certificate" }, { status: 500 });
  }
}
