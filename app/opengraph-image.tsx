// app/opengraph-image.tsx
//
// Next's "opengraph-image" file convention — the 1200x630 card every social
// platform (Facebook, Messenger, X, LinkedIn, Discord, Slack, Viber) shows
// when someone shares a link. Sitting at the app root makes it the site-wide
// default: Next injects og:image and twitter:image, plus their width/height/
// type, into every route that doesn't declare its own. The one route that
// does is the artwork page, which points openGraph.images at the piece
// itself (app/(public)/artwork/[slug]/page.tsx) — a real artwork beats a
// brand card when the link is about that artwork.
//
// Carries the SCRIPT/N(squid)VEL lockup from components/public/FooterWordmark.tsx
// and IntroSplashContent.tsx: BadaBoom, the squid standing in for the second
// A, the four accent colours running left to right.
//
// IMPORTANT, because it constrains the design: this is a flat PNG. A link
// preview is downloaded and drawn by the platform's own UI — there is no
// browser, no CSS, no JS and no cursor, so the wordmark's hover transitions
// and the squid's drift/glow animations cannot exist here. Facebook and X
// don't animate og:image even when handed a GIF. So the per-letter hover
// colours, which on the live site only appear one at a time under the mouse,
// are painted on all at once — a frozen frame of the whole colour run.
//
// Drawn rather than shipped as a static PNG for the same reason app/icon.tsx
// is drawn: there is no image asset in public/ to point at (only fonts), and
// a generated card can't drift out of sync with tailwind.config.ts's palette
// the way a hand-exported file would.
//
// Deliberately DB-free, unlike icon.tsx — nothing here reads Profile, so this
// route prerenders to a static PNG at build time (confirmed by `next build`
// listing it as ○ Static). A scraper makes exactly one request and then caches
// for months; a Postgres round trip on that request would buy nothing and add
// a failure mode on the only request that matters.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Read aloud by screen readers on platforms that surface the preview's alt
// text (and by X's image description). Matches the og:title in app/layout.tsx.
export const alt = "ScriptOverNovel — House of Arts";

// tailwind.config.ts's `ink`, `cream` and `sepia.light`, plus the four squid
// accents that are also Profile.faviconIconColors' defaults (see
// prisma/schema.prisma) and the wordmark's per-letter hover colours.
const INK = "#0D0D0D";
const SEPIA_LIGHT = "#E8D5A8";
const YELLOW = "#FFE135";
const GREEN = "#44D700";
const PINK = "#FF6B9D";
const CYAN = "#5BC8F5";

// The wordmark, split exactly the way FooterWordmark.tsx splits it, so the
// colour lands on the same letter groups in both places.
const WORDMARK = [
  { text: "KA", color: YELLOW },
  { text: "LA", color: GREEN },
  { text: "M", color: PINK },
] as const;

// The squid's own colour. On the live site it cycles through all four accents
// (squidCycle in tailwind.config.ts), so any single value here is one frame of
// that loop — pink is the chosen frame.
const SQUID_COLOR = PINK;
// The same pink as an rgba triple, for the halo below. Satori won't take a hex
// inside a gradient's alpha stops, so it can't just reuse the constant.
const SQUID_GLOW_RGB = "255, 107, 157";

// components/ui/SquidIcon.tsx's two paths, inlined. Satori can't resolve
// `currentColor` through an <img>, so the stroke colour is baked in.
// Rendered as a data-URI <img> rather than inline <svg> because that is the
// path through Satori with the fewest surprises.
const SQUID_PATHS = [
  "M7.5 17.25v3a3.01 3.01 0 0 1-3 3a3.01 3.01 0 0 1-3-3m15-3v3a3.01 3.01 0 0 0 3 3a3.01 3.01 0 0 0 3-3m-7.647-13.5h4.823a.75.75 0 0 0 .372-1.4l-7.3-4.4a1.5 1.5 0 0 0-1.488 0l-7.3 4.4a.75.75 0 0 0 .372 1.4h4.815",
  "M10.128 5.058A15.64 15.64 0 0 0 7.5 13.737v3.513h9v-3.513c0-3.089-.914-6.109-2.628-8.679a2.25 2.25 0 0 0-3.744 0M10.5 17.25v4.5m3-4.5v4.5",
];

const squidSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${SQUID_COLOR}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">${SQUID_PATHS.map(
  (d) => `<path d="${d}"/>`,
).join("")}</svg>`;

const SQUID_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(squidSvg).toString("base64")}`;

