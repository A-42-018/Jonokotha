"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fetchIdea } from "@/lib/ideas-api";
import IdeaCard from "./IdeaCard";

export default function IdeaDetail(props: { refId: string; signedIn: boolean }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

/** One idea at its own address, so a shared link opens the idea itself. */
function Inner({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const q = useQuery({ queryKey: ["idea", refId], queryFn: () => fetchIdea(refId), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const back = <Link href="/ideas" className="inline-flex min-h-11 items-center text-civic underline">← {t.idBack}</Link>;
  if (q.isPending) return <div role="status" aria-label={t.idDetailLoading} className="space-y-3">{back}<Skeleton className="h-40 w-full" /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <div className="space-y-3">{back}<EmptyState variant="empty" title={t.idNotFoundTitle} body={t.idNotFoundBody} /></div>;
    return <div role="alert" className="space-y-3">{back}<p>{t.idDetailError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button></div>;
  }
  return <div className="space-y-3">{back}<h1 className="sr-only">{q.data.title}</h1><IdeaCard idea={q.data} signedIn={signedIn} heading="h2" /></div>;
}
