// lib/site-url.ts
//
// Single source of truth for the site's absolute base URL — needed
// anywhere a fully-qualified link is required (sitemap.xml, robots.txt,
// JSON-LD structured data, OG metadata) rather than a relative path.
// Same fallback chain already used in app/api/auth/forgot-password and the
// artwork detail page; centralized here instead of repeated per-file.
export const SITE_URL =
  process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
