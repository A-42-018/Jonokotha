"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDay } from "@/lib/format";
import { fetchIntegrations, fetchReadiness, looksLikePublicKey, setGate, setIntegrationKey } from "@/lib/r2-api";
import type { AgencyIntegrationRow, CountryReadiness } from "@/lib/types";
import { Gate, useR2Fail } from "./bits";

/** Second-country readiness (F8.9): five reviews, each cleared only with a document reference and a named outside reviewer. Nothing here switches a country on. */
export function CountryReadinessPanel() {
  return <QueryProvider><Inner /></QueryProvider>;
}

function Inner() {
  const t = useT();
  const [code, setCode] = useState("");
  const [shown, setShown] = useState("");
  const ok = /^[A-Za-z]{2}$/.test(code.trim());
  return (
    <div className="space-y-4">
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (ok) setShown(code.trim().toUpperCase()); }} className="flex flex-wrap items-end gap-3">
        <div className="min-w-40"><Input label={t.r2CrCode} maxLength={2} value={code} onChange={(e) => setCode(e.target.value)} /></div>
        <Button type="submit" disabled={!ok}>{t.r2CrLoad}</Button>
      </form>
      {shown && <Readiness code={shown} />}
      <Card title={t.r2CrLocaleTitle} headingAs="h2">
        <ul className="list-disc space-y-1 ps-5">{[t.r2CrLocale1, t.r2CrLocale2, t.r2CrLocale3, t.r2CrLocale4].map((x) => <li key={x}>{x}</li>)}</ul>
      </Card>
    </div>
  );
}

function Readiness({ code }: { code: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["readiness", code], queryFn: () => fetchReadiness(code), retry: false });
  return (
    <Gate data={q.data}>
      {(r: CountryReadiness) => (
        <div className="space-y-3">
          <p role="status" className="font-medium">{r.home_country ? t.r2CrHome : r.ready ? t.r2CrReady : t.r2CrNotReady}</p>
          {!r.home_country && !r.adapter_configured && <p className="text-sm text-muted">{t.r2CrNoAdapter}</p>}
          {!r.home_country && <ul className="space-y-3">{r.gates.map((g) => <li key={g.gate}><Gaterow code={code} g={g} /></li>)}</ul>}
        </div>
      )}
    </Gate>
  );
}

function Gaterow({ code, g }: { code: string; g: CountryReadiness["gates"][number] }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [ev, setEv] = useState(g.evidence_ref ?? "");
  const [who, setWho] = useState(g.reviewer ?? "");
  const [bad, setBad] = useState(false);
  const m = useMutation({ mutationFn: (status: "open" | "cleared") => setGate(code, g.gate, status === "cleared" ? { status, evidence_ref: ev.trim(), reviewer: who.trim() } : { status, evidence_ref: ev.trim() || "reopened", reviewer: who.trim() || "reopened" }), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["readiness", code] }); }, onError: fail });
  const cleared = g.status === "cleared";
  const valid = ev.trim().length >= 5 && who.trim().length >= 3;
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={cleared ? "success" : "warning"} icon={cleared ? "✓" : "○"}>{cleared ? t.r2CrCleared : t.r2CrOpen}</Badge>
        <p className="font-medium">{t[`r2CrGate_${g.gate}`]}</p>
        {g.cleared_at && <span className="text-sm text-muted">{fmtDay(g.cleared_at, lang)}</span>}
      </div>
      <Input label={t.r2CrEvidence} maxLength={300} value={ev} onChange={(e) => { setEv(e.target.value); setBad(false); }} error={bad && ev.trim().length < 5 ? t.r2CrErr : undefined} />
      <Input label={t.r2CrReviewer} maxLength={150} value={who} onChange={(e) => { setWho(e.target.value); setBad(false); }} error={bad && who.trim().length < 3 ? t.r2CrErr : undefined} />
      {cleared
        ? <ConfirmAction label={t.r2CrReopen} variant="secondary" body={t.r2CrClearBody} loading={m.isPending} onConfirm={() => m.mutateAsync("open")} />
        : valid ? <ConfirmAction label={t.r2CrClear} body={t.r2CrClearBody} loading={m.isPending} onConfirm={() => m.mutateAsync("cleared")} /> : <Button onClick={() => setBad(true)}>{t.r2CrClear}</Button>}
    </div>
  );
}

/** Admin: the public key of each agency integration (F8.2). Only a public key is accepted here; anything that looks private is refused before it is sent. */
export function AgencyKeys() {
  return <QueryProvider><Keys /></QueryProvider>;
}

function Keys() {
  const t = useT();
  const q = useQuery({ queryKey: ["agency-integrations"], queryFn: fetchIntegrations, retry: false });
  return (
    <Gate data={q.data}>
      {() => (
        <Boundary q={q} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.r2AgNone}>
          {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((i) => <li key={i.id}><KeyRow i={i} /></li>)}</ul> : null}
        </Boundary>
      )}
    </Gate>
  );
}

function KeyRow({ i }: { i: AgencyIntegrationRow }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const [pem, setPem] = useState("");
  const [bad, setBad] = useState(false);
  const m = useMutation({ mutationFn: () => setIntegrationKey(i.id, pem.trim()), onSuccess: () => { toast("success", t.r2Done); setPem(""); void qc.invalidateQueries({ queryKey: ["agency-integrations"] }); }, onError: fail });
  return (
    <div className="space-y-2 rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={i.status === "confirmed" ? "success" : "neutral"}>{i.status}</Badge>
        <p className="font-medium">{i.agency}</p>
        <span className="text-sm text-muted">{i.has_key ? fillNum(t.r2AgHasKey, { fp: i.key_fingerprint?.slice(0, 12) ?? "" }, lang) : t.r2AgNoKey} · {fillNum(t.r2AgReceipts, { n: i.receipts }, lang)}</span>
      </div>
      <Textarea label={t.r2AgKey} rows={4} value={pem} onChange={(e) => { setPem(e.target.value); setBad(false); }} error={bad ? t.r2AgKeyBad : undefined} />
      <ConfirmAction label={t.r2AgKeySave} body={t.r2AgKeyBody} disabled={!pem.trim()} loading={m.isPending} onConfirm={() => { if (!looksLikePublicKey(pem)) { setBad(true); return; } return m.mutateAsync(); }} />
    </div>
  );
}
