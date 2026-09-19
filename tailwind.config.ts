import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0D0D0D",
          50: "#F5F5F5",
          100: "#E8E8E8",
          200: "#C8C8C8",
          300: "#A0A0A0",
          400: "#707070",
          500: "#505050",
          600: "#3A3A3A",
          700: "#282828",
          800: "#1A1A1A",
          900: "#0D0D0D",
        },
        sepia: {
          DEFAULT: "#C8A96E",
          light: "#E8D5A8",
          dark: "#8B6E3A",
        },
        // Stories' counterpart to sepia — same three-stop shape (DEFAULT /
        // light / dark) and the same relative contrast against ink, so the
        // /stories grid can reuse the Gallery's card treatment verbatim and
        // simply read blue instead of gilded. Only used by the Stories
        // surfaces; the rest of the site stays on sepia.
        azure: {
          DEFAULT: "#6E9AC8",
          light: "#A8CBE8",
          dark: "#3A5E8B",
        },
        cream: "#FAF8F3",
        vermillion: "#D94F38",
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-dm-mono)", "monospace"],
        grotesk: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        jakarta: ["var(--font-plus-jakarta)", "system-ui", "sans-serif"],
        "anime-ace": ['"AnimeAce"', "serif"],
        badaboom: ['"BadaBoomBB"', "serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
        bodoni: ["var(--font-bodoni)", "Georgia", "serif"],
        fraunces: ["var(--font-fraunces)", "Georgia", "serif"],
        caveat: ["var(--font-caveat)", "cursive"],
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        "slide-right": "slideRight 0.5s ease forwards",
        shimmer: "shimmer 3s infinite linear", // <--- UPDATED HERE (Changed to 3s and linear)
        "skill-marquee": "skillMarquee var(--marquee-duration, 2s) ease-in-out infinite alternate",
        marquee: 'marquee 20s linear infinite',
        "squid-bob": "squidBob 4s ease-in-out infinite",
        "squid-glow": "squidGlow 3s ease-in-out infinite",
        // Bob + colour cycle together: both live on the wrapper so the
        // --squid-glow it animates inherits to the icon and its halo.
        "squid-drift":
          "squidBob 4s ease-in-out infinite, squidCycle 16s linear infinite",
        // The entrance splash's optional glow, breathing rather than flashing
        // — it sits behind the wordmark for the whole hold, so anything faster
        // reads as a flicker. See IntroSplashContent's glow layer.
        "splash-shimmer": "splashShimmer 4.5s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideRight: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        // Hover marquee for an admin skill chip whose name overflows its
        // column — --marquee-shift is the measured overflow, set inline by
        // SkillPreviewChip (AboutClient.tsx). Alternates, so it rocks back.
        skillMarquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(var(--marquee-shift, 0px))" },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        // Idle "breathing" motion for the squid standing in for the A in
        // KALAM(squid)RI — small enough not to break the wordmark's baseline.
        squidBob: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-1.5px) rotate(-3deg)" },
        },
        // Yellow -> green -> blue -> pink, the four hex values the Footer
        // wordmark already uses for its per-letter hovers. 4s per colour;
        // 0% and 100% must match or the loop seams.
        squidCycle: {
          "0%, 100%": { "--squid-glow": "#FFE135" },
          "25%": { "--squid-glow": "#44D700" },
          "50%": { "--squid-glow": "#5BC8F5" },
          "75%": { "--squid-glow": "#FF6B9D" },
        },
        splashShimmer: {
          "0%, 100%": { opacity: "0.5", transform: "scale(0.9)" },
          "50%": { opacity: "1", transform: "scale(1.08)" },
        },
        // Glow tints itself from --squid-glow so callers that cycle the squid's
        // colour can drive the halo too; falls back to brand cyan when unset.
        squidGlow: {
          "0%, 100%": {
            filter:
              "drop-shadow(0 0 1px color-mix(in srgb, var(--squid-glow, #5BC8F5) 35%, transparent))",
          },
          "50%": {
            filter:
              "drop-shadow(0 0 4px color-mix(in srgb, var(--squid-glow, #5BC8F5) 70%, transparent)) drop-shadow(0 0 9px color-mix(in srgb, var(--squid-glow, #5BC8F5) 30%, transparent))",
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;