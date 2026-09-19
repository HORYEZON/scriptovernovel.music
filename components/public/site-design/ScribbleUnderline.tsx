// components/public/site-design/ScribbleUnderline.tsx
//
// The hand-drawn stroke the menu overlay draws through a hovered link. At
// rest it is fully hidden; on hover it "writes itself" left-to-right and
// retracts the same way on leave.
//
// The reveal is a CSS clip-path on the <svg> (a rect that grows from the
// left) plus opacity as a hard floor — deliberately NOT a stroke-dasharray/
// -dashoffset draw. Dash tricks broke here twice: `pathLength` isn't
// reliably applied to CSS dash rendering, and with vector-effect
// non-scaling-stroke browsers interpret the dash array in *screen* pixels,
// so a dash measured from getTotalLength() (path units) tiled across the
// stretched path as dash·gap·dash instead of hiding it. Clipping is
// geometry-agnostic, so it can't fall into either.
//
// Stretched to the link's box with preserveAspectRatio="none" so one path per
// style fits any word length; vector-effect="non-scaling-stroke" keeps the
// stroke from being squashed with it, and the stroke width is in em so it
// tracks the menu's font size (a 6rem word gets a fatter stroke than a
// 3rem one, as a marker would).
import type { UnderlineStyle } from "@/lib/site-design";

// All in a 0 0 100 24 box. Each starts a touch below the text's visual
// centre and wanders — none is level, which is what reads as hand-drawn.
const PATHS: Record<Exclude<UnderlineStyle, "none">, string> = {
  scribble: "M1 15 C 14 10, 30 17, 47 12 S 78 7, 99 14",
  wave: "M1 12 C 12 3, 22 21, 34 12 S 55 3, 66 12 S 88 21, 99 12",
  straight: "M1 14 L 99 10",
  arc: "M1 18 C 30 16, 62 10, 99 3",
};

// Generous vertical/horizontal slack so the round caps and any stroke that
// wanders past the 24-unit box (overflow is visible) aren't clipped; only
// the right edge moves. 110% on the right collapses the rect to nothing.
const CLIP_SHOWN = "inset(-100% -10% -100% -10%)";
const CLIP_HIDDEN = "inset(-100% 110% -100% -10%)";

export function ScribbleUnderline({
  style,
  color,
  active,
  className,
}: {
  style: UnderlineStyle;
  color: string;
  active: boolean;
  className?: string;
}) {
  if (style === "none") return null;
  return (
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={className}
      style={{
        overflow: "visible",
        clipPath: active ? CLIP_SHOWN : CLIP_HIDDEN,
        opacity: active ? 1 : 0,
        // Draw-on is a beat slower than erase so a quick sweep across the
        // list doesn't leave several half-drawn strokes behind. Opacity
        // snaps on so the draw is visible from its first pixel, and fades
        // with the retract so nothing lingers if clip-path ever doesn't
        // animate.
        transition: active
          ? "clip-path 0.45s cubic-bezier(0.65, 0, 0.35, 1), opacity 0s"
          : "clip-path 0.25s ease-in, opacity 0.25s ease-in",
      }}
    >
      <path
        d={PATHS[style]}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ strokeWidth: "0.09em" }}
      />
    </svg>
  );
}
