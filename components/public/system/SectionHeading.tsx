// components/public/system/SectionHeading.tsx
//
// Eyebrow + thin display-serif heading + optional action link, the header
// of every homepage section and inner-page block. The serif is Fraunces at
// light weight — the "hazy" direction's type: airy, not shouting.
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  as: Tag = "h2",
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** A trailing link, e.g. "All shows" → /about#shows. */
  action?: { label: string; href: string };
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className
      )}
    >
      <div className={cn("min-w-0", align === "center" && "flex flex-col items-center")}>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <Tag className="font-fraunces text-3xl font-light leading-[1.05] tracking-[-0.01em] text-cream md:text-5xl">
          {title}
        </Tag>
        {description && (
          <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-cream/60 md:text-base">{description}</p>
        )}
        <div className={cn("deco-line mt-5", align === "center" && "mx-auto")} />
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.25em] text-cream/60 transition-colors hover:text-cream"
        >
          {action.label}
          <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
