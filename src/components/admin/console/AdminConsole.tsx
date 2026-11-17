"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Boundary from "@/components/office/ws/Boundary";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Table from "@/components/ui/Table";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import {
  EMAIL_RE, INVITE_ROLES, REASON_MIN, REP_FIELDS, ROLES, UUID_RE, checkBoundary, fetchEvals, fetchHealth, importBoundaries, ingestKnowledge, invite, isHttpUrl, isIsoDate, setAccount, setRepField,
  type BoundarySource, type InviteRole, type RepField, type Role,
} from "@/lib/admin-console-api";
import { ApiError } from "@/lib/api-client";
import { fillNum, fmtDate, fmtNum } from "@/lib/format";
import type { Dict } from "@/lib/i18n";

const wrap = (children: React.ReactNode) => <QueryProvider>{children}</QueryProvider>;
const get = (t: Dict, k: string) => (t as unknown as Record<string, string>)[k] ?? k;

/** The message under a failed write: offline, no permission, not found, or a refusal. */
function failText(t: Dict, e: unknown, notFound?: string) {
  if (e instanceof ApiError && e.isNetwork) return t.acOffline;
  if (e instanceof ApiError && e.status === 403) return t.acNoAccess;
  if (e instanceof ApiError && e.status === 404 && notFound) return notFound;
  return t.acFailed;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// ---- Users: role / status and staff invitation ----
export function UsersPanel() { return wrap(<UsersInner />); }
function UsersInner() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [id, setId] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<{ id?: string; reason?: string }>({});
  const save = useMutation({
    mutationFn: () => setAccount(id.trim(), role, status, reason),
    onSuccess: () => { toast("success", t.acDone); setReason(""); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 403 ? t.acUserSelf : failText(t, e, t.acUserNotFound)),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const x = { id: UUID_RE.test(id.trim()) ? undefined : t.acBadId, reason: reason.trim().length >= REASON_MIN ? undefined : t.acNeedReason };
    setErr(x);
    if (!x.id && !x.reason) save.mutate();
  }

  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [irole, setIrole] = useState<InviteRole>("case_officer");
  const [ierr, setIerr] = useState<{ email?: string; area?: string }>({});
  const inv = useMutation({
    mutationFn: () => invite(email, area, irole),
    onSuccess: () => { toast("success", t.acInviteDone); setEmail(""); },
    onError: (e) => toast("error", failText(t, e)),
  });
  function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    const x = { email: EMAIL_RE.test(email.trim()) ? undefined : t.acInviteEmailBad, area: area.trim() ? undefined : t.acInviteAreaBad };
    setIerr(x);
    if (!x.email && !x.area) inv.mutate();
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="ac-user-h">
        <h2 id="ac-user-h" className="text-lg font-semibold">{t.acUserFormTitle}</h2>
        <Input label={t.acUserId} dir="ltr" value={id} error={err.id} onChange={(e) => setId(e.target.value)} />
        <Select label={t.acUserRole} value={role} onChange={(e) => setRole(e.target.value as Role)} options={ROLES.map((r) => ({ value: r, label: get(t, `acRole_${r}`) }))} />
        <Select label={t.acUserStatus} value={status} onChange={(e) => setStatus(e.target.value as "active" | "suspended")} options={[{ value: "active", label: t.acStatus_active }, { value: "suspended", label: t.acStatus_suspended }]} />
        <Textarea label={t.acUserReason} hint={t.acUserReasonHint} rows={2} maxLength={300} value={reason} error={err.reason} onChange={(e) => setReason(e.target.value)} />
        <Button type="submit" loading={save.isPending}>{t.acUserSave}</Button>
      </form>
      <form onSubmit={submitInvite} noValidate className="space-y-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="ac-inv-h">
        <h2 id="ac-inv-h" className="text-lg font-semibold">{t.acInviteTitle}</h2>
        <p className="text-sm text-muted">{t.acInviteLead}</p>
        <Input label={t.acInviteEmail} type="email" inputMode="email" value={email} error={ierr.email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t.acInviteArea} hint={t.acInviteAreaHint} dir="ltr" value={area} error={ierr.area} onChange={(e) => setArea(e.target.value)} />
        <Select label={t.acInviteRole} value={irole} onChange={(e) => setIrole(e.target.value as InviteRole)} options={INVITE_ROLES.map((r) => ({ value: r, label: get(t, `acInvRole_${r}`) }))} />
        <Button type="submit" loading={inv.isPending}>{t.acInviteSend}</Button>
        {inv.data && (
          <div role="status" className="space-y-1 rounded-xl border border-line bg-slate-50 p-3 text-sm">
            <p className="font-medium">{t.acInviteDone}</p>
            {inv.data.emailed && <p>{t.acInviteEmailed}</p>}
            <p>{t.acInviteToken}: <code dir="ltr" className="break-all">{inv.data.invite_token}</code></p>
            <p>{fillNum(t.acInviteExpires, { date: fmtDate(inv.data.expires_at, lang) }, lang)}</p>
          </div>
        )}
      </form>
    </div>
  );
}

