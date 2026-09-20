// app/api/videos/public/route.ts — published videos, as /videos shows them.
import { NextResponse } from "next/server";
import { getPublicVideos } from "@/lib/videos-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublicVideos());
  } catch {
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}
