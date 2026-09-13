// components/public/CartProvider.tsx
"use client";

// This is a thin wrapper so the Zustand store hydrates correctly on the client
// The store itself is already persisted with Zustand's persist middleware.
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
