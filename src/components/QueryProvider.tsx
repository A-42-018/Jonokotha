"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api-client";

/** TanStack Query for the screens that talk to /api/v1. Mounted per route group, not in the root layout, to keep first-load JS small. */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => (e instanceof ApiError && e.status >= 400 && e.status < 500 ? false : n < 2) },
      mutations: { retry: false },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
