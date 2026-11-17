"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import ReportContent from "@/components/ReportContent";
import Button from "@/components/ui/Button";
import { RadioGroup } from "@/components/ui/Choice";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { addPoint, fetchPoints, setHelpful, type IdeaPoint } from "@/lib/ideas-r11-api";
import { fillNum } from "@/lib/format";
import { writeProblem } from "@/lib/r11";
import { useLang } from "@/components/ui/useLang";

/** For / against points under one idea (F7.4). Two plain lists, a helpful mark, one short point per entry; no replies. Loaded only when opened. */
export default function IdeaPoints({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const panel = useId();
  return (
    <div>
      <Button variant="ghost" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>{open ? t.ixPointsHide : t.ixPointsShow}</Button>
      <div id={panel} hidden={!open} className="mt-2">{open && <Inner refId={refId} signedIn={signedIn} />}</div>
    </div>
  );
}

function Inner({ refId, signedIn }: { refId: string; signedIn: boolean }) {
  const t = useT();
  const q = useQuery({ queryKey: ["idea-points", refId], queryFn: () => fetchPoints(refId), retry: false });
  if (q.isPending) return <p role="status" className="text-muted">{t.r1Loading}</p>;
  if (q.isError) return <div role="alert" className="flex flex-wrap items-center gap-2 text-sm"><p>{q.error instanceof ApiError && q.error.isNetwork ? t.r1Offline : t.r1Error}</p><Button variant="secondary" onClick={() => void q.refetch()}>{t.r1Retry}</Button></div>;
  if (q.data.kind === "planned") return <p className="text-sm text-muted">{t.ixPlanned}</p>;
  const { for: pro, against } = q.data.data;
  return (
    <section aria-labelledby={`pts-${refId}`} className="space-y-3">
      <h3 id={`pts-${refId}`} className="text-base font-semibold">{t.ixPointsTitle}</h3>
      <p className="text-sm text-muted">{t.ixPointsLead}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Column title={t.ixFor} empty={t.ixNoFor} items={pro} refId={refId} signedIn={signedIn} tone="leaf" />
        <Column title={t.ixAgainst} empty={t.ixNoAgainst} items={against} refId={refId} signedIn={signedIn} tone="amber" />
      </div>
      {signedIn ? <AddPoint refId={refId} /> : <Link href={`/login?need=1&next=${encodeURIComponent("/ideas/" + refId)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.ixSignIn}</Link>}
    </section>
  );
}

function Column({ title, empty, items, refId, signedIn, tone }: { title: string; empty: string; items: IdeaPoint[]; refId: string; signedIn: boolean; tone: "leaf" | "amber" }) {
  return (
    <div className={`space-y-2 rounded-xl border p-3 ${tone === "leaf" ? "border-leaf/50 bg-leaf/5" : "border-amber/60 bg-amber/10"}`}>
      <h4 className="font-semibold"><span aria-hidden>{tone === "leaf" ? "＋ " : "－ "}</span>{title}</h4>
      {items.length === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="space-y-2">{items.map((p) => <li key={p.id}><Point p={p} refId={refId} signedIn={signedIn} /></li>)}</ul>}
    </div>
  );
}

function Point({ p, refId, signedIn }: { p: IdeaPoint; refId: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [on, setOn] = useState(false);   // the API does not say whether *I* marked a point, so this remembers it in the open view only
  const m = useMutation({
    mutationFn: (v: boolean) => setHelpful(refId, p.id, v),
    onSuccess: (_d, v) => { setOn(v); void qc.invalidateQueries({ queryKey: ["idea-points", refId] }); },
    onError: (e) => toast("error", writeProblem(e) === "own" || (e instanceof ApiError && e.status === 403) ? t.ixHelpfulOwn : writeProblem(e) === "auth" ? t.r1AuthMsg : t.r1FailMsg),
  });
  return (
    <div className="space-y-1 rounded-lg bg-white p-2">
      <p className="break-words">{p.body}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{fillNum(t.ixHelpfulCount, { n: p.helpful_count }, lang)}</span>
        {signedIn && <Button variant={on ? "success" : "secondary"} aria-pressed={on} loading={m.isPending} onClick={() => m.mutate(!on)}>{on ? t.ixHelpfulOn : t.ixHelpful}</Button>}
        <ReportContent type="idea_argument" refId={p.id} signedIn={signedIn} next={`/ideas/${refId}`} />
      </div>
    </div>
  );
}

function AddPoint({ refId }: { refId: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const group = useId();
  const [side, setSide] = useState<"for" | "against">("for");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const key = useRef(crypto.randomUUID());
  const send = useMutation({
    mutationFn: () => addPoint(refId, side, text, key.current),
    onSuccess: () => { setText(""); setErr(""); key.current = crypto.randomUUID(); toast("success", t.ixSent); void qc.invalidateQueries({ queryKey: ["idea-points", refId] }); },
    onError: (e) => { key.current = crypto.randomUUID(); const p = writeProblem(e); setErr(p === "limit" ? t.ixLimit : p === "auth" ? t.r1AuthMsg : t.r1FailMsg); },
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (text.trim().length < 5) { setErr(t.ixBodyShort); return; } setErr(""); send.mutate(); }} className="space-y-2 rounded-xl border border-line bg-white p-3">
      <h4 className="font-semibold">{t.ixAddTitle}</h4>
      <RadioGroup legend={t.ixSide} name={group} value={side} onChange={(v) => setSide(v as "for" | "against")} options={[{ value: "for", label: t.ixFor }, { value: "against", label: t.ixAgainst }]} />
      <Textarea label={t.ixBody} hint={t.ixBodyHint} rows={3} maxLength={280} value={text} error={err || undefined} onChange={(e) => setText(e.target.value)} />
      <Button type="submit" loading={send.isPending}>{t.ixSend}</Button>
    </form>
  );
}
