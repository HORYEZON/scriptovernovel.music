// components/public/IntroSplashContent.tsx
// Pure presentational visual for the entrance splash — the band's wordmark
// (Site Design → Header) under its icon seal, plus taglines, plus the phase-driven transition treatment. No timing
// or session logic here; that's IntroSplash.tsx's job. Kept separate so the
// admin Preferences → Branding live preview can render the *exact* same
// visual/animation the public site uses, just inside a bounded box instead
// of a fullscreen fixed overlay — position:absolute here fills whatever
// positioned ancestor the caller wraps it in (fixed-fullscreen on the
// public site, relative-bounded in the admin preview).
"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Wordmark as BandWordmark } from "@/components/public/system/Wordmark";
import { DEFAULT_SITE_DESIGN } from "@/lib/site-design";
import {
  introTransitionClasses,
  introSplitOrientation,
  INTRO_DEFAULTS,
  type IntroEffect,
  type IntroLetterColors,
} from "@/lib/intro-splash";


/**
 * How the two tagline sizes resolve.
 *
 *  - "auto"    — the real splash. Both sizes are written as CSS custom
 *                properties and a media query in globals.css picks the phone
 *                one below 640px, so the switch happens at the actual viewport
 *                width with no JS and no hydration mismatch.
 *  - "mobile" / "desktop" — the admin preview, which is a *box* a few hundred
 *                pixels wide inside a desktop page. A media query there would
 *                answer for the admin's own screen, not for the phone being
 *                previewed, so the preview resolves the size inline instead.
 */
export type IntroViewport = "auto" | "mobile" | "desktop";

/**
 * The tagline's classes — and the fix for the reported phone wrap.
 *
 * Three things were fighting on a 375px screen:
 *
 *  1. `tracking-[0.4em]` — at 0.75rem that is 4.8px of air after *every*
 *     character, so "House of Arts" measured far wider than its glyphs
 *     suggest. Letter-spacing is what pushed it over the edge, so the phone
 *     case now gets 0.22em. It still reads as a spaced-out label; it just
 *     stops being the reason the line breaks.
 *  2. `max-w-[85%]` — 15% of a phone's width thrown away on a centred line
 *     that has the whole splash to itself. 92% on a phone.
 *  3. Nothing balanced the break when it *did* wrap, so it split at the last
 *     space and left "House of" over "Arts". `text-wrap: balance` makes the
 *     browser even the lines out instead, which is the difference between a
 *     deliberate two-line tagline and a broken one.
 *
 * The desktop case is deliberately unchanged — it was never the problem, and
 * 0.5em tracking is the look the splash was designed with.
 *
 * `viewport` decides which case applies. "auto" keeps the responsive `sm:`
 * prefixes, so the real splash switches at the real breakpoint; the preview
 * passes an explicit side, because its width is a box on a desktop page and
 * `sm:` would answer for the admin's monitor.
 */
function taglineClass(viewport: IntroViewport): string {
  const base = "relative z-10 text-center text-balance";
  if (viewport === "mobile") return `${base} tracking-[0.22em] max-w-[92%]`;
  if (viewport === "desktop") return `${base} tracking-[0.5em] max-w-[85%]`;
  return `${base} tracking-[0.22em] sm:tracking-[0.5em] max-w-[92%] sm:max-w-[85%] intro-tagline`;
}

/** The inline style for a tagline, given both sizes and how to resolve them.
 *  In "auto" the font-size is left to the stylesheet — see .intro-tagline in
 *  globals.css — and only the variables are set here. */
/**
 * The SCRIPT/N(squid)VEL lockup's size and letter-spacing, resolved the same way
 * the taglines are.
 *
 * These used to be plain `text-4xl sm:text-5xl md:text-6xl` — and in the
 * admin's phone preview those prefixes answered for the admin's *monitor*,
 * so the lockup drew at its 60px desktop size inside a handset-shaped box a
 * couple of hundred pixels wide. That is what "the phone preview is huge"
 * was: everything around the lockup was already being resolved per-viewport
 * (see taglineClass), and the lockup alone was still reading the breakpoint.
 *
 * "auto" keeps the exact responsive ladder the public splash has always had.
 */
function lockupClass(viewport: IntroViewport): string {
  if (viewport === "mobile") return "text-4xl";
  if (viewport === "desktop") return "text-6xl";
  return "text-4xl sm:text-5xl md:text-6xl";
}


