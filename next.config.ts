// next.config.ts
import type { NextConfig } from "next";

// Media is served from Cloudflare R2 behind whatever origin R2_PUBLIC_URL
// names (a custom domain, or the bucket's r2.dev development URL). Read at
// build time so next/image accepts it without a hardcoded hostname; the
// `**.r2.dev` fallback covers a deployment that hasn't set the variable yet.
const r2Host = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // Keep these out of the webpack server bundle and require() them from
  // node_modules at runtime instead. draco3dgltf locates its .wasm with
  // `__dirname + "/draco_encoder.wasm"` + readFileSync; bundled, __dirname is
  // the route chunk's directory, the file isn't there, and
  // createEncoderModule() rejects — which /api/upload/model/optimize caught and
  // reported as "keeping the original upload", so every .glb reached the
  // museum uncompressed in production while working perfectly under tsx.
  // Listed here, Next leaves the package intact and its file tracing carries
  // the .wasm into the function. sharp is already a default external; named
  // for the same reason so nobody removes it thinking it is unused.
  serverExternalPackages: ["draco3dgltf", "sharp"],
  // Belt and braces for the same wasm: make sure the optimize route's traced
  // files include the whole package, whatever the tracer infers from the
  // __dirname read above.
  outputFileTracingIncludes: {
    "/api/upload/model/optimize": ["./node_modules/draco3dgltf/**"],
  },
  images: {
    // Vercel's free tier only allows 5,000 image optimization transformations
    // per month. Once exhausted, every next/image request errors. Setting
    // unoptimized: true bypasses the optimizer entirely — images are served
    // directly from Supabase CDN at their original size, which is fine for
    // this project (Supabase already handles caching/CDN). This avoids the
    // broken-image symptom in the gallery section and artwork pages until
    // the plan is upgraded.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      ...(r2Host ? [{ protocol: "https" as const, hostname: r2Host }] : []),
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },

  // @font-face fetches are always CORS-mode requests, regardless of
  // context — without this, /fonts/*.ttf 404s silently (falls back to the
  // email's `cursive` fallback, no visible error) whenever it's loaded
  // cross-origin: the `email dev` preview server (a different port, so a
  // different origin) locally, and any webmail client (Gmail, Outlook web)
  // rendering the email in an iframe from *their* origin in production.
  // Fonts are public assets anyway, so allowing any origin is low-risk.
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
