// lib/museum/deviceTier.ts
//
// One conservative "is this an old phone?" answer, shared by every museum
// optimisation that has to be decided *before* anything renders.
//
// Why a static guess at all, when MuseumScene.tsx already has a real,
// measured fallback (drei's PerformanceMonitor -> `lowPower`, which reacts to
// actual frame timing)? Because the three biggest levers are WebGL *context
// creation* options — antialias and preserveDrawingBuffer are fixed for the
// life of the context, and the dpr ceiling is read once — so by the time a
// measurement exists it's already too late to change them. Anything that can
// be adjusted at runtime should keep using `lowPower` instead of this; this
// exists only for the decisions that can't wait.
//
// The bias is deliberately toward answering "normal". A device wrongly
// called `low` gets quietly worse-looking output for no reason, which is the
// one outcome worth avoiding — whereas an old phone this fails to catch
// still gets picked up by PerformanceMonitor once it actually struggles. So
// every threshold below sits well past "mid-range" and into "genuinely old",
// and a miss is the intended failure mode.

export type DeviceTier = "low" | "normal";

let cached: DeviceTier | null = null;

function detect(): DeviceTier {
  // A precise pointer is a desktop, a laptop, or a tablet with a trackpad —
  // never the target here, and never to be degraded whatever else it reports.
  // A low-power ultrabook or a 2-core cloud VM would trip the CPU heuristic
  // below, so this gate comes first and is absolute.
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return "normal";

  const nav = navigator as Navigator & { deviceMemory?: number };

  // navigator.deviceMemory (Chrome/Android only) reports RAM bucketed to
  // 0.25/0.5/1/2/4/8 and capped at 8. The threshold sits *below* 4 on
  // purpose: 4 GB is an ordinary mid-range phone that runs this fine, so
  // only 2 GB and under counts.
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 2) {
    return "low";
  }

  // Octa-core is standard on Android down to budget chips, so 4 or fewer
  // means genuinely old hardware there. On iOS it lands in the same place:
  // the A10 (iPhone 7, 2016) and earlier report 4 or 2, while the A11 and
  // every chip since report 6 — so current iPhones can't trip this.
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 4) {
    return "low";
  }

  return "normal";
}

/**
 * Memoised — the answer can't change within a session, and several callers
 * (the Canvas's gl options, texture loading, room lighting) need to agree on
 * one value. Returns "normal" during SSR without caching, so the real
 * client-side detection still runs on first use in the browser.
 */
export function getDeviceTier(): DeviceTier {
  if (cached) return cached;
  if (typeof window === "undefined" || typeof navigator === "undefined") return "normal";
  cached = detect();
  return cached;
}

/** True only for old phones — see this module's doc comment. */
export function isLowEndDevice(): boolean {
  return getDeviceTier() === "low";
}
