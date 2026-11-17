"use client";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api-client";
import Button from "./Button";
import { Skeleton } from "./Skeleton";
import { useT } from "./useT";

/** Loading, error (with retry) and offline for one query. Children render only when the data is there. */
export default function AsyncBlock({ pending, error, onRetry, errorText, children }: { pending: boolean; error: unknown; onRetry: () => void; errorText?: string; children: ReactNode }) {
  const t = useT();
  if (pending) return <div role="status" aria-label={t.r1Loading} className="space-y-2"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-24 w-full" /></div>;
  if (error) {
    const offline = error instanceof ApiError && error.isNetwork;
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
        <p>{offline ? t.r1Offline : errorText ?? t.r1Error}</p>
        <Button variant="secondary" onClick={onRetry}>{t.r1Retry}</Button>
      </div>
    );
  }
  return <>{children}</>;
}
