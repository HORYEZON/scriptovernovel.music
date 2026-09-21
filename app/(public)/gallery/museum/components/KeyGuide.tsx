"use client";

const KEYS: { key: string; label: string }[] = [
  { key: "E", label: "View / Interact" },
  { key: "M", label: "Open Map" },
  { key: "L", label: "Light / Dark" },
  { key: "H", label: "Hide HUD" },
  { key: "R", label: "Save Photo" },
  { key: "Q", label: "Filter Vision" },
  { key: "Space", label: "Jump" },
];

// Plain row of key badges — no timer, no positioning of its own. Lives
// inside MuseumScene.tsx's "Click to look around" card (desktop only,
// shown pre-pointer-lock) so the whole keyboard cheat-sheet disappears the
// moment a visitor actually starts looking around, instead of an arbitrary
// timer that could cut off mid-read or linger after they've moved on.
export function KeyGuide() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-7">
      {KEYS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2.5">
          <kbd className="min-w-8 h-8 px-2 flex items-center justify-center rounded-lg bg-white/15 text-white font-mono text-sm font-medium">
            {key}
          </kbd>
          <span className="font-body text-xs text-white/70 whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  );
}
