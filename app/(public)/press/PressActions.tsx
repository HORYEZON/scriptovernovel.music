"use client";

// app/(public)/press/PressActions.tsx
//
// The two things a press page has to let someone *do*: take the text away, and
// print the whole thing.
//
// `CopyButton` exists because the alternative is a journalist hand-selecting a
// paragraph out of a styled page and picking up stray whitespace. `PrintButton`
// is the one-sheet: the print stylesheet in globals.css turns /press into a
// clean document, and the browser's own dialog saves it as a PDF — the same
// route the order receipt takes rather than generating one server-side.
import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard access can be refused (an insecure origin, a locked-down
      // browser). Say nothing and leave the text on the page to select by
      // hand — the copy button is a convenience, not the only way through.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      data-print="hide"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-cream/20 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/70 transition-colors hover:border-cream/60 hover:text-cream",
        className
      )}
    >
      {copied ? (
        <>
          <Check size={11} /> Copied
        </>
      ) : (
        <>
          <Copy size={11} /> {label}
        </>
      )}
    </button>
  );
}

export function PrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print="hide"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-cream/30 px-6 py-3 font-body text-[11px] font-medium uppercase tracking-[0.18em] text-cream transition-transform duration-200 hover:scale-[1.04] active:scale-95",
        className
      )}
    >
      <Printer size={13} /> Print / Save as PDF
    </button>
  );
}
