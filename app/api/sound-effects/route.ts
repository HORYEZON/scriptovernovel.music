// app/api/sound-effects/route.ts
//
// GET /api/sound-effects — every sound-effect key's playback config, public
// and unauthenticated. Fetched once per page load by lib/sound/engine.ts and
// cached in memory from there, so this stays a single small JSON payload
// rather than something polled.
import { NextResponse } from "next/server";
import { getSoundEffectConfigs } from "@/lib/sound/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSoundEffectConfigs());
  } catch (error) {
    console.error("[sound-effects] failed to load configs", error);
    // Empty map — the engine just treats every key as "no config found" and
    // stays silent, which is preferable to a broken page over a missing sound.
    return NextResponse.json({});
  }
}
