// components/public/VideoIndicator.tsx
//
// "This artwork has a timelapse video" affordance. Unlike ArtworkBadge.tsx's
// corner pills (Sold/New Release/Featured already occupy every corner of the
// gallery card, alongside the zoom-in button), this sits centered over the
// thumbnail — a translucent circular play icon, the same convention YouTube/
// Vimeo thumbnails use — so it never collides with the existing corner
// badges and reads correctly on mobile without a hover.
//
// Self-positioning: drop it inside an existing `relative` image wrapper,
// no positioning props needed (`absolute inset-0` fills that wrapper).
import { Play } from "lucide-react";

type IndicatorSize = "sm" | "md";

const SIZE_STYLES: Record<IndicatorSize, { circle: string; icon: number }> = {
  sm: { circle: "w-6 h-6", icon: 10 },
  md: { circle: "w-9 h-9 sm:w-11 sm:h-11", icon: 16 },
};

export function VideoIndicator({ size = "md" }: { size?: IndicatorSize }) {
  const s = SIZE_STYLES[size];
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span
        className={`flex items-center justify-center ${s.circle} rounded-full bg-black/55 border border-white/30 backdrop-blur-sm shadow-[0_2px_10px_rgba(0,0,0,0.4)]`}
      >
        <Play size={s.icon} className="text-white fill-current translate-x-[1px]" />
      </span>
    </div>
  );
}
