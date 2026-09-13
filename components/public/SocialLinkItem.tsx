"use client";

import { SOCIAL_ICON_REGISTRY } from "@/lib/social-icons";

type Props = {
  url: string;
  label: string;
  iconKey: string;
  hoverColor: string;
  /** Icon size, as Tailwind classes. Defaults to the 32px every existing
   * caller renders — only the museum's About drawer overrides it, where a
   * landscape phone has to fit the whole vertical list into a box no taller
   * than the phone is wide (see AboutRoomCorner.tsx). */
  iconClassName?: string;
};

export function SocialLinkItem({ url, label, iconKey, hoverColor, iconClassName = "w-8 h-8" }: Props) {
  const entry = SOCIAL_ICON_REGISTRY[iconKey];
  if (!entry) return null;
  const { Icon } = entry;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="text-ink-300 transition-colors duration-200"
      onMouseEnter={(e) => (e.currentTarget.style.color = hoverColor)}
      onMouseLeave={(e) => (e.currentTarget.style.color = "")}
    >
      <Icon className={iconClassName} />
    </a>
  );
}
