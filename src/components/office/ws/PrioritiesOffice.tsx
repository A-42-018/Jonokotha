"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { lines } from "@/lib/consult-api";
import { fillNum, fmtDay } from "@/lib/format";
import { createRound, fetchOfficeRounds, fetchRoundResults, setRoundStatus, type OfficeRound } from "@/lib/priorities-api";
import Boundary from "./Boundary";

/** Office: create, open and close community priority rounds (F7.8). Results are opinion only. */
export default function PrioritiesOffice(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

const TONE = { draft: "neutral", open: "success", closed: "neutral", cancelled: "danger" } as const;

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["office-rounds"], queryFn: fetchOfficeRounds, retry: false });
  if (q.data?.kind === "planned") return <PlannedPanel title={t.prxPlannedTitle} body={t.r1PlannedBody} />;
  return (
    <div className="space-y-4">
      <NewRound constituency={constituency} />
      <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.prxoEmpty}>
        {(d) => d.kind === "ok" ? <ul className="space-y-2">{d.data.map((r) => <li key={r.ref}><Row r={r} /></li>)}</ul> : null}
      </Boundary>
    </div>
  );
}

function NewRound({ constituency }: { constituency: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ title: "", desc: "", items: "", day: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [key, setKey] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () => createRound({ constituency, title: f.title.trim(), ...(f.desc.trim() ? { description: f.desc.trim() } : {}), items: lines(f.items, 12), ...(f.day ? { closes_at: `${f.day}T23:59:00+06:00` } : {}) }, key),
    onSuccess: () => { toast("success", t.prxoCreated); setF({ title: "", desc: "", items: "", day: "" }); setKey(crypto.randomUUID()); void qc.invalidateQueries({ queryKey: ["office-rounds"] }); },
    onError: (e) => { setKey(crypto.randomUUID()); toast("error", e instanceof ApiError && e.status === 403 ? t.prxoNoAccess : t.r1FailMsg); },
  });
  function submit() {
    const x: Record<string, string> = {};
    const n = f.title.trim().length, items = lines(f.items, 13);
    if (n < 5 || n > 150) x.title = t.prxoNameBad;
    if (items.length < 3 || items.length > 12 || items.some((i) => i.length < 3 || i.length > 100)) x.items = t.prxoItemsBad;
    if (f.day && Date.parse(f.day) <= Date.now()) x.day = t.prxoDateBad;
    setErr(x);
    if (!Object.keys(x).length) m.mutate();
  }
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 className="text-lg font-semibold">{t.prxoNew}</h2>
      <Input label={t.prxoName} maxLength={150} value={f.title} error={err.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} />
      <Textarea label={t.prxoDesc} optional rows={2} maxLength={600} value={f.desc} onChange={(e) => setF((s) => ({ ...s, desc: e.target.value }))} />
      <Textarea label={t.prxoItems} rows={5} value={f.items} error={err.items} onChange={(e) => setF((s) => ({ ...s, items: e.target.value }))} />
      <Input type="date" label={t.prxoCloses} optional value={f.day} error={err.day} onChange={(e) => setF((s) => ({ ...s, day: e.target.value }))} />
      <Button type="submit" loading={m.isPending}>{t.prxoCreate}</Button>
    </form>
  );
}

function Row({ r }: { r: OfficeRound }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const act = useMutation({
    mutationFn: (s: "open" | "closed" | "cancelled") => setRoundStatus(r.ref, s),
    onSuccess: () => { toast("success", t.prxoDone); void qc.invalidateQueries({ queryKey: ["office-rounds"] }); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 403 ? t.prxoNoAccess : t.r1FailMsg),
  });
  const res = useQuery({ queryKey: ["office-round-results", r.ref], queryFn: () => fetchRoundResults(r.ref), enabled: show, retry: false });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TONE[r.status]}>{t[`prxoSt_${r.status}` as "prxoSt_open"]}</Badge>
        <p className="min-w-0 flex-1 break-words font-medium">{r.title}</p>
        {r.closes_at && <span className="text-sm text-muted">{fillNum(t.r1Closes, { date: fmtDay(r.closes_at, lang) }, lang)}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {r.status === "draft" && <ConfirmAction label={t.prxoOpen} body={t.prxoOpenConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("open")} />}
        {r.status === "open" && <ConfirmAction variant="secondary" label={t.prxoClose} body={t.prxoCloseConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("closed")} />}
        {(r.status === "draft" || r.status === "open") && <ConfirmAction variant="danger" label={t.prxoCancel} body={t.prxoCancelConfirm} loading={act.isPending} onConfirm={() => act.mutateAsync("cancelled")} />}
        {(r.status === "open" || r.status === "closed") && <Button variant="ghost" aria-expanded={show} onClick={() => setShow((x) => !x)}>{t.prxoResults}</Button>}
      </div>
      {show && res.data?.items && (
        <ol className="text-sm" role="status">{res.data.items.map((x) => <li key={x.id}>{x.label}: {fillNum(t.prxPoints, { n: x.points }, lang)} · {fillNum(t.prxFirst, { n: x.first_choice }, lang)}</li>)}</ol>
      )}
    </div>
  );
}