// ---- Boundaries import ----
export function BoundaryPanel() { return wrap(<BoundaryInner />); }
function BoundaryInner() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<BoundarySource>({ name: "", url: "", license: "", fetched_at: todayIso() });
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  const check = checkBoundary(src, text);
  const send = useMutation({
    mutationFn: () => importBoundaries(src, check.geojson),
    onSuccess: () => { toast("success", t.acAreasDone); setText(""); setShown(false); },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 422 ? t.acAreasRejected : failText(t, e)),
  });
  const bad = (p: string) => (shown && check.problems.includes(p as never) ? get(t, `acBp_${p}`) : undefined);
  const set = (k: keyof BoundarySource) => (e: React.ChangeEvent<HTMLInputElement>) => setSrc({ ...src, [k]: e.target.value });
  async function load(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setShown(true);
    if (check.problems.length === 0) send.mutate();
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="ac-bnd-h">
      <h2 id="ac-bnd-h" className="text-lg font-semibold">{t.acAreasImport}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <Input label={t.acSrcName} value={src.name} error={bad("name")} onChange={set("name")} />
        <Input label={t.acSrcUrl} type="url" inputMode="url" dir="ltr" value={src.url} error={bad("url")} onChange={set("url")} />
        <Input label={t.acSrcLicense} value={src.license} error={bad("license")} onChange={set("license")} />
        <Input label={t.acSrcDate} hint={t.acSrcDateHint} dir="ltr" value={src.fetched_at} error={bad("date")} onChange={set("fetched_at")} />
      </div>
      <Textarea label={t.acGeo} hint={t.acGeoHint} dir="ltr" rows={6} value={text} error={bad("json") ?? bad("type") ?? bad("empty") ?? bad("many") ?? bad("big") ?? bad("props")} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3">
        <input ref={file} type="file" accept=".json,.geojson,application/json" className="sr-only" aria-label={t.acGeoFile} onChange={(e) => void load(e.target.files?.[0])} />
        <Button type="button" variant="secondary" onClick={() => file.current?.click()}>{t.acGeoFile}</Button>
        {check.count > 0 && check.problems.length === 0 && <span role="status" className="text-sm text-muted">{fillNum(t.acAreasCount, { n: check.count }, lang)}</span>}
        <Button type="submit" loading={send.isPending}>{t.acAreasSend}</Button>
      </div>
      <p className="text-sm text-muted">{t.acAudited}</p>
    </form>
  );
}

