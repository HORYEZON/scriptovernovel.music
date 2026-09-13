// app/api/marquees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizeMarquee } from "@/lib/marquee";
import { getErrorMessage } from "@/lib/utils";

// GET /api/marquees - list all (admin)
export async function GET() {
  try {
    const marquees = await prisma.marqueeAnnouncement.findMany({
      where: { deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(marquees);
  } catch {
    return NextResponse.json({ error: "Failed to fetch marquees" }, { status: 500 });
  }
}

// POST /api/marquees - create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const result = sanitizeMarquee(await request.json());
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const marquee = await prisma.marqueeAnnouncement.create({ data: result.data });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");

    return NextResponse.json(marquee, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to create marquee") },
      { status: 500 }
    );
  }
}
