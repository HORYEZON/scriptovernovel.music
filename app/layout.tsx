// app/layout.tsx
import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, DM_Mono, Space_Grotesk, Plus_Jakarta_Sans } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import AnimatedFavicon from "@/components/AnimatedFavicon";
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

export const metadata: Metadata = {
  // Resolves every relative URL Next emits for this app — including the
  // og:image/twitter:image it injects from app/opengraph-image.tsx. Without
  // it Next falls back to localhost:3000 at build time and hands scrapers an
  // unreachable image, so the preview renders text-only. Same env chain
  // robots.ts and sitemap.ts already read (lib/site-url.ts), which production
  // resolves to the deployed origin.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ScriptOverNovel — House of Arts",
    template: "%s | ScriptOverNovel",
  },
  description:
    "A curated collection from ScriptOverNovel — House of Arts. Original paintings, prints, and mixed media available for acquisition.",
  keywords: ["Filipino art", "contemporary art", "paintings", "Manila artist"],
  openGraph: {
    title: "ScriptOverNovel — House of Arts",
    description: "A curated collection from ScriptOverNovel — House of Arts.",
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
    title: "ScriptOverNovel — House of Arts",
    description: "A curated collection from ScriptOverNovel — House of Arts.",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await prisma.profile.findFirst().catch(() => null);
  const bgStyle = profile?.backgroundImage
    ? ({ "--bg-image": `url('${profile.backgroundImage}')` } as React.CSSProperties)
    : {};

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable} ${spaceGrotesk.variable} ${plusJakarta.variable}`}
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
        <AnimatedFavicon colors={profile?.faviconIconColors} />
        <div className="page-glass" aria-hidden="true" />
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
