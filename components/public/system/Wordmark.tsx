// components/public/system/Wordmark.tsx
//
// The band's lockup wherever it isn't the header: footer, entrance splash,
// admin sidebar, login. Reads the same Site Design settings the header
// does (logo image, else logo text in the chosen font) so there is one
// wordmark, admin-configured once — and the admin-picked icon (footer /
// splash icon from Preferences → Branding) rides beside or above it as a
// glowing seal on the site's existing `--squid-glow` colour cycle. This
// replaces the old fixed "SCRIPT / N(icon)VEL" lockup, which spelled a name
// in code and couldn't be changed from the admin.
//
// No "use client" and no server-only imports: the splash's admin preview
// renders it inside a client tree, the footer inside a server one.
import type { CSSProperties } from "react";
import { SafeImg } from "@/components/ui/SafeImage";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { parseIconValue } from "@/components/ui/icon-values";
import { cn } from "@/lib/utils";

export function Wordmark({
  text,
  fontFamily,
  image,
  icon,
  iconPlacement = "left",
  /** Fixed colour for the icon; default is the drifting brand cycle. */
  iconColor,
  className,
  textClassName,
}: {
  text: string;
  fontFamily?: string;
  image?: string | null;
  icon?: string | null;
  iconPlacement?: "left" | "above" | "none";
  iconColor?: string;
  /** Sizes everything — the icon is 1em of the text. Default text-4xl. */
  className?: string;
  textClassName?: string;
}) {
  const parsedIcon = parseIconValue(icon);
  const iconCls = "relative h-[1em] w-[1em] shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110";
  const iconStyle = { color: "var(--squid-glow)" } as CSSProperties;
  const seal = iconPlacement !== "none" && (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        iconColor ? "motion-safe:animate-squid-bob" : "motion-safe:animate-squid-drift"
      )}
      style={iconColor ? ({ "--squid-glow": iconColor } as CSSProperties) : undefined}
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: "color-mix(in srgb, var(--squid-glow) 35%, transparent)" }}
        className="pointer-events-none absolute inset-0 scale-75 rounded-full opacity-60 blur-xl transition-all duration-300 group-hover/logo:scale-150 group-hover/logo:opacity-100"
      />
      {parsedIcon ? (
        <DynamicIcon
          platform={parsedIcon.platform}
          name={parsedIcon.name}
          style={iconStyle}
          className={iconCls}
          fallback={<SquidIcon style={iconStyle} className={iconCls} />}
        />
      ) : (
        <SquidIcon style={iconStyle} className={iconCls} />
      )}
    </span>
  );

  return (
    <span
      className={cn(
        "group/logo inline-flex items-center leading-none text-cream",
        iconPlacement === "above" ? "flex-col gap-[0.4em]" : "gap-[0.35em]",
        className ?? "text-4xl"
      )}
    >
      {seal}
      {image ? (
        <SafeImg
          src={image}
          alt={text || "Logo"}
          className="h-[1.4em] w-auto max-w-[12em] object-contain"
          fallback={
            <span className={cn("whitespace-nowrap", textClassName)} style={{ fontFamily }}>
              {text}
            </span>
          }
        />
      ) : (
        <span className={cn("whitespace-nowrap", textClassName)} style={{ fontFamily }}>
          {text}
        </span>
      )}
    </span>
  );
}
