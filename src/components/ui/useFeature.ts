"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchFlags } from "@/lib/ideas-r11-api";

/** Is a server feature flag on (`GET /features`)? False while loading and when the server cannot say, so the older behaviour stays. Needs a QueryProvider above. */
export function useFeature(key: string): boolean {
  const q = useQuery({ queryKey: ["features"], queryFn: fetchFlags, staleTime: 300_000 });
  return q.data?.[key] === true;
}
