"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import AsyncBlock from "@/components/ui/AsyncBlock";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Choice";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { CATEGORIES } from "@/lib/categories";
import { fillNum, fmtDay } from "@/lib/format";
import { dict } from "@/lib/i18n";
import { applyVolunteer, assistedProblem, noteTooShort, createKiosk, decideVolunteer, fetchKiosks, fetchMyAssisted, fetchMyVolunteer, fetchOfficeVolunteers, fetchVolunteerRules, retireKiosk, submitAssisted, withdrawVolunteer } from "@/lib/r2-api";
import type { AssistedReportResult, ConsentMethod } from "@/lib/types";
import { Gate, useR2Fail } from "./bits";

/** Assisted reporting for volunteers and kiosks (F8.3). The person's identity is never typed or stored; the report carries the three agreements and the method. */
export function VolunteerHub({ constituency, signedIn }: { constituency: string; signedIn: boolean }) {
  return <QueryProvider><Hub constituency={constituency} signedIn={signedIn} /></QueryProvider>;
}

function Hub({ constituency, signedIn }: { constituency: string; signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const rules = useQuery({ queryKey: ["vol-rules"], queryFn: fetchVolunteerRules, retry: false });
  const mine = useQuery({ queryKey: ["vol-me"], queryFn: fetchMyVolunteer, retry: false, enabled: signedIn });
  const [accept, setAccept] = useState(false);
  const apply = useMutation({ mutationFn: (v: string) => applyVolunteer(constituency, v), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["vol-me"] }); }, onError: fail });
  const leave = useMutation({ mutationFn: (id: string) => withdrawVolunteer(id), onSuccess: () => { toast("success", t.r2Done); void qc.invalidateQueries({ queryKey: ["vol-me"] }); }, onError: fail });
  const records = mine.data?.kind === "ok" ? mine.data.data : [];
  const active = records.some((r) => r.status === "active" && r.constituency === constituency);
  const open = records.some((r) => (r.status === "pending" || r.status === "active") && r.constituency === constituency);
  return (
    <AsyncBlock pending={rules.isPending} error={rules.error} onRetry={() => void rules.refetch()}>
      <Gate data={rules.data}>
        {(r) => (
          <div className="space-y-4">
            {!r.reviewed && <p role="note" className="rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">{t.r2AsDraft}</p>}
            <Card title={t.r2AsConduct} headingAs="h2"><ul className="list-disc space-y-1 ps-5">{r.conduct[lang].map((x) => <li key={x}>{x}</li>)}</ul></Card>
            {!signedIn ? <p>{t.r2AsNeedLogin} <a href="/login?next=/volunteer" className="text-civic underline">{t.r2SignIn}</a></p> : (
              <>
                {records.length > 0 && (
                  <section aria-labelledby="vol-mine" className="space-y-2">
                    <h2 id="vol-mine" className="jk-h2">{t.r2AsMine}</h2>
                    <ul className="space-y-2">{records.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3">
                        <Badge tone={v.status === "active" ? "success" : v.status === "pending" ? "warning" : "neutral"}>{t[`r2AsSt_${v.status}`]}</Badge>
                        <span className="flex-1 text-sm">{v.constituency} · {fmtDay(v.created_at, lang)}</span>
                        {(v.status === "pending" || v.status === "active") && <ConfirmAction label={t.r2AsWithdraw} variant="secondary" body={t.r2AsWithdrawBody} loading={leave.isPending} onConfirm={() => leave.mutateAsync(v.id)} />}
                      </li>
                    ))}</ul>
                  </section>
                )}
                {!open && (
                  <form noValidate onSubmit={(e) => { e.preventDefault(); if (accept) apply.mutate(r.conduct_version); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
                    <h2 className="jk-h2">{t.r2AsApply}</h2>
                    <p className="text-sm text-muted">{t.r2AsApplyNote}</p>
                    <Checkbox label={t.r2AsAccept} checked={accept} onChange={(e) => setAccept(e.target.checked)} />
                    <Button type="submit" disabled={!accept} loading={apply.isPending}>{t.r2AsApply}</Button>
                  </form>
                )}
                {active ? <AssistedForm constituency={constituency} consentText={r.consent[lang]} consentVersion={r.consent_version} /> : open && <p className="text-muted">{t.r2AsNotActive}</p>}
                {active && <MyAssisted />}
              </>
            )}
          </div>
        )}
      </Gate>
    </AsyncBlock>
  );
}

const KIOSK_IDLE_MS = 90_000;

