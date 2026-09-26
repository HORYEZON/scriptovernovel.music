"use client";

// components/public/store/NotifyMeForm.tsx
//
// The form that stands in for an Add-to-cart button on a product that can't be
// bought yet: sold out, or announced and not on sale.
//
// One email is ever sent, on the day it's available, and the form says so —
// there is no confirmation step and nothing to unsubscribe from, so the promise
// has to be plain here rather than in a follow-up.
import { useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isValidNotifyEmail, normalizeEmail } from "@/lib/store/notify";

export function NotifyMeForm({
  productId,
  /** The size/format they're waiting for, when one is picked. Null = any. */
  variantId = null,
  variantLabel = null,
  className,
}: {
  productId: string;
  variantId?: string | null;
  variantLabel?: string | null;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Checked with the same function the server uses, so a typo costs no round
    // trip.
    if (!isValidNotifyEmail(normalizeEmail(email))) {
      setError("That doesn't look like an email address.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/stock-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId, email }),
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
      <div className={cn("flex items-start gap-2.5 rounded-xl border border-sepia/30 bg-sepia/5 p-4", className)}>
        <Check size={16} className="mt-0.5 shrink-0 text-sepia-light" />
        <p className="font-body text-sm leading-relaxed text-cream/80">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)} noValidate>
      <label htmlFor={`notify-${productId}`} className="mb-2 flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-cream/60">
        <Bell size={12} /> Tell me when it&apos;s available
        {variantLabel && <span className="normal-case tracking-normal text-cream/45">· {variantLabel}</span>}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={`notify-${productId}`}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `notify-${productId}-error` : undefined}
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
            "Notify me"
          )}
        </button>
      </div>
      {error && (
        <p id={`notify-${productId}-error`} role="alert" className="mt-2 font-body text-xs text-vermillion">
          {error}
        </p>
      )}
      <p className="mt-2 font-body text-[11px] leading-relaxed text-cream/45">
        One email, on the day. We don&apos;t add you to anything else.
      </p>
    </form>
  );
}
