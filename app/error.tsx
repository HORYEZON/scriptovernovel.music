// app/error.tsx
//
// Next.js App Router convention: catches an unhandled error thrown anywhere
// in a route segment below the root layout (the root layout itself is still
// alive here — for a crash there, see global-error.tsx instead). Must be a
// Client Component; `reset()` re-renders the segment without a full reload.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { RotateCcw, Home } from "lucide-react";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { parseIconValue } from "@/components/ui/icon-values";

// Dynamic-imported like AdminSidebar.tsx/FaqChatbox.tsx — this boundary can
// mount on literally any page, so its own bundle should stay as light as
// possible; the ~3,000-entry icon maps only load if errorIcon is actually
// set (checked below, after the fetch resolves).
const DynamicIcon = nextDynamic(
  () => import("@/components/ui/DynamicIcon").then((m) => m.DynamicIcon),
  { ssr: false }
);

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Digest-only — the full error/stack isn't shown to visitors, just logged
  // for whoever's watching the server logs (or wire this into a monitoring
  // service later).
  useEffect(() => {
    console.error(error);
  }, [error]);

  // error.tsx (unlike global-error.tsx) still sits inside a live React tree
  // with the root layout intact, but Next's error-boundary convention only
  // ever passes it `error`/`reset` — no server-fetched Profile data. Best
  // effort only: renders the default squid immediately, then swaps in the
  // admin's chosen icon if/once this resolves. Any failure here (including
  // the API itself being what's down) just keeps the squid — an error page
  // whose icon depends on a successful fetch would defeat the point of it.
  const [errorIcon, setErrorIcon] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (!cancelled) setErrorIcon(profile?.errorIcon ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const parsedIcon = parseIconValue(errorIcon);

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="relative inline-flex items-center justify-center mb-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 scale-150 rounded-full bg-vermillion/25 opacity-70 blur-2xl"
          />
          {parsedIcon ? (
            <DynamicIcon
              platform={parsedIcon.platform}
              name={parsedIcon.name}
              className="relative w-16 h-16 text-vermillion"
              fallback={<SquidIcon className="relative w-16 h-16 text-vermillion" />}
            />
          ) : (
            <SquidIcon className="relative w-16 h-16 text-vermillion" />
          )}
        </div>

        <p className="font-body text-xs tracking-[0.4em] uppercase text-sepia-light mb-3">
          ScriptOverNovel
        </p>
        <h1 className="font-grotesk text-2xl sm:text-3xl font-bold tracking-widest uppercase text-white mb-4">
          Something Went Wrong
        </h1>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          An unexpected error occurred. It&apos;s been logged on our end —
          try again, or head back home.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-white/30 mt-4">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/15 text-white font-jakarta text-sm font-medium hover:bg-white/5 transition-colors"
          >
            <Home size={16} />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
