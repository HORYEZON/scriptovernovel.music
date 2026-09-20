"use client";

// components/public/site-design/MenuPanel.tsx
//
// The visual body of the full-screen menu: a solid colour panel on the left
// carrying the oversized display-serif links (plus the mailing-list line and
// social icons pinned to its foot), a full-bleed photo on the right, and a
// round close button in the top corner.
//
// At rest nothing is highlighted: near-black panel, white links, the resting
// photo, no underline. Hovering a link recolours the panel to that link's
// colour, flips every link (and the foot) to the hover text colour, swaps
// the photo, and draws that link's hand-drawn underline; leaving the list
// returns everything to rest.
//
// Deliberately knows nothing about being fixed to the viewport, opening or
// closing — MenuOverlay.tsx handles that for the public site, and the admin's
// Site Design editor renders this same component inside a scaled preview
// frame so what the admin sees is literally what visitors get.
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOCIAL_ICON_REGISTRY } from "@/lib/social-icons";
import { ScribbleUnderline } from "./ScribbleUnderline";
import type { SiteDesignSettings, SiteMenuItem } from "@/lib/site-design";

// Per lib/site-design.ts's CLOSE_HOVER_EFFECTS — the button's colours are
// transitioned alongside, in the same 300ms.
const CLOSE_HOVER_TRANSFORM: Record<SiteDesignSettings["menuCloseHoverEffect"], string> = {
  spin: "rotate(90deg)",
  grow: "scale(1.1)",
  shrink: "scale(0.9)",
  none: "none",
};

const SPLIT_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

export type MenuSocialLink = {
  label: string;
  url: string;
  iconKey: string;
  hoverColor: string;
};

// Gap between one link starting and the next, for the "one by one" effects.
const STAGGER_MS = 70;

