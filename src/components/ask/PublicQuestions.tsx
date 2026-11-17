"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import ReportContent from "@/components/ReportContent";
import Badge from "@/components/ui/Badge";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fetchPublicQuestions } from "@/lib/ask-api";
import { fmtDate } from "@/lib/format";

/** Questions other people asked in public (a moderator approved them), each with "report". */
export default function PublicQuestions(props: { constituency: string; signedIn: boolean }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency, signedIn }: { constituency: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const q = useInfiniteQuery({
    queryKey: ["public-questions", constituency],
    queryFn: ({ pageParam }) => fetchPublicQuestions(constituency, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (l) => l.next ?? undefined,
  });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section aria-labelledby="pq" className="space-y-2">
      <h2 id="pq" className="jk-h2">{t.pqTitle}</h2>
      <p className="text-sm text-muted">{t.pqLead}</p>
      {q.isPending && <p role="status" className="text-sm text-muted">{t.pqLoading}</p>}
      {q.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.pqLoadError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button></div>}
      {q.isSuccess && rows.length === 0 && <EmptyState variant="empty" title={t.pqEmptyTitle} body={t.pqEmptyBody} />}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.ref}>
            <Card as="article" className="space-y-2">
              <h3 className="font-semibold">{r.title}</h3>
              <p className="text-sm text-muted">{fmtDate(r.created_at, lang)}</p>
              <p className="whitespace-pre-line break-words">{r.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.status === "answered" ? "success" : "neutral"}>{r.status === "answered" ? t.pqAnswered : t.pqWaiting}</Badge>
                {r.is_sample && <CapabilityLabel status="sample" />}
                <ReportContent type="question" refId={r.ref} signedIn={signedIn} next="/ask" />
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {q.hasNextPage && <Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t.pqMore}</Button>}
    </section>
  );
}
