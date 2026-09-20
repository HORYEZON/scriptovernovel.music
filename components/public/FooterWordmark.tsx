// components/public/FooterWordmark.tsx
//
// Static fallback lockup for places that have no Site Design settings in
// hand (the admin sidebar and the login card, when their uploaded logo is
// missing or dead): the band's default wordmark from lib/site-design.ts
// with the admin-picked icon as its seal. The public footer and the
// entrance splash render components/public/system/Wordmark.tsx directly,
// with the admin's live header text/font/image.
import { Wordmark } from "@/components/public/system/Wordmark";
import { DEFAULT_SITE_DESIGN } from "@/lib/site-design";

export function FooterWordmark({ icon, className }: { icon?: string | null; className?: string }) {
  return (
    <Wordmark
      text={DEFAULT_SITE_DESIGN.headerLogoText}
      fontFamily={DEFAULT_SITE_DESIGN.headerLogoFontFamily}
      icon={icon}
      className={className ?? "text-4xl"}
    />
  );
}