function AssistedForm({ constituency, consentText, consentVersion }: { constituency: string; consentText: string; consentVersion: string }) {
  const t = useT();
  const lang = useLang();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const kiosks = useQuery({ queryKey: ["kiosks", constituency], queryFn: () => fetchKiosks(constituency), retry: false });
  const [kioskMode, setKioskMode] = useState(false);
  const empty = { title: "", category: "", description: "", area: "", kiosk: "", method: "read_aloud_agreed" as ConsentMethod };
  const [f, setF] = useState(empty);
  const [c, setC] = useState({ file: false, publish: false, noAccount: false });
  const [err, setErr] = useState<ReturnType<typeof assistedProblem>>(null);
  const [sent, setSent] = useState<AssistedReportResult | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const reset = () => { setF(empty); setC({ file: false, publish: false, noAccount: false }); setErr(null); setKey(crypto.randomUUID()); };
  const m = useMutation({
    mutationFn: () => submitAssisted({ constituency, ...(f.kiosk ? { kiosk_id: f.kiosk } : {}), consent: { method: f.method, version: consentVersion, agreed_to_file: true, agreed_to_publish: true, understands_no_account: true, language: lang }, title: f.title.trim(), category: f.category, description: f.description.trim(), ...(f.area.trim() ? { area: f.area.trim() } : {}) }, key),
    onSuccess: (r) => { setSent(r); void qc.invalidateQueries({ queryKey: ["vol-reports"] }); if (kioskMode) reset(); },
    onError: (e) => { setKey(crypto.randomUUID()); fail(e); },
  });
  const big = kioskMode ? "text-lg" : "";
  if (sent) {
    return (
      <section role="status" className={`space-y-3 rounded-2xl border border-leaf/50 bg-leaf/10 p-4 ${big}`}>
        <h2 className="jk-h2">{t.r2AsSentTitle}</h2>
        <p>{t.r2AsSentRef} <strong className="text-2xl tracking-wide">{sent.ref}</strong></p>
        <p className="text-sm">{t.r2AsSentNote}</p>
        {sent.emergency && <p role="alert" className="font-semibold text-danger">{t.r2AsEmergency}</p>}
        {kioskMode && <p className="text-sm">{t.r2AsKioskClear}</p>}
        <Button onClick={() => { setSent(null); reset(); }}>{t.r2AsAnother}</Button>
      </section>
    );
  }
  const consentErr = err === "consent" ? t.r2AsErr_consent : undefined;
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const p = assistedProblem(f, c); setErr(p); if (!p) m.mutate(); }} className={`space-y-3 rounded-2xl border border-line bg-white p-4 ${big}`}>
      <h2 className="jk-h2">{t.r2AsReportTitle}</h2>
      <p className="text-sm text-muted">{t.r2AsReportLead}</p>
      <Checkbox label={t.r2AsKioskMode} checked={kioskMode} onChange={(e) => setKioskMode(e.target.checked)} />
      {kioskMode && <KioskIdle onIdle={() => { reset(); setSent(null); }} />}
      <Card title={t.r2AsConsentTitle} headingAs="h3" tone="info">
        <p className="text-sm">{t.r2AsConsentRead}</p>
        <blockquote className="my-2 border-s-4 border-civic ps-3">{consentText}</blockquote>
        <Select label={t.r2AsMethod} value={f.method} onChange={(e) => setF((s) => ({ ...s, method: e.target.value as ConsentMethod }))} options={(["read_aloud_agreed", "signed_paper", "kiosk_screen"] as const).map((k) => ({ value: k, label: t[`r2AsMethod_${k}`] }))} />
        <div className="mt-2 space-y-1">
          <Checkbox label={t.r2AsAgreeFile} checked={c.file} onChange={(e) => { setC((s) => ({ ...s, file: e.target.checked })); setErr(null); }} />
          <Checkbox label={t.r2AsAgreePublish} checked={c.publish} onChange={(e) => { setC((s) => ({ ...s, publish: e.target.checked })); setErr(null); }} />
          <Checkbox label={t.r2AsAgreeNoAccount} checked={c.noAccount} onChange={(e) => { setC((s) => ({ ...s, noAccount: e.target.checked })); setErr(null); }} />
        </div>
        {consentErr && <p role="alert" className="mt-1 text-sm text-danger">{consentErr}</p>}
        <p className="mt-2"><a href="/volunteer/consent" target="_blank" rel="noopener noreferrer" className="text-civic underline">{t.r2AsPaper}</a></p>
      </Card>
      {kiosks.data?.kind === "ok" && kiosks.data.data.length > 0 && (
        <Select label={t.r2AsKiosk} value={f.kiosk} onChange={(e) => setF((s) => ({ ...s, kiosk: e.target.value }))} options={[{ value: "", label: t.r2AsNoKiosk }, ...kiosks.data.data.map((k) => ({ value: k.id, label: k.place_text ? `${k.label} (${k.place_text})` : k.label }))]} />
      )}
      <Input label={t.r2AsTitleField} maxLength={150} value={f.title} onChange={(e) => { setF((s) => ({ ...s, title: e.target.value })); setErr(null); }} error={err === "title" ? t.r2AsErr_title : undefined} />
      <Select label={t.r2AsCategory} value={f.category} placeholder="—" onChange={(e) => { setF((s) => ({ ...s, category: e.target.value })); setErr(null); }} options={CATEGORIES.map((k) => ({ value: k, label: dict[lang].cats[k] }))} error={err === "category" ? t.r2AsErr_category : undefined} />
      <Textarea label={t.r2AsDesc} rows={5} maxLength={2000} value={f.description} onChange={(e) => { setF((s) => ({ ...s, description: e.target.value })); setErr(null); }} error={err === "description" ? t.r2AsErr_description : undefined} />
      <Input label={t.r2AsArea} optional value={f.area} onChange={(e) => setF((s) => ({ ...s, area: e.target.value }))} />
      <p className="text-sm font-medium">{t.r2AsEmergency}</p>
      <Button type="submit" size={kioskMode ? "lg" : "md"} loading={m.isPending}>{t.r2AsSubmit}</Button>
    </form>
  );
}

