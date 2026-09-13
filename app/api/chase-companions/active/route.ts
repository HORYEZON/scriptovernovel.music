// app/api/chase-companions/active/route.ts
//
// GET — public, read-only: every enabled ChaseCompanion, safe fields
// only. Not currently fetched client-side (page.tsx reads this directly
// via Prisma server-side instead, same as every other museum config) —
// kept for parity with the other "active" endpoints in this app
// (faqs/active, marquees/active, digital-museum/achievements/active) in
// case a client-side refetch is ever needed.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const companions = await prisma.chaseCompanion.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, assetType: true, assetUrl: true },
    });
    return NextResponse.json(companions);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
