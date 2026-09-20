// components/public/system/GlassPanel.tsx
//
// The dark frosted panel every public page used to hand-copy
// (`bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5
// shadow-2xl`) — one component so the whole site's surfaces read as one
// system and a change to the glass is a change in one place. Server-safe.
import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const PADDING = {
  page: "p-8 md:p-14",
  card: "p-5 md:p-6",
  none: "",
} as const;

export function GlassPanel({
  as: Tag = "div",
  padding = "card",
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  padding?: keyof typeof PADDING;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  // createElement rather than <Tag>: a polymorphic `as` typed as ElementType
  // trips TS's JSX children inference ("expects type never").
  return createElement(
    Tag,
    {
      className: cn(
        "relative rounded-2xl border border-white/5 bg-black/30 shadow-2xl backdrop-blur-sm dark:bg-black/45",
        PADDING[padding],
        className
      ),
      ...rest,
    },
    children
  );
}
