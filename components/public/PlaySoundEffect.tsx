// components/public/PlaySoundEffect.tsx
"use client";

import { useEffect } from "react";
import { playSoundEffect } from "@/lib/sound/engine";

/**
 * Fires a registry sound effect (lib/sound/registry.ts) once, on mount —
 * for pages that are server components and so have nowhere else to run
 * client-side code, like the order success/cancel pages. Renders nothing.
 */
export function PlaySoundEffect({ effectKey }: { effectKey: string }) {
  useEffect(() => {
    playSoundEffect(effectKey);
    // Only ever fire once per mount — a page like order/success never
    // changes which sound it means mid-visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
