// lib/museum/vinylConfig.ts
//
// The Vinyl Room's room-wide settings: what the turntable is (the built-in
// procedural deck, or an uploaded .glb), where it stands, the effect
// amounts a record starts with when it's put on, and the Lyrics Wall —
// which wall, whether it's on, its colours. Stored as a kind-marked
// singleton MuseumSceneObject on the Vinyl Room with the JSON in its
// modelUrl column — the exact "config, not a placement" pattern of
// arcadeConfig.ts (read that file's header first). The museum page parses
// it onto the room (MuseumRoomPublic.vinylConfig), so the row itself never
// travels to the browser.
//
// Client-safe (no prisma) so MuseumScene, the Scene Editor and the API
// route all import it. DB provisioning lives in vinylRoom.ts.

export const VINYL_CONFIG_KIND = "vinyl-room-config";

export type LyricsWallSide = "north" | "east" | "west";

/** Effect amounts, 0–1, plus the platter speed in rpm. */
export interface VinylEffects {
  reverb: number;
  lofi: number;
  crackle: number;
  delay: number;
  speed: 33 | 45 | 78;
  /** ±0.08 fine adjustment on top of the nominal speed. */
  fine: number;
}

export interface VinylRoomConfig {
  /** Uploaded .glb standing in for the procedural deck (origin on the floor
   *  at the deck's centre, facing +Z). Null = built-in. */
  turntableModelUrl: string | null;
  /** Room-local X/Z and facing; null = auto (centre of the room, facing the door). */
  turntable: { x: number; z: number; rotationY: number } | null;
  defaultEffects: VinylEffects;
  lyricsWall: {
    enabled: boolean;
    wall: LyricsWallSide;
    textColor: string;
    glowColor: string;
  };
}

export const DEFAULT_VINYL_EFFECTS: VinylEffects = {
  reverb: 0.25,
  lofi: 0,
  crackle: 0.15,
  delay: 0,
  speed: 33,
  fine: 0,
};

export const DEFAULT_VINYL_CONFIG: VinylRoomConfig = {
  turntableModelUrl: null,
  turntable: null,
  defaultEffects: DEFAULT_VINYL_EFFECTS,
  lyricsWall: { enabled: true, wall: "north", textColor: "#F5F1E8", glowColor: "#c8a96e" },
};

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const finiteOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const hexOr = (v: unknown, fallback: string) => (typeof v === "string" && HEX_RE.test(v) ? v : fallback);

export function sanitizeVinylEffects(raw: unknown, base: VinylEffects = DEFAULT_VINYL_EFFECTS): VinylEffects {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VinylEffects, unknown>>;
  const speed = r.speed === 45 || r.speed === 78 || r.speed === 33 ? r.speed : base.speed;
  return {
    reverb: clamp01(r.reverb, base.reverb),
    lofi: clamp01(r.lofi, base.lofi),
    crackle: clamp01(r.crackle, base.crackle),
    delay: clamp01(r.delay, base.delay),
    speed,
    fine: Math.min(0.08, Math.max(-0.08, finiteOr(r.fine, base.fine))),
  };
}

export function parseVinylConfig(raw: string | null | undefined): VinylRoomConfig {
  if (!raw) return structuredClone(DEFAULT_VINYL_CONFIG);
  try {
    const p = JSON.parse(raw) as Partial<VinylRoomConfig>;
    const t = p.turntable && typeof p.turntable === "object" ? p.turntable : null;
    const lw = (p.lyricsWall && typeof p.lyricsWall === "object" ? p.lyricsWall : {}) as Partial<VinylRoomConfig["lyricsWall"]>;
    return {
      turntableModelUrl: typeof p.turntableModelUrl === "string" && p.turntableModelUrl ? p.turntableModelUrl : null,
      turntable: t ? { x: finiteOr(t.x, 0), z: finiteOr(t.z, 0), rotationY: finiteOr(t.rotationY, 0) } : null,
      defaultEffects: sanitizeVinylEffects(p.defaultEffects),
      lyricsWall: {
        enabled: lw.enabled !== false,
        wall: lw.wall === "east" || lw.wall === "west" ? lw.wall : "north",
        textColor: hexOr(lw.textColor, DEFAULT_VINYL_CONFIG.lyricsWall.textColor),
        glowColor: hexOr(lw.glowColor, DEFAULT_VINYL_CONFIG.lyricsWall.glowColor),
      },
    };
  } catch {
    return structuredClone(DEFAULT_VINYL_CONFIG);
  }
}

export function serializeVinylConfig(config: VinylRoomConfig): string {
  return JSON.stringify(parseVinylConfig(JSON.stringify(config)));
}

/** Platter speed → playbackRate, 33⅓ being "as recorded". */
export function playbackRateFor(effects: Pick<VinylEffects, "speed" | "fine">): number {
  return (effects.speed / (100 / 3)) * (1 + effects.fine);
}
