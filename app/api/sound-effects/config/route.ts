// app/api/sound-effects/config/route.ts
//
// GET — every sound-effect key with its category/label/description and
// current configuration, for the admin Sound settings page.
// PUT — save one key's configuration.
//
// Both are admin-only, mirroring /api/minigames/config's shape exactly.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { isSoundEffectKey } from "@/lib/sound/registry";
import { buildAdminSoundEffects } from "@/lib/sound/server";
import {
  clampSoundDurationMs,
  clampSoundFrequency,
  clampSoundVolume,
  sanitizeSoundPreset,
  sanitizeSoundSource,
  sanitizeSoundUrl,
  sanitizeWaveform,
} from "@/lib/sound/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json({ effects: await buildAdminSoundEffects() });
  } catch (error) {
    console.error("[sound-effects] failed to load admin config", error);
    return NextResponse.json(
      { error: "Failed to load sound settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => null);
    const key = (body as { key?: unknown } | null)?.key;
    if (!isSoundEffectKey(key)) {
      return NextResponse.json({ error: "Unknown sound effect." }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const data = {
      enabled: Boolean(raw.enabled),
      source: sanitizeSoundSource(raw.source),
      preset: sanitizeSoundPreset(raw.preset),
      url: sanitizeSoundUrl(raw.url),
      volume: clampSoundVolume(raw.volume),
      waveform: sanitizeWaveform(raw.waveform),
      frequency: clampSoundFrequency(raw.frequency),
      durationMs: clampSoundDurationMs(raw.durationMs),
    };

    await prisma.soundEffect.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });

    revalidatePath("/admin/settings/sound");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[sound-effects] failed to save config", error);
    return NextResponse.json(
      { error: "Could not save these settings." },
      { status: 500 }
    );
  }
}
