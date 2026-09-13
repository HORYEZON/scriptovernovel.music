// app/api/social-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const links = await prisma.socialLink.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(links);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const links: {
      label: string;
      url: string;
      iconKey: string;
      hoverColor: string;
      sortOrder: number;
    }[] = body.links;

    if (!Array.isArray(links)) {
      return NextResponse.json(
        { error: "Invalid payload: expected { links: [...] }" },
        { status: 400 }
      );
    }

    // Replace all in a transaction: delete existing → create new
    const result = await prisma.$transaction(async (tx) => {
      await tx.socialLink.deleteMany();
      if (links.length > 0) {
        await tx.socialLink.createMany({
          data: links.map((link, i) => ({
            label: link.label,
            url: link.url,
            iconKey: link.iconKey,
            hoverColor: link.hoverColor || "#FFE135",
            sortOrder: link.sortOrder ?? i,
          })),
        });
      }
      return tx.socialLink.findMany({ orderBy: { sortOrder: "asc" } });
    });

    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/social-links]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
