// app/api/announcements/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";

// GET /api/announcements - list all (admin)
export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      where: { deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(announcements);
  } catch {
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}

// POST /api/announcements - create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { title, message, imageUrl, linkUrl, linkLabel, startDate, endDate, isHidden, priority } = body;

    if (!title || !startDate || !endDate) {
      return NextResponse.json({ error: "Title, start date, and end date are required." }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date format." }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: "End date and time must be after start date and time." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        message: message ? message.trim() : null,
        imageUrl: imageUrl || null,
        linkUrl: linkUrl ? linkUrl.trim() : null,
        linkLabel: linkLabel ? linkLabel.trim() : "Click here to check more info",
        startDate: start,
        endDate: end,
        isHidden: isHidden ?? false,
        priority: typeof priority === "number" ? priority : 0,
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create announcement") }, { status: 500 });
  }
}
