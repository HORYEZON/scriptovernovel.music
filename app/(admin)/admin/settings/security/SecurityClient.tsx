"use client";

// app/(admin)/admin/settings/security/SecurityClient.tsx
//
// Enrollment is a strict 3-step flow (start → scan → confirm) rather than
// one form, because totpEnabled must only flip on after a real code from
// the admin's app has been verified — see app/api/admin/totp/verify/route.ts.
// Skipping straight to "on" off the mere existence of a secret would let a
// broken/mistyped QR scan silently lock the admin out on next login.
import { useState } from "react";
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Timer,
} from "lucide-react";
import toast from "@/lib/toast";
import { cn } from "@/lib/utils";
import { INACTIVITY_OPTIONS, type InactivityMinutes } from "@/lib/inactivity";

type Step = "idle" | "scanning" | "recovery-codes";

export function SecurityClient({
  email,
  initialTotpEnabled,
  initialInactivityEnabled,
  initialInactivityMinutes,
}: {
  email: string;
  initialTotpEnabled: boolean;
  initialInactivityEnabled: boolean;
  initialInactivityMinutes: number;
}) {
  const [enabled, setEnabled] = useState(initialTotpEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Disable flow
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  // ── Automatic sign-out ──────────────────────────────────────────────
  // Saves on change rather than behind a Save button. Both controls are a
  // finished decision the moment they are touched (a switch and a pick from
  // three intervals — neither is half-composed the way a tagline is), and the
  // guard that enforces this reads its value from the server on the next
  // page load, so a staged-but-unsaved setting would silently not be in
  // effect. Same reasoning as the Entrance Splash's two switches.
  const [inactivityEnabled, setInactivityEnabled] = useState(initialInactivityEnabled);
  const [inactivityMinutes, setInactivityMinutes] = useState<number>(initialInactivityMinutes);
  const [savingInactivity, setSavingInactivity] = useState(false);

  async function saveInactivity(patch: { enabled?: boolean; minutes?: InactivityMinutes }) {
    // Optimistic: the switch moves under the finger, and rolls back below if
    // the write fails, so what is on screen is always what is stored.
    const previous = { enabled: inactivityEnabled, minutes: inactivityMinutes };
    if (patch.enabled !== undefined) setInactivityEnabled(patch.enabled);
    if (patch.minutes !== undefined) setInactivityMinutes(patch.minutes);
    setSavingInactivity(true);
    try {
      const res = await fetch("/api/admin/inactivity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setInactivityEnabled(data.enabled);
      setInactivityMinutes(data.minutes);
      toast.success(
        data.enabled
          ? `Signing out after ${
              INACTIVITY_OPTIONS.find((o) => o.minutes === data.minutes)?.label ??
              `${data.minutes} minutes`
            } of inactivity`
          : "Automatic sign-out is off"
      );
    } catch {
      setInactivityEnabled(previous.enabled);
      setInactivityMinutes(previous.minutes);
      toast.error("Couldn't save that setting.");
    } finally {
      setSavingInactivity(false);
    }
  }

  async function startEnrollment() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/totp/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setStep("scanning");
    } catch {
      toast.error("Could not start two-factor setup.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "That code didn't match.");
        return;
      }
      setRecoveryCodes(data.recoveryCodes ?? []);
      setStep("recovery-codes");
      setEnabled(true);
      setCode("");
      toast.success("Two-factor authentication is on");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  function finishEnrollment() {
    setStep("idle");
    setRecoveryCodes([]);
    setSecret("");
    setQrCodeDataUrl("");
  }

  async function disableTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not turn off two-factor authentication.");
        return;
      }
      setEnabled(false);
      setDisabling(false);
      setDisablePassword("");
      toast.success("Two-factor authentication is off");
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
        <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
          Two-Factor Authentication
        </p>

        {/* ── Status ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                enabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
              }`}
            >
              {enabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
            </div>
            <div>
              <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                {enabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 max-w-md">
                {enabled
                  ? `Codes from your authenticator app are required alongside your password for ${email}.`
                  : "Require a Google Authenticator code, in addition to your password, to sign in."}
              </p>
            </div>
          </div>
        </div>

        {/* ── Enroll: step 1, idle ───────────────────────────────── */}
        {step === "idle" && !enabled && (
          <button
            type="button"
            onClick={startEnrollment}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium bg-sepia hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
          >
            {loading ? "Starting…" : "Enable Two-Factor Authentication"}
          </button>
        )}

        {/* ── Enroll: step 2, scan + confirm ────────────────────── */}
        {step === "scanning" && (
          <div className="space-y-4 pt-2 border-t border-black/10 dark:border-white/10">
            <div>
              <p className="font-jakarta text-sm font-medium text-ink dark:text-cream mb-2">
                1. Scan this with Google Authenticator
              </p>
              {qrCodeDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image can't optimize it
                <img
                  src={qrCodeDataUrl}
                  alt="Two-factor authentication QR code"
                  className="w-44 h-44 rounded-xl border border-black/10 dark:border-white/10 bg-white p-2"
                />
              )}
              <div className="mt-2 flex items-center gap-2">
                <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <button
                  type="button"
                  onClick={copySecret}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2 py-1 rounded-lg bg-black/5 dark:bg-white/5 text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  {secret} {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <form onSubmit={confirmEnrollment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                  2. Enter the 6-digit code it shows
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-40 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream text-center font-mono tracking-widest focus:outline-none focus:border-sepia transition-colors text-sm"
                />
              </div>

              {error && <p className="font-body text-xs text-vermillion">{error}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium bg-sepia hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
                >
                  {loading ? "Verifying…" : "Confirm & Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep("idle")}
                  className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Enroll: step 3, recovery codes (shown once) ───────── */}
        {step === "recovery-codes" && (
          <div className="space-y-4 pt-2 border-t border-black/10 dark:border-white/10">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="font-body text-sm text-amber-700 dark:text-amber-400">
                Save these 10 recovery codes somewhere safe. Each one works
                once, to sign in if you ever lose your authenticator device.
                <strong> They will not be shown again.</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm text-ink dark:text-cream">
              {recoveryCodes.map((c) => (
                <div
                  key={c}
                  className="px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 text-center"
                >
                  {c}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={finishEnrollment}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium bg-sepia hover:bg-sepia-dark transition-all duration-200 shadow-md"
            >
              I&apos;ve saved these codes
            </button>
          </div>
        )}

        {/* ── Disable ────────────────────────────────────────────── */}
        {enabled && step === "idle" && (
          <div className="pt-2 border-t border-black/10 dark:border-white/10">
            {!disabling ? (
              <button
                type="button"
                onClick={() => setDisabling(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-vermillion font-jakarta text-sm font-medium bg-vermillion/10 hover:bg-vermillion/20 transition-all duration-200"
              >
                Turn Off Two-Factor Authentication
              </button>
            ) : (
              <form onSubmit={disableTotp} className="space-y-3 max-w-xs">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                  Confirm your password to turn it off
                </label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm"
                  placeholder="••••••••"
                />
                {error && <p className="font-body text-xs text-vermillion">{error}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading || !disablePassword}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-jakarta text-sm font-medium bg-vermillion hover:bg-vermillion/90 transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? "Turning off…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDisabling(false);
                      setDisablePassword("");
                      setError("");
                    }}
                    className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ── Automatic sign-out ─────────────────────────────────────── */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
        <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
          Automatic Sign-Out
        </p>

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                inactivityEnabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
              }`}
            >
              <Timer size={20} />
            </div>
            <div>
              <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                {inactivityEnabled
                  ? "Signing out after a period of inactivity"
                  : "Staying signed in until you sign out"}
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 max-w-md">
                {inactivityEnabled
                  ? "If nothing is clicked, typed or scrolled for the chosen time, this session ends. You'll get a warning first."
                  : "Turn this on to end your admin session automatically when the screen is left unattended."}
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={inactivityEnabled}
            aria-label={
              inactivityEnabled ? "Turn off automatic sign-out" : "Turn on automatic sign-out"
            }
            title={inactivityEnabled ? "Turn off" : "Turn on"}
            disabled={savingInactivity}
            onClick={() => void saveInactivity({ enabled: !inactivityEnabled })}
            className={cn(
              "shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-50",
              inactivityEnabled
                ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
                : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
            )}
          >
            {inactivityEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
          </button>
        </div>

        {/* Interval choices stay visible (disabled) while the feature is off,
            rather than unmounting — so the admin can see what turning it on
            would commit them to before they commit to it. */}
        <div className="pt-2 border-t border-black/10 dark:border-white/10">
          <p
            className={cn(
              "font-jakarta text-sm font-medium mb-3 transition-colors",
              inactivityEnabled ? "text-ink dark:text-cream" : "text-ink-400 dark:text-ink-300"
            )}
          >
            Sign out after
          </p>
          <div className="flex flex-wrap gap-2">
            {INACTIVITY_OPTIONS.map((option) => {
              const active = inactivityEnabled && inactivityMinutes === option.minutes;
              return (
                <button
                  key={option.minutes}
                  type="button"
                  disabled={!inactivityEnabled || savingInactivity}
                  aria-pressed={active}
                  onClick={() => void saveInactivity({ minutes: option.minutes })}
                  className={cn(
                    "px-4 py-2 rounded-xl font-jakarta text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed",
                    active
                      ? "bg-sepia text-white shadow-sm"
                      : "admin-input border text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-3 max-w-lg">
            Your other admin tabs count as activity too — working in one keeps the rest signed
            in. A backup or restore that&rsquo;s still running will hold the sign-out off rather
            than be interrupted mid-write.
          </p>
        </div>
      </div>
    </div>
  );
}
