// app/api/digital-museum/preview-about/route.ts
//
// Admin-only endpoint that returns MuseumAboutData so the Museum Preview
// sidebar can render the About ScriptOverNovel room contents without importing
// Prisma into a client component. Uses the same getAboutData() helper as
// the public museum page and the Museum Scene Editor.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getAboutData } from "@/lib/museum/getAboutData";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const data = await getAboutData();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch About data" }, { status: 500 });
  }
}
