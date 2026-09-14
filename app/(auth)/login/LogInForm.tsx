// app/(auth)/login/LoginForm.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { SafeImg } from "@/components/ui/SafeImage";
import { FooterWordmark } from "@/components/public/FooterWordmark";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/* Brand glyphs for the two OAuth buttons, inline rather than fetched: the
   login screen is the one page that has to render before anything else is
   trusted, and a logo pulled from a CDN is a third-party request on it. Both
   are the providers' own sign-in marks, drawn at 16px to sit on the same line
   as their label. */
function GoogleGlyph() {
    return (
        <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true" className="shrink-0">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
        </svg>
    );
}

function FacebookGlyph() {
    return (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="shrink-0">
            <path
                fill="#1877F2"
                d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
            />
        </svg>
    );
}

export default function LoginForm({
    initialLogoSrc,
}: {
    initialLogoSrc: string | null;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/admin/dashboard";

    const [form, setForm] = useState({ email: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Two-factor step — only entered once /api/auth/check-password confirms
    // the password is correct *and* the account has TOTP enabled. Nothing
    // about this step issues a session by itself; the final signIn() call
    // below re-checks the password itself, same as always.
    const [needsTotp, setNeedsTotp] = useState(false);
    const [code, setCode] = useState("");
    const [oauthLoading, setOauthLoading] = useState<"google" | "facebook" | null>(null);

    // Lockout / forgot-password helper — after enough consecutive failed
    // attempts we surface a "Forgot Password" option next to the field.
    const FAILED_ATTEMPTS_BEFORE_RESET_OFFER = 3;
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [resetLoading, setResetLoading] = useState(false);
    const [resetMessage, setResetMessage] = useState("");
    const [resetError, setResetError] = useState("");

    // Already resolved on the server before rendering in the browser — no flash/skeleton
    const logoSrc = initialLogoSrc;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");
        setResetMessage("");
        setResetError("");

        try {
            // First submit for a not-yet-verified TOTP account: find out
            // whether a code is required before attempting sign-in, so the
            // form can ask for it instead of just failing.
            if (!needsTotp) {
                const check = await fetch("/api/auth/check-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: form.email, password: form.password }),
                });
                const checkData = await check.json().catch(() => ({}));

                if (!check.ok) {
                    setError("Invalid email or password.");
                    setFailedAttempts((prev) => prev + 1);
                    return;
                }
                if (checkData.totpRequired) {
                    setNeedsTotp(true);
                    return;
                }
            }

            const result = await signIn("credentials", {
                email: form.email,
                password: form.password,
                code: needsTotp ? code : undefined,
                redirect: false,
            });

            if (result?.error) {
                setError(
                    needsTotp
                        ? "Invalid authenticator or recovery code."
                        : "Invalid email or password."
                );
                setFailedAttempts((prev) => prev + 1);
                if (needsTotp) setCode("");
            } else {
                setFailedAttempts(0);
                router.push(callbackUrl);
                router.refresh();
            }
        } catch {
            setError("An unexpected error occurred.");
            setFailedAttempts((prev) => prev + 1);
        } finally {
            setLoading(false);
        }
    }

    async function handleOAuth(provider: "google" | "facebook") {
        setOauthLoading(provider);
        setError("");
        try {
            await signIn(provider, { callbackUrl });
        } catch {
            setError("Could not start sign-in. Please try again.");
            setOauthLoading(null);
        }
    }

    async function handleForgotPassword() {
        setResetError("");
        setResetMessage("");

        if (!form.email) {
            setResetError("Enter your email above first, then try again.");
            return;
        }

        setResetLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: form.email }),
            });
            const data = await res.json();

            if (!res.ok) {
                setResetError(data.error || "Failed to send reset email. Please try again.");
                return;
            }

            setResetMessage(
                "If an account exists for that email, a password reset link has been sent — please check your inbox."
            );
        } catch {
            setResetError("Failed to send reset email. Please try again.");
        } finally {
            setResetLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            {/* Lighter overlay so the background photo reads brighter on this screen */}
            <div className="page-glass-light" />

            <div className="relative z-10 w-full max-w-md">

                {/* Frosted glass card, iOS-style */}
                <div className="glass-card p-7 sm:p-9">

                    {/* Dark mode toggle — pinned to the card's corner rather
                        than sitting in a row of its own. A full-width row for
                        one small control cost the card ~56px of height and
                        pushed the logo down with it, which is a real cost on a
                        screen whose whole job is two fields and a button. */}
                    <div className="absolute top-4 right-4 z-10">
                        <ThemeToggle />
                    </div>

                    {/* Logo. The gap under it was `mb-12` — a third of a phone
                        screen of empty space above a form that is already
                        short. */}
                    <div className="text-center mb-7">
                        {/* No logo, or a logo whose file is gone: the same
                            KALAM(squid)RI lockup as the public navbar/footer. */}
                        <SafeImg
                            src={logoSrc ?? undefined}
                            alt="ScriptOverNovel"
                            className="mx-auto h-[60px] w-auto max-w-[220px] object-contain"
                            fallback={
                                <div className="mx-auto h-[60px] flex items-center justify-center text-cream">
                                    <FooterWordmark className="text-3xl" />
                                </div>
                            }
                        />
                        {/* `text-1xl` isn't a Tailwind size — it silently did
                            nothing, so this line was inheriting whatever the
                            card handed it. Stated properly now, with the
                            wording unchanged. */}
                        <p className="font-body text-xs tracking-[0.3em] uppercase text-cream/60 drop-shadow-sm mt-3">
                            Admin Access — Log In
                        </p>
                    </div>

                    {/* Set by the admin panel's inactivity guard when it ends
                        a session (see components/admin/InactivityTimeout.tsx).
                        Without it, an auto sign-out looks to the admin like
                        the session mysteriously vanished on its own. Hidden
                        once they start typing, so it can't be mistaken for a
                        response to the attempt in progress. */}
                    {searchParams.get("timeout") === "1" && !error && !form.email && (
                        <div className="glass-alert-error">
                            You were signed out after a period of inactivity.
                        </div>
                    )}

                    {error && (
                        <div className="glass-alert-error">
                            {error}
                        </div>
                    )}

                    {resetMessage && (
                        <div className="glass-alert-success">
                            {resetMessage}
                        </div>
                    )}

                    {resetError && (
                        <div className="glass-alert-error">
                            {resetError}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {!needsTotp ? (
                            <>
                                <div>
                                    <label className="label-glass">Email</label>
                                    <input
                                        type="email"
                                        required
                                        autoComplete="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        className="input-field-glass"
                                        placeholder="admin@scriptovernovel.music"
                                    />
                                </div>

                                <div>
                                    <label className="label-glass">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            autoComplete="current-password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="input-field-glass pr-12"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/50 hover:text-cream"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    {failedAttempts >= FAILED_ATTEMPTS_BEFORE_RESET_OFFER && !resetMessage && (
                                        <div className="mt-3 text-right">
                                            <button
                                                type="button"
                                                onClick={handleForgotPassword}
                                                disabled={resetLoading}
                                                className="font-body text-xs text-cream/70 hover:text-cream transition-colors tracking-widest uppercase underline decoration-cream/30 underline-offset-4 disabled:opacity-50"
                                            >
                                                {resetLoading ? "Sending reset link..." : "Forgot Password?"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="label-glass">Authenticator or recovery code</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    inputMode="text"
                                    autoComplete="one-time-code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="input-field-glass text-center font-jakarta text-lg tracking-[0.4em] placeholder:tracking-[0.4em]"
                                    placeholder="000000"
                                />
                                {/* Same pill as "Back to site" below the card, so
                                    the two ways back read as one control rather
                                    than a link and a button that happen to share
                                    a word. */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNeedsTotp(false);
                                        setCode("");
                                        setError("");
                                    }}
                                    className="group mt-3 inline-flex items-center gap-2 pl-3.5 pr-4 py-2 rounded-full border border-cream/15 bg-white/5 backdrop-blur-sm font-jakarta text-[11px] tracking-widest uppercase text-cream/70 hover:text-cream hover:bg-white/10 hover:border-cream/30 transition-all duration-200"
                                >
                                    <ArrowLeft
                                        size={13}
                                        className="transition-transform duration-200 group-hover:-translate-x-0.5"
                                    />
                                    Back
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-glass-primary mt-6 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border border-ink/30 border-t-ink rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <LogIn size={16} />
                                    {needsTotp ? "Verify & Sign In" : "Sign In"}
                                </>
                            )}
                        </button>
                    </form>

                    {!needsTotp && (
                        <>
                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-cream/15" />
                                <span className="font-body text-[11px] uppercase tracking-widest text-cream/50">or</span>
                                <div className="flex-1 h-px bg-cream/15" />
                            </div>

                            {/* Two compact buttons on one row rather than two
                                full-width blocks stacked: these are the
                                *secondary* way in — a solid white bar and a
                                solid blue bar, each as heavy as the Sign In
                                button above them, made the card read as three
                                equal choices and ran it off a short screen.
                                Side by side they cost one row instead of two,
                                and the glass treatment lets the brand colour
                                live in the glyph, where it identifies the
                                provider without shouting over the form. */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleOAuth("google")}
                                    disabled={oauthLoading !== null}
                                    aria-label="Continue with Google"
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-cream font-body text-sm transition-colors disabled:opacity-50 disabled:hover:bg-white/5"
                                >
                                    {oauthLoading === "google" ? (
                                        <span className="text-cream/70">Redirecting…</span>
                                    ) : (
                                        <>
                                            <GoogleGlyph />
                                            Google
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOAuth("facebook")}
                                    disabled={oauthLoading !== null}
                                    aria-label="Continue with Facebook"
                                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-cream font-body text-sm transition-colors disabled:opacity-50 disabled:hover:bg-white/5"
                                >
                                    {oauthLoading === "facebook" ? (
                                        <span className="text-cream/70">Redirecting…</span>
                                    ) : (
                                        <>
                                            <FacebookGlyph />
                                            Facebook
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="font-body text-[11px] text-center text-cream/40 mt-3">
                                Admin accounts only — an email that isn&apos;t one can&apos;t sign in this way.
                            </p>
                        </>
                    )}
                </div>

                {/* Back to site — the one way off this screen, and previously
                    a bare line of text that read as a caption rather than
                    something to press. Now a pill with the same glass edge as
                    the card above it, with the arrow stepping left on hover so
                    the direction is felt as well as read. */}
                <div className="flex justify-center mt-7">
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-2 pl-3.5 pr-4 py-2 rounded-full border border-cream/15 bg-white/5 backdrop-blur-sm font-body text-[11px] tracking-widest uppercase text-cream/70 hover:text-cream hover:bg-white/10 hover:border-cream/30 transition-all duration-200"
                    >
                        <ArrowLeft
                            size={13}
                            className="transition-transform duration-200 group-hover:-translate-x-0.5"
                        />
                        Back to site
                    </Link>
                </div>
            </div>
        </div>
    );
}