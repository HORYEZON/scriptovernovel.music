// app/api/digital-museum/achievements/active/route.ts
//
// GET — public, read-only: every enabled MuseumAchievement, safe fields
// only. The museum client (lib/museum/useMuseumAchievements.ts) fetches
// this once on entry to know which category/threshold pairs to watch for
// during the session — see that hook's doc comment for why reward text
// is included up front rather than hidden until earned (unlike Visitor
// Milestones' achieved-only public API, there's no server-tracked
// progress here to gate a reveal on).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const achievements = await prisma.museumAchievement.findMany({
      where: { enabled: true },
      orderBy: [{ category: "asc" }, { threshold: "asc" }],
      select: { id: true, category: true, threshold: true, reward: true },
    });
    return NextResponse.json(achievements);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
