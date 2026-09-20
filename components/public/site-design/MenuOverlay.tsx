"use client";

// components/public/site-design/MenuOverlay.tsx
//
// Fixes MenuPanel to the viewport and owns everything about it being open:
// the enter/leave animation (Site Design → Menu → Open animation, via
// MenuOpenTransition), body scroll lock, Escape, and closing itself when
// the route changes (a click on a link, or the browser's back button).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MenuPanel, type MenuSocialLink } from "./MenuPanel";
import { MenuOpenTransition, useSheetLanded } from "./MenuOpenTransition";
import type { SiteDesignSettings, SiteMenuItem } from "@/lib/site-design";

export function MenuOverlay({
  open,
  onClose,
  settings,
  items,
  socialLinks,
}: {
  open: boolean;
  onClose: () => void;
  settings: SiteDesignSettings;
  items: SiteMenuItem[];
  socialLinks: MenuSocialLink[];
}) {
  const pathname = usePathname();
  // Stays mounted through the close animation, then unmounts so the photos
  // and the oversized type aren't sitting in the DOM behind every page.
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  // Distinguishes "not shown because it's about to open" (start pose of the
  // open effect) from "not shown because it's leaving" (end pose of the
  // close effect) — see MenuOpenTransition.
  const [closing, setClosing] = useState(false);
  // Links play their entrance only once the sheet has arrived.
  const landed = useSheetLanded(shown, settings.menuOpenSpeedMs);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
      // Two frames, not one: the sheet mounts in its hidden pose, and the
      // browser has to actually compute styles for that pose before the
      // shown pose lands, or there's nothing to transition *from* and it
      // simply appears in place. A single rAF fires before this frame's
      // style/layout pass, so React's batched update would land in the same
      // pass as the mount — the second frame guarantees a paint in between.
      // (The admin preview's playMenuOpen does the same.)
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setClosing(true);
    setShown(false);
    const t = setTimeout(() => setMounted(false), settings.menuCloseSpeedMs);
    return () => clearTimeout(t);
  }, [open, settings.menuCloseSpeedMs]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Route changed underneath us (link click, back button) → close.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a pathname change
  }, [pathname]);

  if (!mounted) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Site menu" className="fixed inset-0 z-[100]">
      <MenuOpenTransition
        openEffect={settings.menuOpenEffect}
        openSpeedMs={settings.menuOpenSpeedMs}
        closeEffect={settings.menuCloseEffect}
        closeSpeedMs={settings.menuCloseSpeedMs}
        shown={shown}
        closing={closing}
        className="h-full w-full"
      >
        <MenuPanel
          settings={settings}
          items={items}
          socialLinks={socialLinks}
          pathname={pathname}
          onClose={onClose}
          onNavigate={onClose}
          revealed={landed}
          sheetShown={shown}
          closing={closing}
        />
      </MenuOpenTransition>
    </div>
  );
}
