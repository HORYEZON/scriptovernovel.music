// app/api/chase-companions/route.ts
//
// Admin CRUD for Chase Companions (Artworks ▸ Digital Museum ▸ General —
// ChaseCompanionsSection.tsx) — up to 5 rows, each independently
// enabled/disabled. See prisma/schema.prisma's ChaseCompanion comment and
// app/api/chase-companions/active/route.ts for the public, enabled-only
// view the museum actually renders from.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";

const MAX_COMPANIONS = 5;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const companions = await prisma.chaseCompanion.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(companions);
  } catch {
    return NextResponse.json({ error: "Failed to fetch companions" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const assetType = body.assetType;
    const assetUrl = typeof body.assetUrl === "string" ? body.assetUrl.trim() : "";

    if (assetType !== "model" && assetType !== "image") {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 });
    }
    if (!assetUrl) {
      return NextResponse.json({ error: "Missing asset URL" }, { status: 400 });
    }

    const count = await prisma.chaseCompanion.count();
    if (count >= MAX_COMPANIONS) {
      return NextResponse.json(
        { error: `You already have ${MAX_COMPANIONS} companions — remove one before adding another` },
        { status: 409 }
      );
    }

    const companion = await prisma.chaseCompanion.create({ data: { assetType, assetUrl } });

    revalidatePath("/admin/artworks");
    revalidatePath("/gallery/museum");
    return NextResponse.json(companion, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create companion") }, { status: 500 });
  }
}
