"use client";

// components/public/SubscribeForm.tsx
//
// The mailing-list signup: one field, one button, and the acknowledgement in
// place of the form once it's sent. Used in the footer, on /shows when there
// are no dates booked, and on /subscribe.
//
// It stays on the page rather than navigating — a signup is a small favour, and
// making someone leave the page they were reading to do it is a way to get
// fewer of them. `variant="stacked"` is the footer's narrow column; "inline" is
// the roomier one.
import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidSubscriberEmail, normalizeEmail } from "@/lib/subscribers";

export function SubscribeForm({
  source,
  variant = "inline",
  className,
}: {
  /** One of lib/subscribers.ts's SUBSCRIBER_SOURCES — which form this is. */
  source: string;
  variant?: "inline" | "stacked";
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Checked here as well as on the server, using the same function, so a
    // typo is caught without a round trip.
    if (!isValidSubscriberEmail(normalizeEmail(email))) {
      setError("That doesn't look like an email address.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setMessage(data.message ?? null);
      setState("done");
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className={cn("flex items-start gap-2.5", className)}>
        <Check size={16} className="mt-0.5 shrink-0 text-sepia-light" />
        <p className="font-body text-sm leading-relaxed text-ink-300">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      <div className={cn("flex gap-2", variant === "stacked" ? "flex-col" : "flex-col sm:flex-row")}>
        <label className="sr-only" htmlFor={`subscribe-${source}`}>
          Email address
        </label>
        <input
          id={`subscribe-${source}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `subscribe-${source}-error` : undefined}
          className="min-w-0 flex-1 rounded-full border border-cream/15 bg-white/5 px-4 py-2.5 font-body text-sm text-cream placeholder-cream/35 transition-colors focus:border-sepia focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-cream/30 px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream/70 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "sending" ? (
            <>
              <Loader2 size={13} className="animate-spin" /> Sending
            </>
          ) : (
            <>
              Subscribe <ArrowRight size={13} />
            </>
          )}
        </button>
      </div>
      {error && (
        <p id={`subscribe-${source}-error`} role="alert" className="mt-2 font-body text-xs text-vermillion">
          {error}
        </p>
      )}
      <p className="mt-2 font-body text-[11px] leading-relaxed text-ink-300">
        New releases and new shows. Nothing else, and one click to leave.
      </p>
    </form>
  );
}