function taglineStyle(
  viewport: IntroViewport,
  desktop: string,
  mobile: string | null,
  fontFamily: string,
  color: string
): CSSProperties {
  if (viewport === "auto") {
    return {
      fontFamily,
      color,
      // The fallback in the CSS var is what makes an unset mobile size follow
      // the desktop one, rather than needing a second branch here.
      ["--intro-tagline-size" as string]: desktop,
      ["--intro-tagline-size-mobile" as string]: mobile ?? desktop,
    };
  }
  return {
    fontFamily,
    color,
    fontSize: viewport === "mobile" ? mobile ?? desktop : desktop,
  };
}

function Wordmark({
  text,
  textAbove,
  icon,
  taglineFontSize,
  taglineFontFamily,
  taglineColor,
  taglineAboveFontSize,
  taglineAboveFontFamily,
  taglineAboveColor,
  taglineFontSizeMobile,
  taglineAboveFontSizeMobile,
  viewport,
  glowIntensity,
  glowColor,
  glowShimmer,
  glowOffsetX,
  glowOffsetY,
  squidColor,
  logoText,
  logoFontFamily,
  logoImage,
}: {
  text: string;
  textAbove: string;
  icon?: string | null;
  /** Site Design → Header → Wordmark: the band's lockup, same as the header. */
  logoText: string;
  logoFontFamily: string;
  logoImage: string | null;
  taglineFontSize: string;
  taglineFontFamily: string;
  taglineColor: string;
  taglineAboveFontSize: string;
  taglineAboveFontFamily: string;
  taglineAboveColor: string;
  taglineFontSizeMobile: string | null;
  taglineAboveFontSizeMobile: string | null;
  viewport: IntroViewport;
  glowIntensity: number;
  glowColor: string;
  glowShimmer: boolean;
  glowOffsetX: number;
  glowOffsetY: number;
  /** Profile.introSquidColor — the colour of the icon seal above the lockup. */
  squidColor: string;
}) {
  return (
    // `w-full` is load-bearing, and its absence was the real cause of the
    // reported phone wrap. This is a flex *item* in a centring parent, and a
    // flex column with `items-center` is shrink-to-fit: without a width its
    // box is only as wide as its widest child — the SCRIPT/N(squid)VEL lockup. So
    // the taglines' `max-w-[…%]` was a percentage *of the logo*, not of the
    // screen. At the stored settings ("HOUSE OF ARTS" in caps at 1rem) that
    // budget came out around 195px for a line needing ~220px, which is
    // exactly the "House of / Arts" break that was reported — and it would
    // never reproduce on a desktop, where the lockup is half again as wide.
    //
    // Filling the (already `px-6`-padded) parent makes those percentages mean
    // what they read as. `items-center` still centres the lockup and both
    // taglines within it, so nothing about the layout changes otherwise.
    <div className="relative w-full flex flex-col items-center gap-5 motion-safe:animate-fade-up">
      {/* The house light behind the lockup — a soft radial wash, not a border
          or a flare, which is why it's one blurred gradient rather than a
          box-shadow: it has to read as the room being lit behind the logo even
          on the near-black default backdrop. Intensity is the gradient's alpha
          at the centre, so 0 is genuinely nothing rendered rather than an
          invisible layer still being composited every frame.

          Explicit z-0/z-10 rather than source order: this layer is positioned
          and the wordmark below it isn't, and a positioned element paints over
          static siblings whatever the order — without the pair, the glow would
          sit *in front of* the logo it's meant to be behind.

          Two nested spans, not one, because the shimmer animates `transform`:
          any transform-based centring on the same element (the old
          left-1/2 + -translate-x-1/2 pair) is *replaced* the moment the
          keyframes take over, dropping the glow down and to the right of the
          lockup for the whole animation. So the outer span does placement
          only — flex centring, which no keyframe can clobber, plus the
          admin's offsets — and the inner span is the only thing that animates. */}
      {glowIntensity > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
          style={{ transform: `translate(${glowOffsetX}%, ${glowOffsetY}%)` }}
        >
          <span
            className={cn(
              "aspect-square w-[150%] min-w-[22rem] shrink-0 rounded-full blur-3xl",
              glowShimmer && "motion-safe:animate-splash-shimmer"
            )}
            style={{
              background: `radial-gradient(circle, color-mix(in srgb, ${glowColor} ${glowIntensity}%, transparent) 0%, transparent 70%)`,
            }}
          />
        </span>
      )}
      {/* The optional line above the logo — same treatment as the tagline
          below it (admin-set size, family and color, casing shown as typed),
          just on the other side of the lockup. Rendered only when it has
          content, so the default empty value leaves the lockup's own spacing
          exactly as it was rather than adding an invisible gap. */}
      {textAbove && (
        <span
          className={taglineClass(viewport)}
          style={taglineStyle(
            viewport,
            taglineAboveFontSize,
            taglineAboveFontSizeMobile,
            taglineAboveFontFamily,
            taglineAboveColor
          )}
        >
          {textAbove}
        </span>
      )}
      {/* The band's lockup — the header's own logo text/image (Site Design →
          Header → Wordmark) with the splash icon as a seal above it, in the
          admin's chosen icon colour. Sized per viewport by lockupClass. */}
      <BandWordmark
        text={logoText}
        fontFamily={logoFontFamily}
        image={logoImage}
        icon={icon}
        iconPlacement="above"
        iconColor={squidColor}
        className={cn("relative z-10", lockupClass(viewport))}
      />
      {/* No `uppercase` here on purpose — the admin's typed casing is shown
          as-is (see Preferences → Branding → Entrance Splash), unlike the
          SCRIPT/N(squid)VEL lockup above which is deliberately always caps.
          Size/family are admin-tunable (Profile.introTaglineFontSize/
          introTaglineFontFamily); tracking stays fixed since it's tuned to
          the lockup's own rhythm, not the tagline's casing. */}
      <span
        className={taglineClass(viewport)}
        style={taglineStyle(
          viewport,
          taglineFontSize,
          taglineFontSizeMobile,
          taglineFontFamily,
          taglineColor
        )}
      >
        {text}
      </span>
    </div>
  );
}

