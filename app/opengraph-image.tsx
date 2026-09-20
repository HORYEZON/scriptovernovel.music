// app/opengraph-image.tsx
//
// Next's "opengraph-image" file convention — the 1200x630 card every social
// platform (Facebook, Messenger, X, LinkedIn, Discord, Slack, Viber) shows
// when someone shares a link. Sitting at the app root makes it the site-wide
// default: Next injects og:image and twitter:image, plus their width/height/
// type, into every route that doesn't declare its own.
//
// The band's card in the site's hazy direction: the name in thin Fraunces
// over ink, lit from behind by a soft sepia glow with a cooler second light
// low right, a tracked genre line under it. Flat by necessity — a link
// preview is a downloaded PNG drawn by the platform's own UI, no CSS, no
// motion — so the live site's blur-and-grain atmosphere is approximated with
// two radial gradients.
//
// Drawn rather than shipped as a static PNG so it can't drift from the
// palette in tailwind.config.ts, and deliberately DB-free (no Profile or
// Site Design read) so the route prerenders to a static PNG at build time —
// a scraper makes one request and caches for months, and a Postgres round
// trip on that one request would only add a failure mode. The band name
// here is therefore lib/site-design.ts's default, not the admin's live
// header text; change both when the name changes.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { DEFAULT_SITE_DESIGN } from "@/lib/site-design";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Read aloud by screen readers on platforms that surface the preview's alt
// text (and by X's image description). Matches the og:title in app/layout.tsx.
export const alt = "ScriptOverNovel — shoegaze, dreampop, math rock and post-rock from Valenzuela City";

// tailwind.config.ts's `ink`, `cream`, `sepia.light` and `azure`.
const INK = "#0D0D0D";
const CREAM = "#FAF8F3";
const SEPIA_LIGHT = "#E8D5A8";

const GENRES = "SHOEGAZE · DREAMPOP · MATH ROCK · POST-ROCK";
const PLACE = "VALENZUELA CITY, PH";

// Vendored .ttf in public/fonts/: Satori (what ImageResponse renders
// through) needs font bytes it can parse, cannot read the .woff2 Google
// serves, and next/font exposes no path to what it downloads. Fraunces Light
// is the static instance of the display serif the site's headings use;
// Space Grotesk carries the tracked caps lines.
//
// Read off disk at BUILD time, not per request — this route is statically
// prerendered (see the header note), so the bytes are baked into the PNG and
// Vercel's serverless filesystem never enters into it.
const FONT_DIR = join(process.cwd(), "public", "fonts");

async function loadBrandFonts() {
  try {
    const [fraunces, grotesk] = await Promise.all([
      readFile(join(FONT_DIR, "Fraunces-Light.ttf")),
      readFile(join(FONT_DIR, "SpaceGrotesk-Medium.ttf")),
    ]);
    return [
      { name: "Fraunces", data: fraunces, weight: 300 as const, style: "normal" as const },
      { name: "Space Grotesk", data: grotesk, weight: 500 as const, style: "normal" as const },
    ];
  } catch {
    // Falling back rather than throwing keeps a deploy from dying over a
    // share card. Satori drops to its own bundled face — the card loses its
    // serif but still renders and still reads.
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
          // Two soft lights standing in for the blurred hero photo: the warm
          // house light behind the name, a cooler one low and to the right.
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(232, 213, 168, 0.22), rgba(13, 13, 13, 0) 55%), radial-gradient(circle at 82% 88%, rgba(110, 154, 200, 0.16), rgba(13, 13, 13, 0) 45%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 500,
            // Trailing letter-spacing hangs off the last glyph, which pulls
            // centered text visually left; the same value back as padding
            // re-centers the line. Same trick on the genre line below.
            letterSpacing: 12,
            paddingLeft: 12,
            color: "rgba(232, 213, 168, 0.7)",
          }}
        >
          {PLACE}
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Fraunces",
            fontSize: 148,
            fontWeight: 300,
            letterSpacing: -3,
            lineHeight: 1,
            marginTop: 26,
            marginBottom: 34,
            color: CREAM,
          }}
        >
          {DEFAULT_SITE_DESIGN.headerLogoText}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 500,
            letterSpacing: 9,
            paddingLeft: 9,
            color: SEPIA_LIGHT,
          }}
        >
          {GENRES}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
