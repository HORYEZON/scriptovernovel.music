// components/public/system/PageHero.tsx
//
// The first screen of a page in the hazy direction: a full-bleed photo,
// overscaled and softly blurred so it reads as atmosphere rather than a
// picture, a gradient wash so type sits on it, film grain, then an eyebrow,
// a thin serif title, one line, and a row of CTAs. `size="full"` is the
// homepage (whole viewport); `size="inner"` is the top of Music / Store /
// Videos / About / Contact. No photo → a soft radial glow on ink, so a
// page never opens on a hard black field.
//
// Server-safe; the slow drift on the photo is CSS (`animate-haze-drift`).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import { Eyebrow } from "./Eyebrow";
import { GrainOverlay } from "./GrainOverlay";

export function PageHero({
  image,
  imageAlt = "",
  eyebrow,
  title,
  subtitle,
  children,
  size = "inner",
  align = "center",
  blur = "md",
  className,
}: {
  image?: string | null;
  imageAlt?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** CTA row / anything under the subtitle. */
  children?: ReactNode;
  size?: "full" | "inner";
  align?: "center" | "left";
  /** How far the photo dissolves — "sm" keeps a cover recognisable. */
  blur?: "sm" | "md" | "lg";
  className?: string;
}) {
  const src = image ? imageVariantUrl(image, "full") : null;
  const blurClass = { sm: "blur-sm", md: "blur-md", lg: "blur-xl" }[blur];
  return (
    <section
      className={cn(
        "relative isolate flex w-full flex-col justify-end overflow-hidden",
        size === "full" ? "min-h-[100svh] pt-14 md:pt-16" : "min-h-[55svh] pt-24 md:min-h-[60svh] md:pt-28",
        className
      )}
    >
      {/* Photo layer — overscaled so the blur's soft edges never show. */}
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={imageAlt}
          aria-hidden={imageAlt ? undefined : true}
          draggable={false}
          className={cn(
            "absolute inset-0 -z-20 h-full w-full scale-110 object-cover motion-safe:animate-haze-drift",
            blurClass
          )}
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_30%,rgba(200,169,110,0.22),transparent_60%),radial-gradient(ellipse_at_80%_80%,rgba(110,154,200,0.14),transparent_55%)]"
        />
      )}
      {/* Wash: keeps the type legible and lets the bar/header blend in. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/40 via-ink/30 to-ink/85 dark:from-ink/50 dark:via-ink/40 dark:to-ink/90"
      />
      <GrainOverlay className="-z-10 opacity-[0.06]" />

      <div
        className={cn(
          "section-padding relative w-full pb-16 md:pb-24",
          align === "center" ? "flex flex-col items-center text-center" : "flex flex-col items-start text-left"
        )}
      >
        {eyebrow && <Eyebrow className="mb-5 motion-safe:animate-fade-up-slow">{eyebrow}</Eyebrow>}
        <h1
          className={cn(
            "max-w-5xl font-fraunces font-light leading-[1] tracking-[-0.02em] text-cream drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] motion-safe:animate-fade-up-slow",
            size === "full" ? "text-5xl sm:text-6xl md:text-7xl lg:text-8xl" : "text-4xl md:text-6xl"
          )}
          style={{ animationDelay: "120ms" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-5 max-w-xl font-body text-sm leading-relaxed text-cream/70 md:text-base motion-safe:animate-fade-up-slow"
            style={{ animationDelay: "240ms" }}
          >
            {subtitle}
          </p>
        )}
        {children && (
          <div
            className={cn("mt-8 flex flex-wrap gap-3 motion-safe:animate-fade-up-slow", align === "center" && "justify-center")}
            style={{ animationDelay: "360ms" }}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
