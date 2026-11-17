"use client";
import { useQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import ReportContent from "@/components/ReportContent";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum } from "@/lib/format";
import { fetchIssuePhotos } from "@/lib/report-api";

/** Photos the office has approved for public display: the evidence of the work. Each one can be reported to a moderator. */
export default function ProgressEvidence(props: { refId: string; signedIn: boolean }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["issue-photos", refId], queryFn: () => fetchIssuePhotos(refId), staleTime: 60_000 });
  const photos = (q.data ?? []).filter((p) => p.url);
  return (
    <Card title={t.rxEvTitle}>
      {q.isPending ? (
        <div role="status" aria-label={t.rxEvLoading}><Skeleton className="h-24 w-full" /></div>
      ) : q.isError ? (
        <div role="alert" className="space-y-2">
          <p>{t.rxEvError}</p>
          <Button variant="secondary" onClick={() => void q.refetch()}>{t.rxEvRetry}</Button>
        </div>
      ) : photos.length === 0 ? (
        <p className="text-muted">{t.rxEvEmpty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <li key={p.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url ?? ""} alt={p.caption || fillNum(t.rxEvAlt, { n: i + 1 }, lang)} loading="lazy" className="h-40 w-full rounded-lg object-cover" />
              {p.caption && <p className="break-words text-sm">{p.caption}</p>}
              <ReportContent type="media" refId={p.id} signedIn={signedIn} next={`/issue/${refId}`} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">{t.rxEvNote}</p>
    </Card>
  );
}
