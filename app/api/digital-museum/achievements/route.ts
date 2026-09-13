// app/api/digital-museum/achievements/route.ts
//
// Admin CRUD for Digital Museum Achievements (Artworks ▸ Digital Museum ▸
// Achievements tab) — GET lists every achievement (any category, enabled
// or not) with its claim count; POST creates one. See
// prisma/schema.prisma's MuseumAchievement comment and
// app/api/digital-museum/achievements/active/route.ts for the public,
// enabled-only view.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

const CATEGORIES = ["time", "views", "wishlist", "steps"] as const;
const MAX_REWARD_LENGTH = 300;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const achievements = await prisma.museumAchievement.findMany({
      orderBy: [{ category: "asc" }, { threshold: "asc" }],
      include: { _count: { select: { claims: true } } },
    });
    return NextResponse.json(achievements);
  } catch {
    return NextResponse.json({ error: "Failed to fetch achievements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category : "";
    const threshold = Number(body.threshold);
    const reward = typeof body.reward === "string" ? body.reward.trim() : "";

    if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!Number.isInteger(threshold) || threshold <= 0) {
      return NextResponse.json({ error: "Threshold must be a positive whole number" }, { status: 400 });
    }
    if (!reward || reward.length > MAX_REWARD_LENGTH) {
      return NextResponse.json(
        { error: `Reward description is required (max ${MAX_REWARD_LENGTH} characters)` },
        { status: 400 }
      );
    }

    const achievement = await prisma.museumAchievement.create({
      data: { category, threshold, reward },
    });

    revalidatePath("/admin/artworks");
    revalidatePath("/gallery/museum");
    return NextResponse.json(achievement, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "An achievement already exists at that category + threshold" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create achievement") }, { status: 500 });
  }
}
