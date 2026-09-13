// lib/social-icons.tsx
import type { JSX, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function FacebookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function TikTokIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
      <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
    </svg>
  );
}

function LinkedInIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function RedditIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M16.5 11.5a1.5 1.5 0 0 0-2.5-.2 8 8 0 0 0-4 0 1.5 1.5 0 0 0-2.5.2" />
      <circle cx="9.5" cy="13.5" r=".75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="13.5" r=".75" fill="currentColor" stroke="none" />
      <path d="M9.5 16.5c.8.7 4.2.7 5 0" />
      <path d="M12 9V7" />
      <circle cx="15" cy="6" r="1.5" />
    </svg>
  );
}

function VGenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <polyline points="4 4 12 20 20 4" />
    </svg>
  );
}

function YouTubeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  );
}

function DiscordIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8.12 12a1.12 1.12 0 1 0 0-2.24 1.12 1.12 0 0 0 0 2.24Z" fill="currentColor" stroke="none" />
      <path d="M15.88 12a1.12 1.12 0 1 0 0-2.24 1.12 1.12 0 0 0 0 2.24Z" fill="currentColor" stroke="none" />
      <path d="M9.5 17c0 1 1.5 3 2.5 3 1 0 2.5-2 2.5-3" />
      <path d="M20.33 4.67A18.78 18.78 0 0 0 15.5 3c-.26.46-.53 1.02-.72 1.5a17.47 17.47 0 0 0-5.56 0C9.03 4.02 8.76 3.46 8.5 3a18.78 18.78 0 0 0-4.83 1.67C.96 9.22.18 13.67.56 18.06A18.9 18.9 0 0 0 6.32 21c.45-.62.85-1.28 1.2-1.98a12.22 12.22 0 0 1-1.89-.91l.46-.37a13.44 13.44 0 0 0 11.82 0l.46.37c-.6.36-1.23.67-1.89.91.35.7.75 1.36 1.2 1.98a18.86 18.86 0 0 0 5.76-2.94c.44-5.16-.76-9.57-3.11-13.33Z" />
    </svg>
  );
}

function TwitchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7" />
    </svg>
  );
}

function PinterestIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6c-2.8 0-5 2.2-5 5 0 1.8 1 3.4 2.4 4.2-.1-.9 0-2.1.2-3.1l.8-3.2s-.2-.4-.2-1c0-1 .6-1.8 1.3-1.8.6 0 .9.5.9 1 0 .6-.4 1.5-.6 2.4-.2.7.3 1.3 1.1 1.3 1.3 0 2.2-1.4 2.2-3.4 0-1.8-1.3-3-3.1-3-2.1 0-3.4 1.6-3.4 3.3 0 .6.2 1.3.5 1.7.1.1.1.2.1.3l-.2.7c0 .2-.1.2-.3.1-.9-.4-1.5-1.8-1.5-2.9 0-2.3 1.7-4.5 4.8-4.5 2.5 0 4.5 1.8 4.5 4.2 0 2.5-1.6 4.5-3.8 4.5-.7 0-1.4-.4-1.7-.8l-.5 1.7c-.2.6-.6 1.4-.9 1.8" />
    </svg>
  );
}

function ThreadsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.186 24h-.007C5.965 24 2.615 20.178 2.615 14.736V9.264C2.615 3.822 5.965 0 12.179 0h.007c6.214 0 9.564 3.822 9.564 9.264v5.472C21.75 20.178 18.4 24 12.186 24z" fill="none" />
      <path d="M16.87 11.18c-.12-.06-.24-.11-.37-.16a5.7 5.7 0 0 0-1.68-4.47 5.24 5.24 0 0 0-3.66-1.24 4.98 4.98 0 0 0-3.85 1.62l1.36 1.38a3.41 3.41 0 0 1 2.55-.97c1.02.02 1.79.34 2.28.95.36.44.6 1.01.7 1.72a8.29 8.29 0 0 0-2.6-.21c-2.58.16-4.23 1.62-4.12 3.64.06 1.02.55 1.9 1.39 2.49.71.5 1.62.74 2.58.7 1.26-.06 2.24-.48 2.94-1.26.53-.59.87-1.35 1.02-2.3.61.37 1.06.86 1.3 1.44.4.99.43 2.62-.88 3.93-1.15 1.14-2.53 1.63-4.38 1.65-2.06-.02-3.62-.68-4.64-1.95-.95-1.18-1.44-2.88-1.46-5.06.02-2.18.51-3.88 1.46-5.06 1.02-1.27 2.58-1.93 4.64-1.95 2.08.02 3.68.69 4.73 1.98.51.63.89 1.4 1.14 2.28l1.88-.52a8.16 8.16 0 0 0-1.56-3.04c-1.41-1.74-3.52-2.64-6.18-2.67-2.88.03-5.12.98-6.44 2.62C4.05 8.64 3.44 10.8 3.42 13.3c.02 2.5.63 4.66 1.82 6.16 1.32 1.64 3.56 2.59 6.44 2.62 2.29-.02 4.06-.68 5.56-2.18 2.07-2.07 1.94-4.61 1.28-6.22-.47-1.14-1.37-2.08-2.65-2.7zm-3.36 4.12c-1.06.07-2.16-.38-2.21-1.35-.04-.72.54-1.53 2.21-1.63.2-.01.38-.02.56-.02.65 0 1.25.08 1.8.22-.2 2.38-1.3 2.71-2.36 2.78z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BehanceIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M1 12.5h7.5M1 7.5h6.5M1 17.5h7" />
      <path d="M1 5h6a3.5 3.5 0 0 1 0 7H1V5z" />
      <path d="M1 12h7a3.5 3.5 0 0 1 0 7H1v-7z" />
      <path d="M15 17.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
      <path d="M15 13h5.5" />
      <path d="M14 6h5" />
    </svg>
  );
}

function DeviantArtIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 3h-5l-1.5 2.5L9 3H6v6l2.5 2.5L6 14v7h5l1.5-2.5L15 21h3v-6l-2.5-2.5L18 9V3z" />
    </svg>
  );
}

function LinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export type SocialIconEntry = {
  label: string;
  Icon: (props: IconProps) => JSX.Element;
};

export const SOCIAL_ICON_REGISTRY: Record<string, SocialIconEntry> = {
  facebook:   { label: "Facebook",    Icon: FacebookIcon },
  instagram:  { label: "Instagram",   Icon: InstagramIcon },
  tiktok:     { label: "TikTok",      Icon: TikTokIcon },
  x:          { label: "X (Twitter)", Icon: XIcon },
  linkedin:   { label: "LinkedIn",    Icon: LinkedInIcon },
  reddit:     { label: "Reddit",      Icon: RedditIcon },
  vgen:       { label: "VGen",        Icon: VGenIcon },
  youtube:    { label: "YouTube",     Icon: YouTubeIcon },
  discord:    { label: "Discord",     Icon: DiscordIcon },
  twitch:     { label: "Twitch",      Icon: TwitchIcon },
  pinterest:  { label: "Pinterest",   Icon: PinterestIcon },
  threads:    { label: "Threads",     Icon: ThreadsIcon },
  behance:    { label: "Behance",     Icon: BehanceIcon },
  deviantart: { label: "DeviantArt",  Icon: DeviantArtIcon },
  link:       { label: "Custom Link", Icon: LinkIcon },
};

/** The icon keys in display order */
export const SOCIAL_ICON_KEYS = Object.keys(SOCIAL_ICON_REGISTRY);

/** Default hover colors that cycle in the footer */
export const DEFAULT_HOVER_COLORS = [
  "#FFE135", // yellow
  "#44D700", // green
  "#FF6B9D", // pink
  "#5BC8F5", // blue
];
