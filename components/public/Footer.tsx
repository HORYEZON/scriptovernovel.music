// components/public/Footer.tsx
import Link from "next/link";
import { SocialLinkItem } from "@/components/public/SocialLinkItem";
import { FooterWordmark } from "@/components/public/FooterWordmark";
import { FooterVisitorCount } from "@/components/public/FooterVisitorCount";

export type FooterSocialLink = {
  label: string;
  url: string;
  iconKey: string;
  hoverColor: string;
};

export function Footer({
  socialLinks,
  footerIcon,
}: {
  socialLinks?: FooterSocialLink[];
  footerIcon?: string | null;
}) {
  return (
    <footer className="border-t border-white/10 bg-ink/80 dark:bg-ink/90 backdrop-blur-xl backdrop-saturate-150 text-cream">
      <div className="section-padding py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <FooterWordmark icon={footerIcon} />
            <p className="mt-4 font-body text-sm text-ink-300 leading-relaxed max-w-xs">
              The only squid here is the flexibility. &apos;Di po ako nag-ooffer ng{" "}
              <Link
                href="/admin/dashboard"
                className="hover:text-ink-100 hover:underline transition-colors cursor-pointer"
              >
                Calamares
              </Link>
              .
            </p>
            <div className="mt-4">
              <FooterVisitorCount />
            </div>
          </div>

          {/* Links */}
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-ink-300 mb-4">
              Navigate
            </p>
            <div className="flex flex-col gap-2">
              {[
                { href: "/gallery", label: "Gallery" },
                // { href: "/shop", label: "Shop" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-body text-sm text-ink-300 hover:text-cream transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Connect */}
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-ink-300 mb-4">
              Connect
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-4 mt-1">
                {(socialLinks ?? []).map(({ url, label, iconKey, hoverColor }) => (
                  <SocialLinkItem
                    key={`${iconKey}-${url}`}
                    url={url}
                    label={label}
                    iconKey={iconKey}
                    hoverColor={hoverColor}
                  />
                ))}
              </div>
              <a
                href="mailto:kylamarie.zuniga@gmail.com"
                className="font-body text-sm text-ink-300 hover:text-cream transition-colors"
              >
                kylamarie.zuniga@gmail.com
              </a>
              <span className="font-body text-sm text-ink-300">NCR, Philippines</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 md:mt-16 md:pt-8 border-t border-ink-800 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="w-full text-center font-body text-xs text-ink-300 tracking-widest uppercase">
            <a
                href="https://www.facebook.com/horyezon.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cream transition-colors duration-200"
              >
                © {new Date().getFullYear()} HoryezoN Indie Solutions Inc.
              </a>{" "}
            <span className="whitespace-nowrap">All rights reserved.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}