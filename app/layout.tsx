// app/layout.tsx
import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  DM_Sans,
  DM_Mono,
  Space_Grotesk,
  Plus_Jakarta_Sans,
  Playfair_Display,
  Bodoni_Moda,
  Fraunces,
  Caveat,
} from "next/font/google";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import AnimatedFavicon from "@/components/AnimatedFavicon";
import { getSiteDesign } from "@/lib/site-design-server";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

// Display serifs for the Site Design module (menu overlay + homepage hero —
// see lib/site-design.ts). All three are variable fonts, so every weight the
// admin's picker offers (400–900) and italic are one file each rather than a
// request per weight.
const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-bodoni",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Handwritten — the header wordmark's text fallback when no signature image
// has been uploaded (SiteDesign.headerLogoImage).
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves every relative URL Next emits for this app — including the
  // og:image/twitter:image it injects from app/opengraph-image.tsx. Without
  // it Next falls back to localhost:3000 at build time and hands scrapers an
  // unreachable image, so the preview renders text-only. Same env chain
  // robots.ts and sitemap.ts already read (lib/site-url.ts), which production
  // resolves to the deployed origin.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ScriptOverNovel — shoegaze, dreampop, math rock & post-rock",
    template: "%s | ScriptOverNovel",
  },
  description:
    "ScriptOverNovel is a band from Valenzuela City, PH — shoegaze, dreampop, math rock and post-rock. Music, videos, shows and merch.",
  keywords: ["ScriptOverNovel", "shoegaze", "dreampop", "math rock", "post-rock", "Filipino band", "Valenzuela", "indie rock Philippines"],
  openGraph: {
    title: "ScriptOverNovel",
    description: "Shoegaze, dreampop, math rock and post-rock from Valenzuela City, PH.",
    siteName: "ScriptOverNovel",
    locale: "en_PH",
    type: "website",
  },
  // "summary_large_image", not X's default "summary" — opengraph-image.tsx
  // draws a 1200x630 banner, and "summary" would crop it to a small square.
  // No `images` key on either block: Next fills both from that file.
  //
  // Note for anyone adding page-level openGraph/twitter later — Next merges
  // metadata shallowly, so a child segment that redefines `openGraph`
  // replaces this whole object rather than extending it, and has to restate
  // title/description/siteName itself (see the artwork page, which does).
  twitter: {
    card: "summary_large_image",
    title: "ScriptOverNovel",
    description: "Shoegaze, dreampop, math rock and post-rock from Valenzuela City, PH.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, siteDesign] = await Promise.all([
    prisma.profile.findFirst().catch(() => null),
    getSiteDesign(),
  ]);
  const bgStyle = profile?.backgroundImage
    ? ({ "--bg-image": `url('${profile.backgroundImage}')` } as React.CSSProperties)
    : {};

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable} ${spaceGrotesk.variable} ${plusJakarta.variable} ${playfair.variable} ${bodoniModa.variable} ${fraunces.variable} ${caveat.variable}`}
      style={bgStyle}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="text-ink dark:text-cream antialiased transition-colors duration-300">
        <AnimatedFavicon
          colors={profile?.faviconIconColors}
          imageHref={siteDesign.settings.faviconImage}
        />
        <div className="page-glass" aria-hidden="true" />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
