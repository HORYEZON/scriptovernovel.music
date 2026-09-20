// app/api/band-members/route.ts — admin list + create. Same shape as
// app/api/videos.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logContentChange } from "@/lib/activity-log-server";
import { getErrorMessage } from "@/lib/utils";
import { MAX_MEMBER_BLURB, MAX_MEMBER_NAME, MAX_MEMBER_ROLE } from "@/lib/band-members";
import { revalidateMemberPaths } from "@/lib/band-members-server";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    return NextResponse.json(
      await prisma.bandMember.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch band members" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const { name, role, photoUrl, blurb, published } = body;
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    if (name.trim().length > MAX_MEMBER_NAME) return NextResponse.json({ error: `Name is at most ${MAX_MEMBER_NAME} characters.` }, { status: 400 });
    if (typeof role !== "string" || !role.trim()) return NextResponse.json({ error: "Role is required — what they play." }, { status: 400 });
    if (role.trim().length > MAX_MEMBER_ROLE) return NextResponse.json({ error: `Role is at most ${MAX_MEMBER_ROLE} characters.` }, { status: 400 });
    if (blurb !== undefined && blurb !== null && (typeof blurb !== "string" || blurb.length > MAX_MEMBER_BLURB)) {
      return NextResponse.json({ error: `Blurb is at most ${MAX_MEMBER_BLURB} characters.` }, { status: 400 });
    }
    const maxOrder = await prisma.bandMember.aggregate({ _max: { sortOrder: true } });
    const member = await prisma.bandMember.create({
      data: {
        name: name.trim(),
        role: role.trim(),
        photoUrl: typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null,
        blurb: typeof blurb === "string" ? blurb.trim() || null : null,
        published: published !== false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
    revalidateMemberPaths();
    logContentChange("created", "band-member", { id: member.id, name: member.name }, { request });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create band member") }, { status: 500 });
  }
}
