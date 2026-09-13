// app/api/artist-skills/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const skills = await prisma.artistSkill.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(skills);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const skills: { name: string; hoverColor: string; sortOrder: number }[] =
      body.skills;

    if (!Array.isArray(skills)) {
      return NextResponse.json(
        { error: "Invalid payload: expected { skills: [...] }" },
        { status: 400 }
      );
    }

    // Replace all in a transaction: delete existing → create new
    const result = await prisma.$transaction(async (tx) => {
      await tx.artistSkill.deleteMany();
      if (skills.length > 0) {
        await tx.artistSkill.createMany({
          data: skills.map((skill, i) => ({
            name: skill.name,
            hoverColor: skill.hoverColor || "#FFE135",
            sortOrder: skill.sortOrder ?? i,
          })),
        });
      }
      return tx.artistSkill.findMany({ orderBy: { sortOrder: "asc" } });
    });

    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[PUT /api/artist-skills]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