export function IntroSplashContent({
  effect,
  phase,
  text,
  textAbove,
  durationMs,
  bgColor,
  icon,
  className,
  forceMotion,
  taglineFontSize,
  taglineFontFamily,
  taglineColor,
  taglineAboveFontSize,
  taglineAboveFontFamily,
  taglineAboveColor,
  taglineFontSizeMobile,
  taglineAboveFontSizeMobile,
  viewport = "auto",
  glowIntensity,
  glowColor,
  glowShimmer,
  glowOffsetX,
  glowOffsetY,
  squidColor,
  logoText,
  logoFontFamily,
  logoImage,
}: {
  effect: IntroEffect;
  phase: "visible" | "exiting";
  text: string;
  /** Profile.introTextAbove — the optional line above the logo. Empty hides it. */
  textAbove?: string;
  /** CSS transition-duration, in ms — the exit half of the timeline. */
  durationMs: number;
  /** Splash backdrop color (hex) — admin-configurable via Profile.introBgColor. */
  bgColor?: string;
  /** Profile.splashIcon ("platform:name") — falls back to the squid when unset/invalid. */
  icon?: string | null;
  className?: string;
  /** Bypasses the motion-reduce fallback in introTransitionClasses — see its
   * own doc comment. Only the admin's own live preview should pass this. */
  forceMotion?: boolean;
  /** Profile.introTaglineFontSize — falls back to INTRO_DEFAULTS when unset. */
  taglineFontSize?: string;
  /** Profile.introTaglineFontFamily — the line *below* the logo. */
  taglineFontFamily?: string;
  /** Profile.introTaglineColor / introTaglineAbove* — size, family and color
   *  are all per-line, so the two taglines can be styled independently. */
  taglineColor?: string;
  taglineAboveFontSize?: string;
  taglineAboveFontFamily?: string;
  taglineAboveColor?: string;
  /** Profile.introTaglineFontSizeMobile / introTaglineAboveFontSizeMobile —
   *  phone-only size overrides. Null/undefined follows the desktop size. */
  taglineFontSizeMobile?: string | null;
  taglineAboveFontSizeMobile?: string | null;
  /** How those two resolve — see IntroViewport. Defaults to "auto", which is
   *  what the real splash wants; only the admin preview passes a side. */
  viewport?: IntroViewport;
  /** Profile.introGlow* — the light behind the lockup. 0 renders nothing.
   *  The offsets move it off centre, in % of the lockup's own box. */
  glowIntensity?: number;
  glowColor?: string;
  glowShimmer?: boolean;
  glowOffsetX?: number;
  glowOffsetY?: number;
  /** Profile.introLetterColors — accepted for callers that still pass it;
   *  unused since the lockup became the admin's own wordmark. */
  letterColors?: IntroLetterColors;
  /** Profile.introSquidColor — the colour of the icon seal. */
  squidColor?: string;
  /** Site Design → Header → Wordmark. Defaults let the admin preview and
   *  any older caller render without threading Site Design through. */
  logoText?: string;
  logoFontFamily?: string;
  logoImage?: string | null;
}) {
  const exiting = phase === "exiting";
  const bg = bgColor || INTRO_DEFAULTS.introBgColor;
  const splitOrientation = introSplitOrientation(effect);
  const resolvedTaglineFontSize = taglineFontSize || INTRO_DEFAULTS.introTaglineFontSize;
  const resolvedTaglineFontFamily = taglineFontFamily || INTRO_DEFAULTS.introTaglineFontFamily;
  // One object rather than a dozen props threaded twice — the two branches below
  // must render an identical wordmark, and a prop added to one and forgotten
  // on the other is exactly the drift this component exists to prevent.
  const wordmark = {
    text,
    textAbove: textAbove ?? INTRO_DEFAULTS.introTextAbove,
    icon,
    taglineFontSize: resolvedTaglineFontSize,
    taglineFontFamily: resolvedTaglineFontFamily,
    taglineColor: taglineColor || INTRO_DEFAULTS.introTaglineColor,
    taglineAboveFontSize: taglineAboveFontSize || INTRO_DEFAULTS.introTaglineAboveFontSize,
    taglineAboveFontFamily:
      taglineAboveFontFamily || INTRO_DEFAULTS.introTaglineAboveFontFamily,
    taglineAboveColor: taglineAboveColor || INTRO_DEFAULTS.introTaglineAboveColor,
    // `?? null`, not `||` — an empty string here means "no override", same as
    // null, and `||` would collapse both to null anyway. Written explicitly so
    // the intent isn't mistaken for the falsy-fallback pattern above it.
    taglineFontSizeMobile: taglineFontSizeMobile ?? null,
    taglineAboveFontSizeMobile: taglineAboveFontSizeMobile ?? null,
    viewport,
    glowIntensity: glowIntensity ?? INTRO_DEFAULTS.introGlowIntensity,
    glowColor: glowColor || INTRO_DEFAULTS.introGlowColor,
    glowShimmer: glowShimmer ?? INTRO_DEFAULTS.introGlowShimmer,
    glowOffsetX: glowOffsetX ?? INTRO_DEFAULTS.introGlowOffsetX,
    glowOffsetY: glowOffsetY ?? INTRO_DEFAULTS.introGlowOffsetY,
    squidColor: squidColor || INTRO_DEFAULTS.introSquidColor,
    logoText: logoText || DEFAULT_SITE_DESIGN.headerLogoText,
    logoFontFamily: logoFontFamily || DEFAULT_SITE_DESIGN.headerLogoFontFamily,
    logoImage: logoImage ?? null,
  };

  if (splitOrientation) {
    // Structurally different from the rest: two panels that split apart,
    // not one box that fades/transforms — doesn't fit introTransitionClasses'
    // single-className shape, so it gets its own markup here. "vertical"
    // (landscape-half) splits left/right; "horizontal" (portrait-half)
    // splits top/bottom — see introSplitOrientation.
    const vertical = splitOrientation === "vertical";
    return (
      // No backgroundColor here on purpose — this wrapper must stay
      // transparent, or it'd sit behind the two panels as an opaque sheet
      // of the exact same color, silently defeating the "split apart to
      // reveal what's underneath" motion the two panels are supposed to
      // perform (the bug this replaced: they used to carry bg-ink too).
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        <div
          aria-hidden="true"
          className={cn(
            "absolute transition-transform ease-out",
            vertical ? "inset-y-0 left-0 w-1/2" : "inset-x-0 top-0 h-1/2",
            exiting && (vertical ? "-translate-x-full" : "-translate-y-full")
          )}
          style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute transition-transform ease-out",
            vertical ? "inset-y-0 right-0 w-1/2" : "inset-x-0 bottom-0 h-1/2",
            exiting && (vertical ? "translate-x-full" : "translate-y-full")
          )}
          style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
        />
        <div
          className={cn(
            "relative h-full flex items-center justify-center px-6",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "transition-opacity ease-out",
            exiting ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          style={{ transitionDuration: `${durationMs}ms` }}
        >
          <Wordmark {...wordmark} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center px-6",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        "transition-[opacity,transform] ease-out",
        exiting && "pointer-events-none",
        introTransitionClasses(effect, phase, forceMotion),
        className
      )}
      style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
    >
      <Wordmark {...wordmark} />
    </div>
  );
}
