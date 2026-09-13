// components/public/ArtworkBadge.tsx
//
// Shared "Featured" / "New Release" pill for artwork thumbnails — used by
// GalleryClient, ArtworkDetailModal, FeaturedCarousel and ArtworkPageClient
// so the "one of a kind" treatment reads the same everywhere on the site.
// Callers keep their own absolute-positioning wrapper (top/bottom/left/right
// varies per layout); this component is just the pill itself.
import type { ReactNode } from "react";
import { Star, Sparkles, Flame } from "lucide-react";

type BadgeSize = "sm" | "md";

const SIZE_STYLES: Record<BadgeSize, { icon: number; text: string; pad: string; gap: string }> = {
  sm: { icon: 10, text: "text-[10px]", pad: "px-2.5 py-1", gap: "gap-1" },
  md: { icon: 12, text: "text-xs", pad: "px-3.5 py-1.5", gap: "gap-1.5" },
};

function BadgeShell({
  size,
  gradient,
  border,
  glow,
  shimmer,
  icon,
  label,
}: {
  size: BadgeSize;
  gradient: string;
  border: string;
  glow: string;
  shimmer: string;
  icon: ReactNode;
  label: string;
}) {
  const s = SIZE_STYLES[size];
  return (
    <span
      className={`relative inline-flex items-center ${s.gap} ${s.pad} overflow-hidden rounded-full border ${border} bg-gradient-to-br ${gradient} ${glow} backdrop-blur-sm`}
    >
      {/* Light sweep — the same shimmer keyframe used on the About page's
          gilded accents, kept subtle so it reads as a glint, not a loading bar */}
      <span
        className={`absolute inset-0 bg-gradient-to-r from-transparent ${shimmer} to-transparent animate-shimmer pointer-events-none`}
      />
      <span className="relative drop-shadow-[0_0_4px_rgba(255,255,255,0.65)]">
        {icon}
      </span>
      <span
        className={`relative font-body ${s.text} font-medium tracking-[0.2em] uppercase text-white`}
      >
        {label}
      </span>
    </span>
  );
}

export function FeaturedBadge({ size = "md" }: { size?: BadgeSize }) {
  const s = SIZE_STYLES[size];
  return (
    <BadgeShell
      size={size}
      gradient="from-sepia-dark via-sepia to-sepia-light/90"
      border="border-sepia-light/60"
      glow="shadow-[0_2px_16px_-2px_rgba(200,169,110,0.65)]"
      shimmer="via-white/45"
      icon={<Star size={s.icon} className="text-white fill-current" />}
      label="Featured"
    />
  );
}

/**
 * "Last One" — the shop's final-unit warning (ShopClient.tsx).
 *
 * Deliberately the loudest of the three: the vermillion gradient and glow are
 * the Mini Games launcher button's (MiniGamesLauncher.tsx), and the light
 * sweep is turned up from Featured's via-white/45 to /55. That's the whole
 * intensity dial — no extra keyframe, no pulse. A second animation competing
 * with the sweep is what would tip this from urgent into loud, and it sits on
 * a product photo the visitor is meant to be looking at.
 */
export function LastOneBadge({ size = "sm" }: { size?: BadgeSize }) {
  const s = SIZE_STYLES[size];
  return (
    <BadgeShell
      size={size}
      gradient="from-red-900 via-vermillion to-red-400/90"
      border="border-red-300/60"
      glow="shadow-[0_2px_18px_-2px_rgba(217,79,56,0.75)]"
      shimmer="via-white/55"
      icon={<Flame size={s.icon} className="text-white fill-current" />}
      label="Last One"
    />
  );
}

export function NewReleaseBadge({ size = "md" }: { size?: BadgeSize }) {
  const s = SIZE_STYLES[size];
  return (
    <BadgeShell
      size={size}
      gradient="from-indigo-700 via-indigo-500 to-indigo-400/90"
      border="border-indigo-300/60"
      glow="shadow-[0_2px_16px_-2px_rgba(99,102,241,0.65)]"
      shimmer="via-white/40"
      icon={<Sparkles size={s.icon} className="text-white fill-current" />}
      label="New Release"
    />
  );
}
