// app/api/releases/public/route.ts — the published catalogue, as /music
// shows it. Public, read-only; used by anything that needs releases without
// a server render (the Mini Games' release picker, later phases).
import { NextResponse } from "next/server";
import { getPublicReleases } from "@/lib/releases-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublicReleases());
  } catch {
    return NextResponse.json({ error: "Failed to fetch releases" }, { status: 500 });
  }
}