// Two families, both vendored in public/fonts/ as raw .ttf: Satori (what
// ImageResponse renders through) needs font bytes it can parse, cannot read
// the .woff2 Google serves, and next/font exposes no path to what it
// downloads. BadaBoom was already in the repo for the wordmark; Space Grotesk
// is the display face `font-grotesk` puts on the site's own headings, added
// as two static weights rather than the variable font because Satori applies
// only a variable font's default instance.
//
// Read off disk at BUILD time, not per request — this route is statically
// prerendered (see the header note), so the bytes are baked into the PNG and
// Vercel's serverless filesystem never enters into it.
const FONT_DIR = join(process.cwd(), "public", "fonts");

async function loadBrandFonts() {
  try {
    const [badaboom, grotesk, groteskBold] = await Promise.all([
      readFile(join(FONT_DIR, "BadaBoomBB.ttf")),
      readFile(join(FONT_DIR, "SpaceGrotesk-Medium.ttf")),
      readFile(join(FONT_DIR, "SpaceGrotesk-Bold.ttf")),
    ]);
    return [
      { name: "BadaBoom", data: badaboom, weight: 400 as const, style: "normal" as const },
      { name: "Space Grotesk", data: grotesk, weight: 500 as const, style: "normal" as const },
      { name: "Space Grotesk", data: groteskBold, weight: 700 as const, style: "normal" as const },
    ];
  } catch {
    // Falling back rather than throwing keeps a deploy from dying over a
    // share card. Satori drops to its own bundled face — the lockup loses its
    // comic-display character but the card still renders and still reads.
    return undefined;
  }
}

// Satori supports flexbox only and errors on a node with multiple children
// that doesn't declare it, which is why every element below sets
// `display: flex` explicitly.
export default async function OpengraphImage() {
  const fonts = await loadBrandFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: INK,
          fontFamily: "Space Grotesk",
          // The page-glass wash the live site puts behind its content,
          // flattened to something Satori can draw.
          backgroundImage:
            "radial-gradient(circle at 50% 20%, rgba(232, 213, 168, 0.18), rgba(13, 13, 13, 0) 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 500,
            // Trailing letter-spacing hangs off the last glyph, which pulls
            // centered text visually left; the same value back as padding
            // re-centers the line. Same trick on HOUSE OF ARTS below.
            letterSpacing: 14,
            paddingLeft: 14,
            color: "rgba(232, 213, 168, 0.65)",
          }}
        >
          COLLECTION
        </div>

        {/* SCRIPT/N(squid)VEL. tracking-[0.25em] on the live wordmark, which at
            this size is ~34px — applied per span rather than to the row,
            since letter-spacing doesn't trail a flex item's box. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "BadaBoom",
            fontSize: 136,
            letterSpacing: 34,
            // Same re-centering as the two Space Grotesk lines: the 34px
            // trailing the final "I" is real width in the row's box, so
            // without this the whole lockup sits half that far left of centre.
            paddingLeft: 34,
            marginTop: 30,
            marginBottom: 30,
          }}
        >
          {WORDMARK.map(({ text, color }) => (
            <div key={text} style={{ display: "flex", color }}>
              {text}
            </div>
          ))}

          {/* The squid replaces the second A. marginRight stands in for the
              letter-spacing its box doesn't get, exactly as the mr-[0.25em]
              on FooterWordmark's wrapper does. */}
          <div
            style={{
              display: "flex",
              position: "relative",
              alignItems: "center",
              justifyContent: "center",
              width: 122,
              height: 122,
              marginRight: 34,
            }}
          >
            {/* animate-squid-glow's halo, frozen. A real drop-shadow filter
                is beyond Satori, so the glow is a radial gradient behind the
                glyph instead. */}
            <div
              style={{
                display: "flex",
                position: "absolute",
                top: -30,
                left: -30,
                right: -30,
                bottom: -30,
                backgroundImage: `radial-gradient(circle, rgba(${SQUID_GLOW_RGB}, 0.38), rgba(${SQUID_GLOW_RGB}, 0) 70%)`,
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SQUID_DATA_URI} width={122} height={122} alt="A" />
          </div>

          <div style={{ display: "flex", color: CYAN }}>RI</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: 18,
            paddingLeft: 18,
            color: SEPIA_LIGHT,
          }}
        >
          HOUSE OF ARTS
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
