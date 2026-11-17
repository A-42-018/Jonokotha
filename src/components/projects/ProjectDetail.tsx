"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLang } from "@/components/ui/useLang";
import { useShare } from "@/components/ui/useShare";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { fetchProject, milestoneSummary, type MilestoneStatus, type ProjectStatus } from "@/lib/projects-api";
import { safeHref } from "@/lib/safe";

const TONE: Record<ProjectStatus, BadgeTone> = { planned: "neutral", in_progress: "info", completed: "success", paused: "warning", cancelled: "danger" };
const MS_TONE: Record<MilestoneStatus, BadgeTone> = { pending: "neutral", done: "success", delayed: "warning" };
const MS_ICON: Record<MilestoneStatus, string> = { pending: "○", done: "✓", delayed: "⚠" };

export default function ProjectDetail(props: { refId: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["project", refId], queryFn: () => fetchProject(refId), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const { share } = useShare(t, `/projects/${refId}`, q.data?.title ?? "");
  const back = <Link href="/projects" className="inline-flex min-h-11 items-center text-civic underline">← {t.pdBack}</Link>;

  if (q.isPending) return <div role="status" aria-label={t.pdLoading} className="space-y-3">{back}<Skeleton className="h-10 w-2/3" /><Skeleton className="h-32 w-full" /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <div className="space-y-3">{back}<EmptyState variant="empty" title={t.pdNotFoundTitle} body={t.pdNotFoundBody} /></div>;
    return (
      <div role="alert" className="space-y-3">{back}
        <p>{q.error instanceof ApiError && q.error.isNetwork ? t.pdOffline : t.pdError}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>{t.pdRetry}</Button>
      </div>
    );
  }

  const p = q.data;
  const src = safeHref(p.source_url);
  const ms = milestoneSummary(p.milestones);
  return (
    <div className="space-y-4">
      {back}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TONE[p.status]}>{t[`pjSt_${p.status}`]}</Badge>
          <CapabilityLabel status={p.capability} />
        </div>
        <h1 className="break-words text-2xl font-semibold text-civic">{p.title}</h1>
        <p className="text-sm text-muted">{t.pdUpdated} {fmtDay(p.updated_at, lang)}</p>
      </header>

      <Card as="section" aria-labelledby="pd-about">
        <h2 id="pd-about" className="text-lg font-semibold">{t.pdAbout}</h2>
        <p className="mt-1 whitespace-pre-line break-words">{p.description || t.pdNoDescription}</p>
        <dl className="mt-2 space-y-0.5 text-sm">
          {p.start_date && <div><dt className="inline text-muted">{t.pdStart} </dt><dd className="inline">{fmtDay(p.start_date, lang)}</dd></div>}
          {p.expected_end_date && <div><dt className="inline text-muted">{t.pdEnd} </dt><dd className="inline">{fmtDay(p.expected_end_date, lang)}</dd></div>}
        </dl>
      </Card>

      <Card as="section" aria-labelledby="pd-budget">
        <h2 id="pd-budget" className="text-lg font-semibold">{t.pdBudgetTitle}</h2>
        {p.budget_text ? <p className="mt-1 break-words">{p.budget_text}</p> : <p className="mt-1 text-muted">{t.pdNoBudget}</p>}
        <p className="mt-1 text-sm text-muted">{t.pdBudgetNote}</p>
        <p className="mt-2 text-sm">
          {src ? <a href={src} target="_blank" rel="noopener noreferrer" className="text-civic underline">{t.pdSourceOpen}</a> : <span className="text-muted">{t.pdNoSource}</span>}
          {" · "}
          {p.source_checked_at ? <span>{t.pdChecked} {fmtDay(p.source_checked_at, lang)}</span> : <span className="text-muted">{t.pdUnchecked}</span>}
        </p>
      </Card>

      <section aria-labelledby="pd-ms" className="space-y-2">
        <h2 id="pd-ms" className="text-lg font-semibold">{t.pdMilestones}</h2>
        {ms.total === 0 ? <p className="text-muted">{t.pdMsEmpty}</p> : (
          <>
            <p aria-live="polite" className="text-sm">
              {fillNum(t.pdMsProgress, { done: ms.done, total: ms.total }, lang)}
              {ms.delayed > 0 && <span className="text-amber-900"> · {fillNum(t.pdMsDelayedCount, { n: ms.delayed }, lang)}</span>}
            </p>
            <ol className="space-y-2">
              {ms.sorted.map((m) => (
                <li key={m.id} className="rounded-xl border border-line bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={MS_TONE[m.status]} icon={MS_ICON[m.status]}>{t[`pdMs_${m.status}`]}</Badge>
                    <h3 className="break-words font-medium">{m.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {m.due_date && <span>{t.pdDue} {fmtDay(m.due_date, lang)}</span>}
                    {m.status === "done" && m.completed_at && <span>{m.due_date ? " · " : ""}{t.pdDoneOn} {fmtDay(m.completed_at, lang)}</span>}
                  </p>
                  {m.status === "delayed" && (
                    <p className="mt-1 rounded-lg bg-amber/10 p-2 text-sm"><span className="font-medium">{t.pdDelayReason} </span>{m.note || t.pdDelayNoNote}</p>
                  )}
                  {m.status !== "delayed" && m.note && <p className="mt-1 text-sm"><span className="font-medium">{t.pdNote} </span>{m.note}</p>}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {p.status === "completed" && (
        <>
          <PlannedPanel title={t.pdEvidenceTitle} body={t.pdEvidenceBody} />
          <PlannedPanel title={t.pdFeedbackTitle} body={t.pdFeedbackBody} />
        </>
      )}
      <PlannedPanel title={t.pdFollowTitle} body={t.pdFollowBody}>
        <Link href="/area" className={buttonClass({ variant: "secondary" })}>{t.navArea}</Link>
      </PlannedPanel>
      <div><Button variant="ghost" onClick={() => void share()}>{t.shareLink}</Button></div>
    </div>
  );
}
