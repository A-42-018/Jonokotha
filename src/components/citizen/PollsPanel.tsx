"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay } from "@/lib/format";
import { fetchPoll, fetchPolls, percent, voteProblem, votePoll, whyHidden, type PollDetail, type PollRow, type VoteProblem } from "@/lib/polls-api";

/** Polls for citizens (F5.11, F7.6) on the shipped B5.5 contract. One vote per verified account; results only when the server allows them. */
export default function PollsPanel({ signedIn, loginHref, constituency }: { signedIn: boolean; loginHref: string; constituency: string }) {
  return <QueryProvider><Inner signedIn={signedIn} loginHref={loginHref} constituency={constituency} /></QueryProvider>;
}

function Inner({ signedIn, loginHref, constituency }: { signedIn: boolean; loginHref: string; constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["polls", constituency], queryFn: () => fetchPolls(constituency) });
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()} errorText={t.pvLoadError}>
      {q.data?.kind === "planned" ? <PlannedPanel title={t.plPlannedTitle} body={t.plPlannedBody} /> : q.data && q.data.data.length === 0 ? <EmptyState title={t.pvEmptyTitle} body={t.pvEmptyBody} /> : q.data && (
        <ul className="space-y-3">{q.data.data.map((p) => <li key={p.ref}><PollCard row={p} signedIn={signedIn} loginHref={loginHref} /></li>)}</ul>
      )}
    </AsyncBlock>
  );
}

function PollCard({ row, signedIn, loginHref }: { row: PollRow; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["poll", row.ref], queryFn: () => fetchPoll(row.ref) });
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<VoteProblem | null>(null);
  const key = useRef(crypto.randomUUID());   // one key per attempt, so a retry cannot count twice
  const vote = useMutation({
    mutationFn: () => votePoll(row.ref, pick, key.current),
    onSuccess: () => { setErr(null); void qc.invalidateQueries({ queryKey: ["poll", row.ref] }); },
    onError: (e) => { key.current = crypto.randomUUID(); const p = voteProblem(e); setErr(p); if (p === "again" || p === "closed") void qc.invalidateQueries({ queryKey: ["poll", row.ref] }); },
  });
  const open = row.status === "open";
  return (
    <Card as="section" title={row.question}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={open ? "success" : "neutral"} icon={open ? "●" : "○"}>{open ? t.pvOpen : t.pvClosed}</Badge>
        {row.is_sample && <CapabilityLabel status="sample" />}
        {row.closes_at && open && <span className="text-sm text-muted">{fillNum(t.pvCloses, { date: fmtDay(row.closes_at, lang) }, lang)}</span>}
      </div>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()} errorText={t.pvLoadError}>
        {q.data && <Body d={q.data} open={open} signedIn={signedIn} loginHref={loginHref} pick={pick} setPick={setPick} vote={() => vote.mutate()} voting={vote.isPending} />}
      </AsyncBlock>
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err === "auth" ? t.pvErrAuth : err === "again" ? t.pvErrAgain : err === "closed" ? t.pvErrClosed : t.pvErrFail}</p>}
    </Card>
  );
}

function Body({ d, open, signedIn, loginHref, pick, setPick, vote, voting }: { d: PollDetail; open: boolean; signedIn: boolean; loginHref: string; pick: string; setPick: (v: string) => void; vote: () => void; voting: boolean }) {
  const t = useT();
  const lang = useLang();
  const r = d.results;
  const mine = d.options.find((o) => o.id === r.my_option_id);
  if (r.results_shown && r.options) {
    const total = r.options.reduce((n, o) => n + o.votes, 0);
    return (
      <ul className="space-y-2" aria-label={t.pvResults}>
        {r.options.map((o) => {
          const pc = percent(o.votes, total);
          return (
            <li key={o.id}>
              <p className="flex flex-wrap justify-between gap-2">
                <span>{o.label}{mine?.id === o.id && <span className="ms-2 text-sm font-medium text-civic">{t.pvYours}</span>}</span>
                <span className="text-sm">{fillNum(t.pvShare, { votes: o.votes, pc }, lang)}</span>
              </p>
              <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-civic" style={{ width: `${pc}%` }} /></div>
            </li>
          );
        })}
        <li className="text-sm text-muted">{fillNum(t.pvTotal, { n: total }, lang)}</li>
      </ul>
    );
  }
  if (mine) return <p role="status">{t.pvVoted} <strong>{mine.label}</strong>{" "}{open ? (whyHidden(r, d.results_visibility) === "few_votes" ? t.svFewVotes : t.pvResultsLater) : t.svFewVotes}</p>;
  if (!open) return <p role="status">{t.pvClosedNoVote}{" "}{whyHidden(r, d.results_visibility) === "few_votes" ? t.svFewVotes : ""}</p>;
  if (!signedIn) return <div className="space-y-2"><p>{t.pvSignIn}</p><Link href={loginHref} className={buttonClass()}>{t.signIn}</Link></div>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (pick) vote(); }} className="space-y-3">
      <RadioGroup legend={t.pvPick} name={`poll-${d.ref}`} value={pick} onChange={setPick} options={d.options.map((o) => ({ value: o.id, label: o.label }))} />
      <Button type="submit" disabled={!pick} loading={voting}>{t.pvVote}</Button>
    </form>
  );
}
