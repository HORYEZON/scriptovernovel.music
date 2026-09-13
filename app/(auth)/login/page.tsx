// app/(auth)/login/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import LoginForm from "./LogInForm";

export const metadata: Metadata = { title: "Login" };

async function getLogo() {
  try {
    const headersList = await headers();
    const host = headersList.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

    const res = await fetch(`${protocol}://${host}/api/profile`, {
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.logoImage || null;
  } catch {
    return null;
  }
}

export default async function LoginPage() {
  const logoSrc = await getLogo();

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
      <LoginForm initialLogoSrc={logoSrc} />
    </Suspense>
  );
}