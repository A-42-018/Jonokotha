"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import CapabilityLabel from "@/components/ui/CapabilityLabel";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import PlannedPanel from "@/components/ui/PlannedPanel";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDay } from "@/lib/format";
import { addRank, barWidth, fetchRound, fetchRoundResults, fetchRounds, MAX_RANKED, moveRank, removeRank, submitRanking, type Round, type RoundFull } from "@/lib/priorities-api";
import { writeProblem } from "@/lib/r11";

/** Community priority ranking for citizens (F7.8, B7.8). Always labelled non-binding. One ranking per verified local account, replaceable until the round closes. */
export default function PrioritiesPanel(props: { constituency: string; signedIn: boolean; loginHref: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency, signedIn, loginHref }: { constituency: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["rounds", constituency], queryFn: () => fetchRounds(constituency), retry: false });
  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm" role="note">{t.prxNonBinding}</p>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "planned" ? <PlannedPanel title={t.prxPlannedTitle} body={t.r1PlannedBody} /> : q.data && q.data.data.length === 0 ? <EmptyState title={t.prxEmpty} body={t.prxEmptyBody} /> : q.data && (
          <ul className="space-y-3">{q.data.data.map((r) => <li key={r.ref}><RoundCard row={r} signedIn={signedIn} loginHref={loginHref} /></li>)}</ul>
        )}
      </AsyncBlock>
    </div>
  );
}

function RoundCard({ row, signedIn, loginHref }: { row: Round; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const lang = useLang();
  const open = row.status === "open";
  const d = useQuery({ queryKey: ["round", row.ref], queryFn: () => fetchRound(row.ref) });
  return (
    <Card as="section" title={row.title}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={open ? "success" : "neutral"} icon={open ? "●" : "○"}>{open ? t.prxOpen : t.prxClosed}</Badge>
        <Badge tone="warning" icon="≈">{t.prxLabel}</Badge>
        {row.is_sample && <CapabilityLabel status="sample" />}
        {row.closes_at && open && <span className="text-sm text-muted">{fillNum(t.r1Closes, { date: fmtDay(row.closes_at, lang) }, lang)}</span>}
      </div>
      {row.description && <p className="mb-2 break-words">{row.description}</p>}
      <AsyncBlock pending={d.isPending} error={d.error} onRetry={() => void d.refetch()}>
        {d.data && (open ? (signedIn ? <Ranker round={d.data} /> : <div className="space-y-2"><p>{t.prxSignIn}</p><Link href={loginHref} className={buttonClass()}>{t.signIn}</Link></div>) : <Results refId={row.ref} />)}
      </AsyncBlock>
    </Card>
  );
}

function Ranker({ round }: { round: RoundFull }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [rank, setRank] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const key = useRef(crypto.randomUUID());
  const label = (id: string) => round.items.find((i) => i.id === id)?.label ?? id;
  const send = useMutation({
    mutationFn: () => submitRanking(round.ref, rank),
    onSuccess: () => { setSent(true); setMsg(""); toast("success", t.prxSent); },
    onError: (e) => {
      key.current = crypto.randomUUID();
      const p = writeProblem(e);
      setMsg(p === "closed" ? t.prxClosedNow : p === "auth" ? t.r1AuthMsg : e instanceof ApiError && e.status === 403 ? t.prxFollowArea : t.prxFail);
    },
  });
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">{t.prxPick}</h3>
        <p className="text-sm text-muted">{t.prxPickHint}</p>
        {rank.length === 0 ? <p className="mt-2 text-muted">{t.prxNone}</p> : (
          <ol className="mt-2 space-y-2">
            {rank.map((id, i) => (
              <li key={id} className="flex flex-wrap items-center gap-2 rounded-xl border border-civic/40 bg-civic/5 p-2">
                <span className="font-semibold">{fillNum(t.prxRank, { n: i + 1 }, lang)}</span>
                <span className="min-w-0 flex-1 break-words">{label(id)}</span>
                <Button variant="ghost" aria-label={`${t.prxUp}: ${label(id)}`} disabled={i === 0} onClick={() => setRank(moveRank(rank, id, -1))}>↑ {t.prxUp}</Button>
                <Button variant="ghost" aria-label={`${t.prxDown}: ${label(id)}`} disabled={i === rank.length - 1} onClick={() => setRank(moveRank(rank, id, 1))}>↓ {t.prxDown}</Button>
                <Button variant="ghost" aria-label={`${t.prxRemove}: ${label(id)}`} onClick={() => setRank(removeRank(rank, id))}>{t.prxRemove}</Button>
              </li>
            ))}
          </ol>
        )}
        {rank.length >= MAX_RANKED && <p className="mt-1 text-sm text-muted">{t.prxFull}</p>}
      </div>
      <div>
        <h3 className="font-medium">{t.prxAvailable}</h3>
        <ul className="mt-2 space-y-2">
          {round.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2">
              <span className="min-w-0 flex-1 break-words">{i.label}</span>
              {rank.includes(i.id) ? <span className="text-sm text-muted">{t.prxAdded}</span> : <Button variant="secondary" aria-label={`${t.prxAdd}: ${i.label}`} disabled={rank.length >= MAX_RANKED} onClick={() => setRank(addRank(rank, i.id))}>{t.prxAdd}</Button>}
            </li>
          ))}
        </ul>
      </div>
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      {sent && <p role="status" className="text-sm">{t.prxSent}</p>}
      <Button loading={send.isPending} onClick={() => { if (rank.length === 0) { setMsg(t.prxNeedOne); return; } setMsg(""); send.mutate(); }}>{sent ? t.prxSendAgain : t.prxSend}</Button>
    </div>
  );
}

function Results({ refId }: { refId: string }) {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["round-results", refId], queryFn: () => fetchRoundResults(refId), retry: false });
  const r = q.data;
  return (
    <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
      {r && (r.results_shown && r.items ? (
        <div className="space-y-2" aria-label={t.prxResults}>
          <p className="text-sm">{fillNum(t.prxParticipants, { n: r.participants ?? 0 }, lang)}</p>
          <ol className="space-y-2">
            {r.items.map((x, i) => (
              <li key={x.id}>
                <p className="flex flex-wrap justify-between gap-2"><span>{fillNum(t.prxRank, { n: i + 1 }, lang)}: {x.label}</span><span className="text-sm">{fillNum(t.prxPoints, { n: x.points }, lang)} · {fillNum(t.prxFirst, { n: x.first_choice }, lang)}</span></p>
                <div aria-hidden className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal" style={{ width: `${barWidth(x.points, r.items![0]?.points ?? 0)}%` }} /></div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">{t.prxHow}</p>
        </div>
      ) : <p className="text-muted">{t.prxHidden}</p>)}
    </AsyncBlock>
  );
}