/** Shared screen: after a quiet spell a warning appears, then the typed text is cleared and the volunteer is signed out (F8.3 "auto sign-out"). */
function KioskIdle({ onIdle }: { onIdle: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const last = useRef(0);
  const idleRef = useRef(onIdle);
  useEffect(() => { idleRef.current = onIdle; });
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    last.current = Date.now();
    const touch = () => { last.current = Date.now(); setLeft(null); };
    const ev = ["pointerdown", "keydown", "touchstart"] as const;
    ev.forEach((x) => window.addEventListener(x, touch));
    const timer = window.setInterval(() => {
      const quiet = Date.now() - last.current;
      if (quiet > KIOSK_IDLE_MS) {
        window.clearInterval(timer);
        idleRef.current();
        void import("@/lib/supabase/client").then((m) => m.supabaseBrowser().auth.signOut()).catch(() => {}).finally(() => { router.push("/login?next=/volunteer&idle=1"); router.refresh(); });
      } else if (quiet > KIOSK_IDLE_MS - 15_000) setLeft(Math.ceil((KIOSK_IDLE_MS - quiet) / 1000));
    }, 1000);
    return () => { ev.forEach((x) => window.removeEventListener(x, touch)); window.clearInterval(timer); };
  }, [router]);
  if (left === null) return null;
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3"><p>{fillNum(t.r2AsKioskLeft, { n: left }, lang)}</p><Button variant="secondary" onClick={() => { last.current = Date.now(); setLeft(null); }}>{t.r2AsKioskStay}</Button></div>;
}

function MyAssisted() {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["vol-reports"], queryFn: fetchMyAssisted, retry: false });
  if (q.data?.kind !== "ok" || q.data.data.length === 0) return null;
  return (
    <section aria-labelledby="vol-rep" className="space-y-2">
      <h2 id="vol-rep" className="jk-h2">{t.r2AsMyReports}</h2>
      <ul className="space-y-2">{q.data.data.map((r) => <li key={r.ref} className="rounded-xl border border-line bg-white p-3 text-sm"><strong>{r.ref}</strong> · {fmtDay(r.created_at, lang)} · <Badge tone="teal">{t.r2AsLabel}</Badge></li>)}</ul>
    </section>
  );
}

// Office ----------------------------------------------------------------------------------------------------------------------------------------------
export function VolunteersOffice({ constituency }: { constituency: string }) {
  return <QueryProvider><OfficeInner constituency={constituency} /></QueryProvider>;
}

