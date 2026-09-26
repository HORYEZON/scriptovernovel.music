"use client";

// components/ui/ThemeToggle.tsx
//
// The site's real light/dark control. The pill itself is ThemeSwitch.tsx,
// shared with Preferences → Header's live preview — same split kalamari.arts
// makes, and for the same reason: the preview needs the identical pill driven
// by a preview-only flag rather than the admin's own theme.
import { useState, useEffect } from "react";
import { ThemeSwitch } from "./ThemeSwitch";

// Re-exported for callers that had it from here before the pill moved out.
export { VinylThumb } from "./ThemeSwitch";

export function ThemeToggle({
  compactOnMobile = false,
}: {
  /** Shrinks the pill below `sm` — see ThemeSwitch. */
  compactOnMobile?: boolean;
} = {}) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const isDark =
      savedTheme === "dark" ||
      (!savedTheme && document.documentElement.classList.contains("dark"));
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Server and first client paint can't agree on the theme, so the pill only
  // appears once mounted — a same-sized spacer holds the header row still.
  if (!mounted) {
    return <div className={compactOnMobile ? "w-14 h-8 sm:w-[72px] sm:h-9" : "w-[72px] h-9"} />;
  }

  return <ThemeSwitch dark={dark} onToggle={toggle} compactOnMobile={compactOnMobile} />;
}
