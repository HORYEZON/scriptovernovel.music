// lib/site-logo.ts
//
// The site's one logo, for everything that stamps it somewhere other than the
// public header: the admin sidebar, the login page, order receipts, every
// transactional email, mini-game alerts, and the museum's About plaque (which
// the 📸 screenshot watermark also reads).
//
// Those all used to read Profile.logoImage — Preferences → Branding's "Navbar
// Logo" tile. That tile duplicated Site Design → Header's logo upload, and was
// removed; left pointing at Profile.logoImage, every one of these would have
// frozen on whatever was uploaded there last, with no control left to change
// it. So: Site Design's header logo first, and the old Branding upload only as
// a fallback while no header logo is set — a site that has never uploaded one
// keeps the logo it already had instead of going blank.
//
// Server-only (Prisma). Not React-cache()d on purpose: route handlers and the
// mailer call this outside any render. Inside a render, lib/site-design-
// server.ts's cached getSiteDesign() is the cheaper read.
import { prisma } from "@/lib/prisma";

export async function getSiteLogoUrl(profileLogoImage?: string | null): Promise<string | null> {
  const design = await prisma.siteDesign
    .findUnique({ where: { id: "singleton" }, select: { headerLogoImage: true } })
    .catch(() => null);
  return design?.headerLogoImage || profileLogoImage || null;
}
