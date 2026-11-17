"use client";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import type { Dict } from "@/lib/i18n";

/** Looks up a dictionary key built at run time (status names). Falls back to the raw value, never throws. */
export const label = (t: Dict, prefix: string, v: string) => ((t as unknown as Record<string, string>)[`${prefix}${v}`] ?? v);

/** One place for loading, error, offline, no-access and empty states of every office list (F5.4). */
export default function Boundary<T>({ q, isEmpty, emptyTitle, children }: { q: UseQueryResult<T>; isEmpty?: (d: T) => boolean; emptyTitle: string; children: (d: T) => ReactNode }) {
  const t = useT();
  if (q.isPending) return <div role="status" aria-label={t.owLoading} className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (q.isError) {
    const e = q.error;
    if (e instanceof ApiError && (e.status === 403 || e.status === 401)) return <EmptyState title={t.owNoAccessTitle} body={t.owNoAccessBody} />;
    return (
      <div role="alert" className="space-y-2">
        <p className="font-medium">{t.owErrorTitle}</p>
        <p className="text-muted">{e instanceof ApiError && e.isNetwork ? t.owOffline : t.owErrorTitle}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>{t.owRetry}</Button>
      </div>
    );
  }
  if (isEmpty?.(q.data)) return <EmptyState variant="officeEmpty" title={emptyTitle} />;
  return <>{children(q.data)}</>;
}

/** The message shown under a failed save: offline or a refusal. */
export function saveError(t: Dict, e: unknown): string {
  if (e instanceof ApiError && e.isNetwork) return t.owOffline;
  if (e instanceof ApiError && e.status === 403) return t.owNoAccessBody;
  return t.owSaveFailed;
}
