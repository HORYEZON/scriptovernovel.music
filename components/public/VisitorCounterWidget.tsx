"use client";

// components/public/VisitorCounterWidget.tsx
//
// Registers this browser's visit and surfaces milestone-claim popups.
// The count display itself now lives in the Footer via FooterVisitorCount.
// This component renders nothing visible unless there's an unclaimed milestone.
//
// Hidden on /admin and /gallery/museum (no room / separate route group).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PartyPopper, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn } from "@/lib/utils";

interface AchievedMilestone {
  id: string;
  threshold: number;
  reward: string;
}

const HIDDEN_PREFIXES = ["/admin", "/gallery/museum"];
const DISMISSED_KEY = "scriptovernovel_visitor_milestones_dismissed";

export function VisitorCounterWidget() {
  const pathname = usePathname();
  const [achieved, setAchieved] = useState<AchievedMilestone[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [claimOpen, setClaimOpen] = useState<AchievedMilestone | null>(null);
  const [email, setEmail] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visitor-count", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setAchieved(Array.isArray(data.achievedMilestones) ? data.achievedMilestones : []);
      })
      .catch(() => {});
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (raw) setDismissed(new Set(JSON.parse(raw)));
    } catch {
      // Private browsing / storage disabled — dismissal won't stick across reloads.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }

  async function submitClaim(milestone: AchievedMilestone) {
    const trimmed = email.trim();
    if (!trimmed) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/visitor-milestones/${milestone.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to claim reward");
      toast.success("Claimed! We'll be in touch by email.");
      dismiss(milestone.id);
      setClaimOpen(null);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  }

  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;

  const unclaimed = achieved.filter((m) => !dismissed.has(m.id));
  if (unclaimed.length === 0 && !claimOpen) return null;

  return (
    <div className="fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40 flex flex-col items-start gap-2">
      {claimOpen && (
        <div className="w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#121212] shadow-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              🎉 {claimOpen.threshold.toLocaleString()} visitors!
            </p>
            <button
              onClick={() => setClaimOpen(null)}
              aria-label="Close"
              className="text-ink-400 hover:text-ink dark:hover:text-cream shrink-0"
            >
              <X size={16} />
            </button>
          </div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">{claimOpen.reward}</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full px-3 py-2 rounded-xl text-sm border border-black/10 dark:border-white/15 bg-transparent text-ink dark:text-cream placeholder:text-ink-400/60"
          />
          <button
            onClick={() => submitClaim(claimOpen)}
            disabled={claiming || !email.trim()}
            className="w-full py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
          >
            {claiming ? "Claiming…" : "Claim reward"}
          </button>
        </div>
      )}

      {unclaimed.length > 0 && (
        <button
          onClick={() => setClaimOpen(unclaimed[0])}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sepia text-white text-xs font-medium shadow-lg",
            "hover:bg-sepia-dark transition-colors animate-pulse"
          )}
        >
          <PartyPopper size={12} />
          🎉 Claim reward
        </button>
      )}
    </div>
  );
}