// ---- Representative fields ----
export function RepFieldsPanel() { return wrap(<RepFieldsInner />); }
function RepFieldsInner() {
  const t = useT();
  const toast = useToast();
  const [id, setId] = useState("");
  const [field, setField] = useState<RepField>("office_phone");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [checked, setChecked] = useState(todayIso());
  const [err, setErr] = useState<Record<string, string | undefined>>({});
  const save = useMutation({
    mutationFn: () => setRepField(id.trim(), { field, value, source_url: source, checked_at: checked }),
    onSuccess: () => { toast("success", t.acDone); setValue(""); setSource(""); },
    onError: (e) => toast("error", failText(t, e, t.acUserNotFound)),
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const x = { id: UUID_RE.test(id.trim()) ? undefined : t.acBadId, value: value.trim() ? undefined : t.acRepNeedValue, source: isHttpUrl(source) ? undefined : t.acBp_url, checked: isIsoDate(checked) ? undefined : t.acBp_date };
    setErr(x);
    if (!x.id && !x.value && !x.source && !x.checked) save.mutate();
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-line bg-white p-4" aria-labelledby="ac-rep-h">
      <h2 id="ac-rep-h" className="sr-only">{t.acRepsTitle}</h2>
      <Input label={t.acRepId} dir="ltr" value={id} error={err.id} onChange={(e) => setId(e.target.value)} />
      <Select label={t.acRepField} value={field} onChange={(e) => setField(e.target.value as RepField)} options={REP_FIELDS.map((f) => ({ value: f, label: get(t, `acRepFld_${f}`) }))} />
      <Textarea label={t.acRepValue} rows={3} maxLength={2000} value={value} error={err.value} onChange={(e) => setValue(e.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <Input label={t.acRepSource} type="url" inputMode="url" dir="ltr" value={source} error={err.source} onChange={(e) => setSource(e.target.value)} />
        <Input label={t.acRepChecked} hint={t.acSrcDateHint} dir="ltr" value={checked} error={err.checked} onChange={(e) => setChecked(e.target.value)} />
      </div>
      <Button type="submit" loading={save.isPending}>{t.acRepSave}</Button>
      <p className="text-sm text-muted">{t.acAudited}</p>
    </form>
  );
}

// ---- Knowledge index rebuild ----
export function KnowledgePanel() { return wrap(<KnowledgeInner />); }
function KnowledgeInner() {
  const t = useT();
  const toast = useToast();
  const run = useMutation({
    mutationFn: ingestKnowledge,
    onSuccess: () => toast("success", t.acKnowDone),
    onError: (e) => toast("error", failText(t, e)),
  });
  return (
    <section aria-labelledby="ac-kn-h" className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 id="ac-kn-h" className="text-lg font-semibold">{t.acKnowIndexT}</h2>
      <p className="text-muted">{t.acKnowIndexB}</p>
      <Button onClick={() => run.mutate()} loading={run.isPending}>{t.acKnowRun}</Button>
      {run.data && <pre role="status" aria-label={t.acKnowResult} dir="ltr" className="overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs">{JSON.stringify(run.data, null, 2)}</pre>}
    </section>
  );
}

// ---- AI evaluation results ----
export function EvalsPanel() { return wrap(<EvalsInner />); }
function EvalsInner() {
  const t = useT();
  const lang = useLang();
  const q = useQuery({ queryKey: ["admin-evals"], queryFn: fetchEvals, retry: false });
  return (
    <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.acEvalEmpty}>
      {(rows) => (
        <Table
          caption={t.acEvalCaption}
          rows={rows}
          rowKey={(r) => r.id}
          columns={[
            { key: "d", header: t.acEvalDate, nowrap: true, cell: (r) => fmtDate(r.created_at, lang) },
            { key: "s", header: t.acEvalSet, primary: true, cell: (r) => r.dataset_name },
            { key: "n", header: t.acEvalSize, align: "end", cell: (r) => fmtNum(r.dataset_size, lang) },
            { key: "m", header: t.acEvalModel, cell: (r) => r.model ?? "—" },
            { key: "x", header: t.acEvalMetrics, cell: (r) => <span dir="ltr">{Object.entries(r.metrics).map(([k, v]) => `${k}: ${v ?? "—"}`).join(", ")}</span> },
          ]}
        />
      )}
    </Boundary>
  );
}

// ---- Health: only the database probe exists (GET /api/health) ----
export function HealthPanel() { return wrap(<HealthInner />); }
function HealthInner() {
  const t = useT();
  const q = useQuery({ queryKey: ["admin-health"], queryFn: fetchHealth, retry: false, refetchOnWindowFocus: false });
  const text = q.isPending || q.isFetching ? t.acHealthChecking : q.data === "ok" ? t.acHealthUp : q.data === "down" ? t.acHealthDown : t.acHealthOffline;
  return (
    <Card title={t.acHealthDb} headingAs="h2">
      <p role="status" className="text-lg font-medium">
        <span aria-hidden="true">{q.isFetching ? "…" : q.data === "ok" ? "✓ " : "✕ "}</span>{text}
      </p>
      <div className="mt-3"><Button variant="secondary" onClick={() => void q.refetch()} loading={q.isFetching}>{t.acHealthRecheck}</Button></div>
    </Card>
  );
}

export function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center text-civic underline">{children}</Link>;
}
