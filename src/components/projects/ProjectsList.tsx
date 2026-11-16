"use client";
import { useQuery } from "@tanstack/react-query";
import QueryProvider from "@/components/QueryProvider";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtDay } from "@/lib/format";
import { fetchProjects, type ProjectStatus } from "@/lib/projects-api";
import { safeHref } from "@/lib/safe";

const TONE: Record<ProjectStatus, BadgeTone> = { planned: "neutral", in_progress: "info", completed: "success", paused: "warning", cancelled: "danger" };

export default function ProjectsList(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["projects", constituency], queryFn: () => fetchProjects(constituency) });
  if (q.isPending) return <div role="status" aria-label={t.pjLoading} className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>;
  if (q.isError) return <div role="alert" className="space-y-2"><p>{t.pjError}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.pjRetry}</Button></div>;
  if (q.data.length === 0) return <EmptyState variant="empty" title={t.pjEmptyTitle} body={t.pjEmptyBody} />;
  return (
    <ul className="space-y-3">
      {q.data.map((p) => {
        const src = safeHref(p.source_url);
        return (
          <li key={p.ref}>
            <Card as="div">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={TONE[p.status]}>{t[`pjSt_${p.status}`]}</Badge>
                <CapabilityLabel status={p.capability} />
              </div>
              <h2 className="mt-1 break-words text-lg font-semibold text-civic">{p.title}</h2>
              <dl className="mt-1 space-y-0.5 text-sm">
                {p.budget_text && <div><dt className="inline text-muted">{t.pjBudget} </dt><dd className="inline break-words">{p.budget_text}</dd></div>}
                {p.expected_end_date && <div><dt className="inline text-muted">{t.pjEnd} </dt><dd className="inline">{fmtDay(p.expected_end_date, lang)}</dd></div>}
                <div><dt className="inline text-muted">{t.pjUpdated} </dt><dd className="inline">{fmtDay(p.updated_at, lang)}</dd></div>
                {src && <div><a href={src} target="_blank" rel="noopener noreferrer" className="text-civic underline">{t.pjSource}</a>{p.source_checked_at && <span className="text-muted"> · {t.pjChecked} {fmtDay(p.source_checked_at, lang)}</span>}</div>}
              </dl>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
