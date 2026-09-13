// components/ui/SquidIcon.tsx
// Source: "Seafood Squid" from Streamline Ultimate (via shadcn.io/icon), CC BY 4.0.
import type { CSSProperties } from "react";

export function SquidIcon({
  className,
  style,
  onMouseEnter,
}: {
  className?: string;
  style?: CSSProperties;
  onMouseEnter?: () => void;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M7.5 17.25v3a3.01 3.01 0 0 1-3 3a3.01 3.01 0 0 1-3-3m15-3v3a3.01 3.01 0 0 0 3 3a3.01 3.01 0 0 0 3-3m-7.647-13.5h4.823a.75.75 0 0 0 .372-1.4l-7.3-4.4a1.5 1.5 0 0 0-1.488 0l-7.3 4.4a.75.75 0 0 0 .372 1.4h4.815" />
      <path d="M10.128 5.058A15.64 15.64 0 0 0 7.5 13.737v3.513h9v-3.513c0-3.089-.914-6.109-2.628-8.679a2.25 2.25 0 0 0-3.744 0M10.5 17.25v4.5m3-4.5v4.5" />
    </svg>
  );
}
