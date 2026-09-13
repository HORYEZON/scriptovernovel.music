// app/api/artworks/[id]/share/route.ts
//
// Public (no admin auth) — fired from ShareButton.tsx whenever a visitor
// actually completes a share action (native share sheet, a platform
// intent link, or copy-link). Just a +1 counter, not a security-sensitive
// mutation, so this is deliberately unauthenticated like a "like" button.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artwork = await prisma.artwork.update({
      where: { id },
      data: { shareCount: { increment: 1 } },
      select: { shareCount: true },
    });
    return NextResponse.json(artwork);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to record share" }, { status: 500 });
  }
}
