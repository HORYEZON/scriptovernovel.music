// app/(auth)/reset-password/ResetPasswordForm.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type TokenState = "checking" | "valid" | "invalid";

export default function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token") || "";

    const [tokenState, setTokenState] = useState<TokenState>("checking");
    const [tokenError, setTokenError] = useState("");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setTokenState("invalid");
            setTokenError("This reset link is missing its token.");
            return;
        }

        (async () => {
            try {
                const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
                const data = await res.json();
                if (res.ok && data.valid) {
                    setTokenState("valid");
                } else {
                    setTokenState("invalid");
                    setTokenError(data.error || "This reset link is invalid or has expired.");
                }
            } catch {
                setTokenState("invalid");
                setTokenError("Something went wrong while checking your reset link.");
            }
        })();
    }, [token]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to reset password. Please try again.");
                return;
            }

            setSuccess(true);
            setTimeout(() => router.push("/login"), 2500);
        } catch {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
            <div className="page-glass-light" />

            <div className="relative z-10 w-full max-w-md">
                <div className="glass-card p-8 md:p-10">
                    <div className="flex justify-end mb-4">
                        <ThemeToggle />
                    </div>

                    <div className="text-center mb-10">
                        <p className="font-body text-1xl tracking-widest uppercase text-cream/70 drop-shadow-sm">
                            Reset Password
                        </p>
                    </div>

                    {tokenState === "checking" && (
                        <div className="flex flex-col items-center gap-4 py-6 text-cream/70">
                            <div className="w-8 h-8 border border-cream/30 border-t-cream rounded-full animate-spin" />
                            <p className="font-body text-sm">Checking your reset link...</p>
                        </div>
                    )}

                    {tokenState === "invalid" && (
                        <div className="text-center">
                            <div className="glass-alert-error">{tokenError}</div>
                            <Link
                                href="/login"
                                className="font-body text-xs text-cream/70 hover:text-cream transition-colors tracking-widest uppercase"
                            >
                                ← Back to Log In
                            </Link>
                        </div>
                    )}

                    {tokenState === "valid" && success && (
                        <div className="text-center">
                            <div className="glass-alert-success">
                                Your password has been reset. Redirecting you to log in...
                            </div>
                        </div>
                    )}

                    {tokenState === "valid" && !success && (
                        <>
                            {error && <div className="glass-alert-error">{error}</div>}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="label-glass">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            autoComplete="new-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="input-field-glass pr-12"
                                            placeholder="••••••••"
                                            minLength={8}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/50 hover:text-cream"
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="label-glass">Confirm Password</label>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="input-field-glass"
                                        placeholder="••••••••"
                                        minLength={8}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-glass-primary mt-6 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border border-ink/30 border-t-ink rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <KeyRound size={16} />
                                            Save New Password
                                        </>
                                    )}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="text-center mt-8">
                    <Link
                        href="/"
                        className="font-body text-xs text-cream/70 hover:text-cream transition-colors tracking-widest uppercase"
                    >
                        ← Back to site
                    </Link>
                </p>
            </div>
        </div>
    );
}
