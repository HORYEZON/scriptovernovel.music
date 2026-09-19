// components/public/site-design/HomeHero.tsx
//
// The homepage's first screen: a flat colour field the fixed header blends
// into, a single centred image (album art / the featured piece), a one-line
// display-serif heading, a pill CTA, and an optional ornament pinned to one
// corner. Everything comes from Site Design → Homepage Hero.
//
// No hooks and no server-only imports, so the admin's live preview can
// render this exact component inside a client tree.
import Link from "next/link";
import { SafeImg } from "@/components/ui/SafeImage";
import { cn } from "@/lib/utils";
import type { SiteDesignSettings } from "@/lib/site-design";

const DECOR_POSITION_CLASS: Record<SiteDesignSettings["heroDecorPosition"], string> = {
  "bottom-left": "bottom-0 left-6 md:left-12 lg:left-20",
  "bottom-right": "bottom-0 right-6 md:right-12 lg:right-20",
  "top-left": "top-24 left-6 md:left-12 lg:left-20",
  "top-right": "top-24 right-6 md:right-12 lg:right-20",
};

export function HomeHero({
  settings,
  preview = false,
}: {
  settings: SiteDesignSettings;
  /** Admin preview: fixed height instead of the viewport, no live links. */
  preview?: boolean;
}) {
  const cta = settings.heroCtaLabel.trim();
  const ctaClass =
    "inline-flex items-center rounded-full px-5 py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.12em] transition-transform duration-200 hover:scale-[1.04] active:scale-95";
  const ctaStyle = { backgroundColor: settings.heroCtaBgColor, color: settings.heroCtaTextColor };

  return (
    <section
      className={cn(
        "relative flex w-full flex-col items-center justify-center overflow-hidden px-6 text-center",
        preview ? "h-full" : "min-h-[100svh] pt-14 md:pt-16"
      )}
      style={{
        backgroundColor: settings.heroBgColor,
        ...(settings.heroBgImage && {
          backgroundImage: `url("${settings.heroBgImage}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }),
      }}
    >
      {settings.heroImage && (
        <SafeImg
          src={settings.heroImage}
          alt={settings.heroHeading || ""}
          className="mb-10 h-auto max-w-full object-contain"
          style={{ width: settings.heroImageWidth }}
        />
      )}

      {settings.heroHeading && (
        <h1
          className="max-w-4xl leading-[1.05] tracking-[-0.02em]"
          style={{
            fontFamily: settings.heroHeadingFontFamily,
            fontSize: settings.heroHeadingFontSize,
            fontWeight: Number(settings.heroHeadingFontWeight),
            color: settings.heroHeadingColor,
          }}
        >
          {settings.heroHeading}
        </h1>
      )}

      {settings.heroSubheading && (
        <p
          className="mt-3 max-w-xl font-body text-sm md:text-base"
          style={{ color: settings.heroHeadingColor, opacity: 0.7 }}
        >
          {settings.heroSubheading}
        </p>
      )}

      {cta && (
        <div className="mt-7">
          {preview ? (
            <span className={ctaClass} style={ctaStyle}>
              {cta}
            </span>
          ) : (
            <Link href={settings.heroCtaHref} className={ctaClass} style={ctaStyle}>
              {cta}
            </Link>
          )}
        </div>
      )}

      {settings.heroDecorImage && (
        <SafeImg
          src={settings.heroDecorImage}
          alt=""
          aria-hidden="true"
          className={cn("pointer-events-none absolute h-auto object-contain", DECOR_POSITION_CLASS[settings.heroDecorPosition])}
          style={{ width: settings.heroDecorWidth }}
        />
      )}
    </section>
  );
}