export function MenuPanel({
  settings,
  items,
  socialLinks = [],
  pathname,
  onClose,
  onNavigate,
  /** False while the sheet is still arriving (or leaving): links and the
   *  foot sit at their entrance start pose. Flip to true once the sheet
   *  has landed (MenuOpenTransition's useSheetLanded) to play
   *  menuItemsEffect. Defaults to true so a bare MenuPanel (the admin
   *  swatch, tests) is simply visible. */
  revealed = true,
  /** Whether the sheet itself is at rest / on its way there — the same
   *  `shown` MenuOpenTransition gets, and what the "split" halves (see
   *  below) travel on. Separate from `revealed` because the halves start
   *  moving the moment the sheet opens, while the links wait for it to
   *  land. Defaults to `revealed` for callers that don't distinguish. */
  sheetShown = revealed,
  /** True while the sheet is not shown because it's on its way out (vs.
   *  not yet opened) — same distinction MenuOpenTransition draws, and
   *  needed here too so the "split" open/close effects (see below) know
   *  which direction's edges to travel to. */
  closing = false,
  /** Admin preview: render at the desktop layout regardless of viewport
   *  (the frame is scaled down to fit) and never actually navigate. */
  preview = false,
  className,
}: {
  settings: SiteDesignSettings;
  items: SiteMenuItem[];
  socialLinks?: MenuSocialLink[];
  pathname?: string | null;
  onClose?: () => void;
  onNavigate?: () => void;
  preview?: boolean;
  className?: string;
  revealed?: boolean;
  sheetShown?: boolean;
  closing?: boolean;
}) {
  const visible = items.filter((i) => i.isVisible);
  const [hovered, setHovered] = useState<SiteMenuItem | null>(null);
  const active = hovered;
  const [closeHovered, setCloseHovered] = useState(false);

  // A row the admin just deleted in the editor could still be "hovered" here.
  useEffect(() => {
    if (hovered && !visible.some((i) => i.id === hovered.id)) setHovered(null);
  }, [visible, hovered]);

  // Entrance of each link (index-th in the list) and the foot (index =
  // visible.length, so it comes in last for the staggered effects).
  const itemsEffect = settings.menuItemsEffect;
  const staggered = itemsEffect === "stagger-fade" || itemsEffect === "stagger-rise";
  const lifts = itemsEffect === "rise" || itemsEffect === "stagger-rise";
  const entrance = (index: number): CSSProperties => {
    if (itemsEffect === "none") return {};
    const hidden = !revealed;
    return {
      opacity: hidden ? 0 : 1,
      transform: hidden && lifts ? "translateY(0.35em)" : "none",
      transition: `opacity ${settings.menuItemsSpeedMs}ms ease-out, transform ${settings.menuItemsSpeedMs}ms cubic-bezier(0.65, 0, 0.35, 1)`,
      // Leaving is immediate and all at once; only the arrival staggers.
      transitionDelay: revealed && staggered ? `${index * STAGGER_MS}ms` : "0ms",
    };
  };

  const panelColor = active?.bgColor ?? settings.menuBgColor;
  const textColor = active ? settings.menuHoverTextColor : settings.menuTextColor;
  const activeImage = active?.image ?? settings.menuImage;

  // The "split" open/close effect: the colour panel and photo panel travel
  // in from (or back out to) opposite edges independently of each other,
  // rather than the whole sheet moving as one block — MenuOpenTransition
  // stays a no-op wrapper for this effect (see its own comment) and this is
  // where the actual motion happens instead. Picked separately for open vs.
  // close, same as every other menuOpenEffect/menuCloseEffect pairing.
  const usesSplitOpen = settings.menuOpenEffect === "split";
  const usesSplitClose = settings.menuCloseEffect === "split";
  function splitHalfStyle(direction: "left" | "right"): CSSProperties {
    if (!usesSplitOpen && !usesSplitClose) return {};
    const departed = direction === "left" ? "translateX(-100%)" : "translateX(100%)";
    if (sheetShown) {
      // Arriving — always at rest once landed; the trip there runs on the
      // open effect's speed regardless of which pose (open's or none) it
      // started from.
      return { transform: "translateX(0)", transition: `transform ${settings.menuOpenSpeedMs}ms ${SPLIT_EASE}` };
    }
    if (closing) {
      // Leaving — only travels to the edge if the close effect is split;
      // otherwise the whole-sheet close effect handles the exit and the
      // halves just stay put.
      return usesSplitClose
        ? { transform: departed, transition: `transform ${settings.menuCloseSpeedMs}ms ${SPLIT_EASE}` }
        : { transform: "translateX(0)" };
    }
    // Pre-open start position — snap there, no transition, so it doesn't
    // animate into its hiding place on mount.
    return usesSplitOpen ? { transform: departed, transition: "none" } : { transform: "translateX(0)" };
  }

  // Every distinct photo is kept mounted and stacked so a hover is a
  // crossfade, not a reload — the first hover of each still fetches it.
  const images = Array.from(
    new Set([settings.menuImage, ...visible.map((i) => i.image)].filter((s): s is string => Boolean(s)))
  );

  const linkStyle: CSSProperties = {
    fontFamily: settings.menuFontFamily,
    fontWeight: Number(settings.menuFontWeight),
    fontStyle: settings.menuFontStyle,
    textTransform: settings.menuTextTransform,
    letterSpacing: settings.menuLetterSpacing,
    lineHeight: settings.menuLineHeight,
    color: textColor,
    // Consumed by .site-menu-link in globals.css (mobile size under md,
    // desktop size at md+); the preview pins the desktop size directly.
    ...(preview
      ? { fontSize: settings.menuFontSize }
      : ({
          "--site-menu-fs": settings.menuFontSize,
          "--site-menu-fs-mobile": settings.menuFontSizeMobile,
        } as CSSProperties)),
  };

  return (
    <div className={cn("relative flex h-full w-full overflow-hidden", className)}>
      {/* ── Colour panel ─────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative flex h-full shrink-0 flex-col justify-between",
          preview ? "" : "w-full md:w-[var(--site-menu-panel)]"
        )}
        style={{
          backgroundColor: panelColor,
          ...(preview
            ? { width: `${settings.menuPanelWidth}%` }
            : ({ "--site-menu-panel": `${settings.menuPanelWidth}%` } as CSSProperties)),
          ...splitHalfStyle("left"),
          // An inline `transition` (from splitHalfStyle, above) replaces the
          // whole property rather than adding to it, which would otherwise
          // silently drop the panel's own background-colour fade on hover —
          // so background-color is folded into the same declaration instead
          // of left on a `transition-colors` class.
          transition: [
            "background-color 500ms ease-out",
            splitHalfStyle("left").transition,
          ]
            .filter(Boolean)
            .join(", "),
        }}
      >
        <nav
          aria-label="Site menu"
          className={cn(
            "flex min-h-0 flex-1 flex-col items-start overflow-y-auto overscroll-contain",
            preview ? "px-10 pt-10 pb-6" : "px-6 pt-20 pb-6 md:px-10 md:pt-10"
          )}
          onMouseLeave={() => setHovered(null)}
        >
          {visible.map((item, index) => {
            const isActive = active?.id === item.id;
            const external = /^https?:\/\//.test(item.href) || item.href.startsWith("mailto:");
            const content = (
              <>
                <span className="relative z-10">{item.label}</span>
                <ScribbleUnderline
                  style={item.underlineStyle}
                  color={item.underlineColor}
                  active={isActive}
                  className="pointer-events-none absolute left-[-6%] top-[50%] z-20 h-[0.34em] w-[114%]"
                />
              </>
            );
            const shared = {
              className: cn(
                "site-menu-link relative block w-fit max-w-full select-none whitespace-nowrap outline-none transition-colors duration-300",
                preview && "cursor-default"
              ),
              style: { ...linkStyle, ...entrance(index) },
              onMouseEnter: () => setHovered(item),
              onFocus: () => setHovered(item),
              onBlur: () => setHovered(null),
            };
            if (preview) {
              return (
                <span key={item.id} {...shared} aria-current={isActive ? "page" : undefined}>
                  {content}
                </span>
              );
            }
            if (external || item.openInNewTab) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  onClick={onNavigate}
                  {...shared}
                >
                  {content}
                </a>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                aria-current={pathname === item.href ? "page" : undefined}
                {...shared}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* ── Panel foot: mailing line + socials ─────────────────────────── */}
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3",
            preview ? "px-10 pb-10" : "px-6 pb-8 md:px-10 md:pb-10"
          )}
          style={{
            color: textColor,
            ...entrance(visible.length),
            // Colour has to ride along with the entrance's own transition
            // list (a second `transition` would replace it).
            transition: `${entrance(visible.length).transition ?? ""}${itemsEffect === "none" ? "" : ", "}color 300ms`,
          }}
        >
          {settings.menuFooterText && (
            preview ? (
              <span className="font-body text-[11px] font-medium uppercase tracking-[0.08em]">
                {settings.menuFooterText}
              </span>
            ) : (
              <Link
                href={settings.menuFooterHref}
                onClick={onNavigate}
                className="font-body text-[11px] font-medium uppercase tracking-[0.08em] transition-opacity hover:opacity-60"
              >
                {settings.menuFooterText}
              </Link>
            )
          )}
          {settings.menuShowSocialLinks && socialLinks.length > 0 && (
            <div className="flex items-center gap-5">
              {socialLinks.map(({ url, label, iconKey, hoverColor }) => {
                const entry = SOCIAL_ICON_REGISTRY[iconKey];
                if (!entry) return null;
                const { Icon } = entry;
                return (
                  <a
                    key={`${iconKey}-${url}`}
                    href={preview ? undefined : url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="transition-colors duration-200"
                    onMouseEnter={(e) => (e.currentTarget.style.color = hoverColor)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Photo panel ──────────────────────────────────────────────────── */}
      <div
        className={cn("relative min-w-0 flex-1 bg-ink", preview ? "block" : "hidden md:block")}
        style={splitHalfStyle("right")}
        aria-hidden="true"
      >
        {images.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out"
            style={{ opacity: src === activeImage ? 1 : 0 }}
          />
        ))}
      </div>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onClose}
        onMouseEnter={() => setCloseHovered(true)}
        onMouseLeave={() => setCloseHovered(false)}
        onFocus={() => setCloseHovered(true)}
        onBlur={() => setCloseHovered(false)}
        aria-label="Close menu"
        className={cn(
          "absolute z-30 flex items-center justify-center rounded-full shadow-md outline-none transition-[background-color,color,transform] duration-300 ease-out active:scale-95",
          preview ? "right-8 top-8 h-[60px] w-[60px]" : "right-4 top-4 h-12 w-12 md:right-8 md:top-8 md:h-[60px] md:w-[60px]"
        )}
        style={{
          backgroundColor: closeHovered ? settings.menuCloseHoverBgColor : settings.menuCloseBgColor,
          color: closeHovered ? settings.menuCloseHoverIconColor : settings.menuCloseIconColor,
          transform: closeHovered ? CLOSE_HOVER_TRANSFORM[settings.menuCloseHoverEffect] : "none",
        }}
      >
        <X size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
