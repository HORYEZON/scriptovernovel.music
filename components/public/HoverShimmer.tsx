// components/public/HoverShimmer.tsx
//
// The admin-tunable hover light-sweep for the public grids (Gallery section
// cards, Tales covers, Shop product cards). Drop it inside a card's
// `relative overflow-hidden` image box, on a `group` ancestor — it fills the
// box and stays invisible until the group is hovered, then the band sweeps
// across from the left for as long as the pointer stays.
//
// Sweeps only on hover rather than running invisibly all the time: the
// animation class is itself hover-gated, so each hover starts a fresh pass
// from the edge instead of fading in on whatever frame the loop happened to
// be at. The static (un-animated) band would sit across the card's middle,
// hence the opacity gate alongside it.
//
// Colour, speed and brightness come from Settings → Preferences → Branding →
// Hover Shimmer (lib/hover-shimmer.ts); brightness 0 renders nothing at all.

import { shimmerBandStyle, type ShimmerSettings } from "@/lib/hover-shimmer";

export function HoverShimmer({ settings }: { settings: ShimmerSettings }) {
  if (settings.brightness <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] opacity-0 group-hover:opacity-100 group-hover:animate-shimmer transition-opacity duration-300"
      style={shimmerBandStyle(settings)}
    />
  );
}
