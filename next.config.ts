// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      { protocol: "https", hostname: "**.supabase.co" },
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