function OfficeInner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const fail = useR2Fail();
  const q = useQuery({ queryKey: ["office-vol", constituency], queryFn: () => fetchOfficeVolunteers(constituency), retry: false });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["office-vol", constituency] });
  const [note, setNote] = useState("");
  const [k, setK] = useState({ label: "", place: "" });
  const dec = useMutation({ mutationFn: (a: { id: string; d: "approve" | "reject" | "suspend" | "reinstate" }) => decideVolunteer(a.id, a.d, note.trim() || undefined), onSuccess: () => { toast("success", t.r2Done); setNote(""); refresh(); }, onError: fail });
  const add = useMutation({ mutationFn: () => createKiosk({ constituency, label: k.label.trim(), ...(k.place.trim() ? { place_text: k.place.trim() } : {}) }), onSuccess: () => { toast("success", t.r2Done); setK({ label: "", place: "" }); refresh(); }, onError: fail });
  const retire = useMutation({ mutationFn: (id: string) => retireKiosk(id), onSuccess: () => { toast("success", t.r2Done); refresh(); }, onError: fail });
  return (
    <Gate data={q.data}>
      {(d) => (
        <div className="space-y-5">
          <section aria-labelledby="ov-v" className="space-y-3">
            <h2 id="ov-v" className="jk-h2">{t.r2AsVolunteers}</h2>
            <Textarea label={t.r2AsDecisionNote} optional rows={2} maxLength={500} value={note} error={noteTooShort(note) ? t.r2NoteShort : undefined} onChange={(e) => setNote(e.target.value)} />
            <Boundary q={q} isEmpty={() => d.volunteers.length === 0} emptyTitle={t.r2AsNoVolunteers}>
              {() => (
                <ul className="space-y-2">{d.volunteers.map((v) => {
                  const needNote = note.trim().length < 5;
                  const shortNote = noteTooShort(note);
                  return (
                    <li key={v.id} className="space-y-2 rounded-xl border border-line bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={v.status === "active" ? "success" : v.status === "pending" ? "warning" : "neutral"}>{t[`r2AsSt_${v.status}`]}</Badge>
                        <span className="text-sm text-muted">{fmtDay(v.applied_at, lang)} · {fillNum(t.r2AsReports30, { n: v.reports_30d }, lang)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {v.status === "pending" && <><ConfirmAction label={t.r2AsApprove} body={t.r2AsDecisionBody} disabled={shortNote} loading={dec.isPending} onConfirm={() => dec.mutateAsync({ id: v.id, d: "approve" })} /><ConfirmAction label={t.r2AsReject} variant="danger" body={t.r2AsDecisionBody} disabled={needNote} loading={dec.isPending} onConfirm={() => dec.mutateAsync({ id: v.id, d: "reject" })} /></>}
                        {v.status === "active" && <ConfirmAction label={t.r2AsSuspend} variant="danger" body={t.r2AsDecisionBody} disabled={needNote} loading={dec.isPending} onConfirm={() => dec.mutateAsync({ id: v.id, d: "suspend" })} />}
                        {v.status === "suspended" && <ConfirmAction label={t.r2AsReinstate} body={t.r2AsDecisionBody} disabled={shortNote} loading={dec.isPending} onConfirm={() => dec.mutateAsync({ id: v.id, d: "reinstate" })} />}
                      </div>
                    </li>
                  );
                })}</ul>
              )}
            </Boundary>
          </section>
          <section aria-labelledby="ov-k" className="space-y-3">
            <h2 id="ov-k" className="jk-h2">{t.r2AsKiosks}</h2>
            <form noValidate onSubmit={(e) => { e.preventDefault(); if (k.label.trim().length >= 3) add.mutate(); }} className="space-y-3 rounded-2xl border border-line bg-white p-4">
              <Input label={t.r2AsKioskLabel} maxLength={80} value={k.label} onChange={(e) => setK((s) => ({ ...s, label: e.target.value }))} />
              <Input label={t.r2AsKioskPlace} optional value={k.place} onChange={(e) => setK((s) => ({ ...s, place: e.target.value }))} />
              <Button type="submit" disabled={k.label.trim().length < 3} loading={add.isPending}>{t.r2AsKioskAdd}</Button>
            </form>
            <ul className="space-y-2">{d.kiosks.filter((x) => x.status !== "retired").map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3">
                <span className="min-w-0 break-words">{x.label}{x.place_text ? ` · ${x.place_text}` : ""}</span>
                <ConfirmAction label={t.r2AsKioskRetire} variant="secondary" body={t.r2AsKioskRetireBody} loading={retire.isPending} onConfirm={() => retire.mutateAsync(x.id)} />
              </li>
            ))}</ul>
          </section>
        </div>
      )}
    </Gate>
  );
}
