// components/public/system/Eyebrow.tsx
//
// The small tracked label that sits above every heading on the site.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-body text-[11px] uppercase tracking-[0.5em] text-sepia-light", className)}>{children}</p>
  );
}
