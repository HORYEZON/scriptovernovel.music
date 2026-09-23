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
  iconSplit = "O",
  /** Fixed colour for the icon; default is the drifting brand cycle. */
  iconColor,
  className,
  textClassName,
}: {
  text: string;
  fontFamily?: string;
  image?: string | null;
  icon?: string | null;
  /**
   * Where the seal sits. "inline" sets it *into* the word in place of
   * `iconSplit` — SCRIPT (O)VER NOVEL — the way the sidebar's squid stands in
   * for KALAMARI's second A. Falls back to "left" when the letter isn't in
   * the text, so renaming the band can't leave the lockup with no icon.
   */
  iconPlacement?: "left" | "above" | "inline" | "none";
  /** The letter "inline" replaces, matched case-insensitively on its first
   *  occurrence. Only read when iconPlacement is "inline". */
  iconSplit?: string;
  iconColor?: string;
  /** Sizes everything — the icon is 1em of the text. Default text-4xl. */
  className?: string;
  textClassName?: string;
}) {
  const parsedIcon = parseIconValue(icon);
  const iconCls = "relative h-[1em] w-[1em] shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110";
  const iconStyle = { color: "var(--squid-glow)" } as CSSProperties;

  // Where the seal lands in the word, for "inline". -1 (and an empty split
  // letter) means it can't be set into the text, so the lockup keeps the
  // seal on the left rather than dropping it.
  const splitAt = iconPlacement === "inline" && iconSplit
    ? text.toLowerCase().indexOf(iconSplit.toLowerCase())
    : -1;
  const inline = splitAt >= 0;

  const seal = iconPlacement !== "none" && (
    <span
      className={cn(
        "relative inline-flex items-center justify-center",
        // Standing in for a letter, so it sits in the word rather than beside
        // it — but not kerned *tight*. The seal carries a blurred halo that
        // spills past its own 1em box, and pulling it in by a negative margin
        // (which is what this was) left the halo sitting on top of the
        // preceding letter: "scrip(t◎)ver" rather than "script ◎ ver". The
        // gap is the halo's room, not letterspacing.
        inline && "mx-[0.09em] align-baseline",
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

  // Set into the word: the two halves of the text either side of the seal,
  // with no flex gap — the kerning above is what spaces it. An uploaded logo
  // image is deliberately ignored here; an image and a lettered lockup are two
  // answers to the same question, and a caller asking for the seal *inside*
  // the word has already picked the letters.
  if (inline) {
    const before = text.slice(0, splitAt);
    const after = text.slice(splitAt + iconSplit.length);
    return (
      <span
        className={cn(
          "group/logo inline-flex items-center leading-none text-cream",
          className ?? "text-4xl"
        )}
        // The seal is a picture standing in for a letter, so the accessible
        // name has to put that letter back or the band's name is misspelled
        // to a screen reader.
        aria-label={text}
      >
        <span aria-hidden="true" className={cn("whitespace-nowrap", textClassName)} style={{ fontFamily }}>
          {before}
        </span>
        {seal}
        <span aria-hidden="true" className={cn("whitespace-nowrap", textClassName)} style={{ fontFamily }}>
          {after}
        </span>
      </span>
    );
  }

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
