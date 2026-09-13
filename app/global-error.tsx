// app/global-error.tsx
//
// Only fires if the ROOT layout itself throws (app/layout.tsx) — the rare,
// catastrophic case where even error.tsx can't render because it depends on
// the (now-broken) root layout too. Per Next.js convention this file must
// render its own complete <html>/<body>, replacing the root layout entirely.
//
// Deliberately static and dependency-light: no Prisma calls, no data
// fetching, nothing that could itself fail and leave the visitor with
// nothing at all. Tailwind's compiled stylesheet and next/font files are
// still served as static assets regardless of whether the root layout's own
// render succeeded, so the styling below is safe to rely on.
"use client";

import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-ink-900 text-white antialiased">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <div className="relative inline-flex items-center justify-center mb-8">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 scale-150 rounded-full bg-vermillion/25 opacity-70 blur-2xl"
              />
              <svg
                viewBox="0 0 24 24"
                className="relative w-16 h-16 text-vermillion"
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
            </div>

            <p className="text-xs tracking-[0.4em] uppercase text-sepia-light mb-3">
              ScriptOverNovel
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-widest uppercase mb-4">
              Something Went Wrong
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              The page failed to load. Please try again — if it keeps
              happening, check back a little later.
            </p>

            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => reset()}
                className="px-5 py-2.5 rounded-xl bg-sepia text-white text-sm font-medium"
              >
                Try Again
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl border border-white/15 text-white text-sm font-medium"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
