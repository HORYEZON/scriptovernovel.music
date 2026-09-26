"use client";

// app/(public)/subscribe/unsubscribe/UnsubscribeClient.tsx
//
// The confirm button for an unsubscribe. Posts the token (see the page's own
// comment on why this isn't done on page load), then says so in place — no
// redirect, because someone who has just asked to stop hearing from us should
// not be dropped onto a page trying to sell them something.
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

export function UnsubscribeClient({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setState("sending");
    try {
      const res = await fetch("/api/subscribers/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <>
        <p className="font-fraunces text-xl font-light text-cream">Done — you&apos;re off the list</p>
        <p className="mt-2 font-body text-sm leading-relaxed text-cream/70">
          <span className="text-cream">{email}</span> won&apos;t hear from us again. Thanks for having
          listened.
        </p>
        <p className="mt-6 font-body text-xs text-cream/50">
          Changed your mind?{" "}
          <Link href="/subscribe" className="text-sepia-light underline decoration-sepia/40 hover:text-cream">
            Sign up again
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <p className="font-fraunces text-xl font-light text-cream">Take this address off the list?</p>
      <p className="mt-2 font-body text-sm leading-relaxed text-cream/70">
        <span className="text-cream">{email}</span> will stop getting emails about new releases and shows.
      </p>
      {error && (
        <p role="alert" className="mt-4 font-body text-xs text-vermillion">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={state === "sending"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-6 py-3 font-body text-[11px] font-medium uppercase tracking-[0.18em] text-ink transition-transform duration-200 hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "sending" ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Unsubscribing
            </>
          ) : (
            "Unsubscribe"
          )}
        </button>
        <Link
          href="/"
          className="font-body text-[11px] uppercase tracking-[0.18em] text-cream/60 transition-colors hover:text-cream"
        >
          Keep me on it
        </Link>
      </div>
    </>
  );
}
