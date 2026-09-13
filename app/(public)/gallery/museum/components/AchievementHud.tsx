"use client";

// A small transparent stats card — steps walked, artworks viewed, time
// spent, and artworks wishlisted, grouped in one card. Those are exactly
// the four counters useMuseumAchievements.ts tracks; wishlist was
// deliberately left out here at first (it has its own UI via
// WishlistButton on each artwork panel) but is now shown alongside the
// rest on request, so the card reads as the visit's full scorecard rather
// than three of its four numbers. Independent of the achievements master
// toggle's banners — this only renders when the admin's separate
// achievementsHudEnabled setting is also on (see prisma/schema.prisma's
// DigitalMuseum comment).
import {
  Footprints,
  Eye,
  Clock,
  Heart,
  Star,
  Sparkles,
  MapPin,
  Compass,
  Flag,
  Trophy,
  Bookmark,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MINIMAP_HUD_DEFAULTS, type MinimapHudConfig, type MinimapIconName } from "@/lib/museum/minimapHud";

/** Name → component for the icons an admin can pick per counter. The stored
 *  value is one of these keys and nothing else (sanitizeMinimapHudConfig
 *  enforces it), which is the reason it is a curated list: a free-text icon
 *  name that didn't resolve would render an empty gap rather than an error,
 *  and a counter with no icon reads as broken. */
const MINIMAP_COUNTER_ICONS: Record<MinimapIconName, LucideIcon> = {
  footprints: Footprints,
  eye: Eye,
  clock: Clock,
  heart: Heart,
  star: Star,
  sparkles: Sparkles,
  "map-pin": MapPin,
  compass: Compass,
  flag: Flag,
  trophy: Trophy,
  bookmark: Bookmark,
  activity: Activity,
};

export function minimapCounterIcon(name: MinimapIconName): LucideIcon {
  return MINIMAP_COUNTER_ICONS[name] ?? Footprints;
}

/** Designed size of the row, at 100%. The scale setting is a percentage of
 *  these rather than a free pixel value: the icon and the digits have to
 *  grow together or the row stops reading as one mark plus one number. */
const BASE_ICON_PX = 13;
const BASE_FONT_PX = 12;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function AchievementHud({
  steps,
  views,
  elapsedSeconds,
  wishlistAdds = 0,
  bare = false,
  config = MINIMAP_HUD_DEFAULTS,
}: {
  steps: number;
  views: number;
  elapsedSeconds: number;
  /** Artworks wishlisted *during this visit* — a delta from the count the
   * visitor already had on arrival, not their whole wishlist, so it stays
   * session-scoped like the other three (see useMuseumAchievements.ts's
   * wishlistBaseline). */
  wishlistAdds?: number;
  /** Skips this component's own pill background/border — used when
   * MuseumClient.tsx nests it under MiniMapHud.tsx inside one shared card
   * on desktop, so a visitor sees a single card instead of two separately-
   * bordered boxes stacked with a gap. Mobile (no minimap there) keeps the
   * default standalone pill look. */
  bare?: boolean;
  /** The admin's museum-wide look for the radar card this row belongs to —
   *  the counters' size and which icon each one draws. Defaults to the
   *  values this component shipped with, so a caller that hasn't threaded it
   *  through renders unchanged. */
  config?: MinimapHudConfig;
}) {
  // One knob drives both, so "bigger counters" means the whole row rather
  // than digits that outgrow their icons. Tailwind's own text sizes can't
  // express an arbitrary percentage, hence the inline sizing here — the
  // `sm:` step the row used to carry is folded into the base size, which is
  // what the scale is a percentage of.
  const scale = config.counterScale / 100;
  const iconPx = Math.round(BASE_ICON_PX * scale);
  const fontPx = BASE_FONT_PX * scale;
  const StepsIcon = minimapCounterIcon(config.stepsIcon);
  const ViewsIcon = minimapCounterIcon(config.viewsIcon);
  const TimeIcon = minimapCounterIcon(config.timeIcon);
  const WishlistIcon = minimapCounterIcon(config.wishlistIcon);
  return (
    <div
      className={cn(
        // `tabular-nums` is load-bearing, not typographic polish. These are
        // live counters in a card whose width is its content's: with
        // proportional digits a "1" is narrower than a "0", so every step and
        // every tick of the clock re-measured the row and nudged the card —
        // and on desktop the minimap sits in that same card, so the whole
        // radar visibly shifted while walking. Fixed-advance digits pin it.
        "pointer-events-none flex items-center gap-3 sm:gap-4 text-white font-medium tracking-wide tabular-nums",
        bare
          ? "justify-between"
          : "px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10"
      )}
      style={{ fontSize: `${fontPx}px` }}
    >
      {/* Each number also reserves its own width, because tabular digits only
          fix the jitter *within* a digit count — crossing 999 → "1,000" (or
          9:59 → 10:00) still grew the card mid-walk, which is the jump that
          got reported. `ch` is the advance of one digit, which under
          tabular-nums is the advance of every digit, so these are exact: 5 for
          the two counters that realistically reach four figures, 2 for the two
          that don't. Past those the card grows once more and settles — the
          point is that it can't move on an ordinary step. */}
      <span className="flex items-center gap-1.5">
        <StepsIcon size={iconPx} className="text-emerald-400" />
        <span className="min-w-[5ch]">{steps.toLocaleString()}</span>
      </span>
      <span className="w-px h-3.5 bg-white/15" />
      <span className="flex items-center gap-1.5">
        <ViewsIcon size={iconPx} className="text-sky-400" />
        <span className="min-w-[2ch]">{views.toLocaleString()}</span>
      </span>
      <span className="w-px h-3.5 bg-white/15" />
      <span className="flex items-center gap-1.5">
        <TimeIcon size={iconPx} className="text-amber-400" />
        <span className="min-w-[5ch]">{formatElapsed(elapsedSeconds)}</span>
      </span>
      <span className="w-px h-3.5 bg-white/15" />
      <span className="flex items-center gap-1.5">
        <WishlistIcon size={iconPx} className="text-rose-400" />
        <span className="min-w-[2ch]">{wishlistAdds.toLocaleString()}</span>
      </span>
    </div>
  );
}
