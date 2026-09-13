// app/(admin)/admin/settings/Preferences/SoundClient.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SOUND_CATEGORIES, type SoundCategory } from "@/lib/sound/registry";
import type { AdminSoundEffect } from "@/lib/sound/server";
import { SoundEffectCard } from "./SoundEffectCard";

/**
 * The Sound admin module — every sound effect on the site, grouped into
 * tabs by category (Toast, Payment, Minigame, Admin Actions). Each key gets
 * its own card (SoundEffectCard) that saves independently, so adjusting one
 * sound never risks another's unsaved edits.
 */
export function SoundClient({ effects }: { effects: AdminSoundEffect[] }) {
  const [tab, setTab] = useState<SoundCategory>(SOUND_CATEGORIES[0].id);

  const inTab = effects.filter((effect) => effect.category === tab);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-black/10 dark:border-white/10 overflow-x-auto">
        {SOUND_CATEGORIES.map((category) => {
          const active = tab === category.id;
          const count = effects.filter((effect) => effect.category === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setTab(category.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 px-4 py-2.5 font-jakarta text-sm font-medium transition-colors border-b-2 -mb-px",
                active
                  ? "border-sepia text-ink dark:text-cream"
                  : "border-transparent text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
              )}
            >
              {category.label}
              <span className="font-mono text-[10px] text-ink-400 dark:text-ink-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {inTab.map((effect) => (
          <SoundEffectCard key={effect.key} effect={effect} />
        ))}
      </div>
    </div>
  );
}
