"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
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

  if (!mounted) {
    return <div className="w-[72px] h-9" />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`
        relative w-[72px] h-9 p-1
        rounded-full
        bg-zinc-200/80 dark:bg-zinc-900/80
        border border-black/10 dark:border-white/10
        backdrop-blur-md
        shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]
        dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]
        transition-all duration-300 ease-out
        hover:border-black/20 dark:hover:border-white/20
        focus:outline-none focus:ring-2 focus:ring-indigo-500/30
        group cursor-pointer
      `}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Background Track Icons */}
      <div className="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none">
        <Sun
          size={14}
          strokeWidth={2}
          className={`
            transition-all duration-300
            ${dark ? "text-zinc-600 opacity-40 scale-75" : "text-amber-500 opacity-100 scale-100 rotate-0"}
          `}
        />
        <Moon
          size={14}
          strokeWidth={2}
          className={`
            transition-all duration-300
            ${dark ? "text-indigo-400 opacity-100 scale-100 rotate-0" : "text-zinc-400 opacity-40 scale-75 -rotate-12"}
          `}
        />
      </div>

      {/* Sliding Thumb na may Maangas na Animation & Glow */}
      <div
        className={`
          relative w-7 h-7
          rounded-full
          bg-white dark:bg-zinc-800
          shadow-[0_2px_8px_rgba(0,0,0,0.15)]
          dark:shadow-[0_2px_8px_rgba(0,0,0,0.5)]
          flex items-center justify-center
          transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)
          ${dark ? "translate-x-[36px]" : "translate-x-0"}
        `}
      >
        {/* Mini icon inside the thumb to make it pop more */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <Sun
            size={12}
            className={`
              absolute transition-all duration-300
              ${dark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100 text-amber-500"}
            `}
          />
          <Moon
            size={12}
            className={`
              absolute transition-all duration-300
              ${dark ? "opacity-100 rotate-0 scale-100 text-indigo-400" : "opacity-0 -rotate-90 scale-50"}
            `}
          />
        </div>
      </div>
    </button>
  );
}