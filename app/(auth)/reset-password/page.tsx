// app/(auth)/reset-password/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="page-glass-light" />
        <div className="relative z-10 w-full max-w-md text-center">
          <div className="w-16 h-16 border border-cream/30 border-t-cream rounded-full animate-spin mx-auto mb-4" />
          <span className="font-display text-2xl font-light tracking-[0.3em] uppercase text-cream">
            Loading...
          </span>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
