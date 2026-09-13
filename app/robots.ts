// app/robots.ts
//
// App Router convention — automatically served at /robots.txt. Disallows
// the admin panel, API routes, auth pages, and the personalized/no-SEO-value
// pages (cart, checkout, wishlist are all localStorage/session-specific —
// nothing there is worth a crawler's time, and Shop isn't live yet anyway,
// see Navbar.tsx's commented-out Shop link).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/login",
        "/reset-password",
        "/cart",
        "/checkout",
        "/wishlist",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
