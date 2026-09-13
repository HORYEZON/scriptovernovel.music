// components/admin/AdminQueryProvider.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Scoped to app/(admin) only — the public site is server-rendered and has
// no client-side server-state to cache. Mounted once in the admin layout,
// below the auth() check, so every admin screen shares one cache.
export function AdminQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
