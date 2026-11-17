"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { fetchPolls, percent, votePoll, type Poll } from "@/lib/polls-api";

/** Polls and surveys for citizens (F5.11). One vote per person; results only when the office allows them. */
export default function PollsPanel({ signedIn, loginHref }: { signedIn: boolean; loginHref: string }) {
  return <QueryProvider><Inner signedIn={signedIn} loginHref={loginHref} /></QueryProvider>;
}

function Inner({ signedIn, loginHref }: { signedIn: boolean; loginHref: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["polls"], queryFn: fetchPolls });
  if (q.isPending) return <p role="status" className="text-muted">{t.pvLoading}</p>;
  if (q.isError) {
    const offline = q.error instanceof ApiError && q.error.isNetwork;
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
        <p>{offline ? t.pvOffline : t.pvLoadError}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button>
      </div>
    );
  }
  if (q.data.kind === "planned") return <PlannedPanel title={t.plPlannedTitle} body={t.plPlannedBody} />;
  if (q.data.polls.length === 0) return <EmptyState title={t.pvEmptyTitle} body={t.pvEmptyBody} />;
  return <ul className="space-y-3">{q.data.polls.map((p) => <li key={p.id}><PollCard poll={p} signedIn={signedIn} loginHref={loginHref} /></li>)}</ul>;
}

type VoteError = "auth" | "again" | "closed" | "fail";

function PollCard({ poll, signedIn, loginHref }: { poll: Poll; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const qc = useQueryClient();
  const [pick, setPick] = useState("");
  const [err, setErr] = useState<VoteError | null>(null);
  const key = useRef(crypto.randomUUID()); // one key per attempt, so a retry cannot count twice
  const text = (bn: string, en: string | null) => (lang === "en" && en ? en : bn);
  const vote = useMutation({
    mutationFn: () => votePoll(poll.id, pick, key.current),
    onSuccess: () => { setErr(null); void qc.invalidateQueries({ queryKey: ["polls"] }); },
    onError: (e) => {
      key.current = crypto.randomUUID();
      const s = e instanceof ApiError ? e.status : 0;
      setErr(s === 401 ? "auth" : s === 409 ? "again" : s === 403 || s === 410 ? "closed" : "fail");
      if (s === 409 || s === 410) void qc.invalidateQueries({ queryKey: ["polls"] });
    },
  });
  const open = poll.status === "open";
  const mine = poll.options.find((o) => o.id === poll.my_vote);
  const total = poll.options.reduce((n, o) => n + (o.votes ?? 0), 0);
  const group = `poll-${poll.id}`;
  return (
    <Card as="section" title={text(poll.question, poll.question_en)}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={open ? "success" : "neutral"} icon={open ? "●" : "○"}>{open ? t.pvOpen : t.pvClosed}</Badge>
        {poll.is_sample && <Badge tone="warning" icon="◐">{t.capSample}</Badge>}
        {poll.closes_at && open && <span className="text-sm text-muted">{fillNum(t.pvCloses, { date: fmtDay(poll.closes_at, lang) }, lang)}</span>}
      </div>
      {poll.results_visible ? (
        <ul className="space-y-2" aria-label={t.pvResults}>
          {poll.options.map((o) => {
            const pc = percent(o.votes ?? 0, total);
            return (
              <li key={o.id}>
                <p className="flex flex-wrap justify-between gap-2">
                  <span>{text(o.label, o.label_en)}{mine?.id === o.id && <span className="ms-2 text-sm font-medium text-civic">{t.pvYours}</span>}</span>
                  <span className="text-sm">{fillNum(t.pvShare, { votes: o.votes ?? 0, pc }, lang)}</span>
                </p>
                <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-civic" style={{ width: `${pc}%` }} /></div>
              </li>
            );
          })}
          <li className="text-sm text-muted">{fillNum(t.pvTotal, { n: total }, lang)}</li>
        </ul>
      ) : open && !mine ? (
        signedIn ? (
          <form onSubmit={(e) => { e.preventDefault(); if (pick) vote.mutate(); }} className="space-y-3">
            <RadioGroup legend={t.pvPick} name={group} value={pick} onChange={setPick} options={poll.options.map((o) => ({ value: o.id, label: text(o.label, o.label_en) }))} />
            <Button type="submit" disabled={!pick} loading={vote.isPending}>{t.pvVote}</Button>
          </form>
        ) : (
          <div className="space-y-2"><p>{t.pvSignIn}</p><Link href={loginHref} className={buttonClass()}>{t.signIn}</Link></div>
        )
      ) : (
        <p role="status">
          {mine ? <>{t.pvVoted} <strong>{text(mine.label, mine.label_en)}</strong>{open ? ` ${t.pvResultsLater}` : ""}</> : t.pvClosedNoVote}
        </p>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err === "auth" ? t.pvErrAuth : err === "again" ? t.pvErrAgain : err === "closed" ? t.pvErrClosed : t.pvErrFail}</p>}
    </Card>
  );
}
