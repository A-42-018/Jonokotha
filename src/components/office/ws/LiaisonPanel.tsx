"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import PlannedPanel from "@/components/ui/PlannedPanel";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/format";
import { addLiaisonNote, fetchReferrals, fetchReferred, noteTooShort, type ReferredIssue } from "@/lib/liaison-api";
import Boundary, { label, saveError } from "./Boundary";

/** Cases referred to the liaison's agency (GET /office/issues, RLS-scoped). Only the documented `update` note is live; the rest is shown as not switched on until B5.2. */
export default function LiaisonPanel() {
  return <QueryProvider><Inner /></QueryProvider>;
}

function Inner() {
  const t = useT();
  const q = useQuery({ queryKey: ["liaison-issues"], queryFn: fetchReferred, retry: false });
  return (
    <div className="space-y-4">
      <p role="note" className="rounded-2xl border border-line bg-slate-50 p-3 text-sm">{t.lsNotOfficial}</p>
      <Boundary q={q} isEmpty={(d) => d.length === 0} emptyTitle={t.lsEmpty}>
        {(rows) => <ul className="space-y-3">{rows.map((r) => <li key={r.ref}><Item r={r} /></li>)}</ul>}
      </Boundary>
      <div className="grid gap-3 md:grid-cols-3">
        <PlannedPanel as="h2" title={t.lsAckTitle} body={t.lsAckBody} />
        <PlannedPanel as="h2" title={t.lsRefTitle} body={t.lsRefBody} />
        <PlannedPanel as="h2" title={t.lsCloseTitle} body={t.lsCloseBody} />
      </div>
    </div>
  );
}

function Item({ r }: { r: ReferredIssue }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pub, setPub] = useState(false);
  const [err, setErr] = useState("");
  const detail = useQuery({ queryKey: ["liaison-detail", r.ref], queryFn: () => fetchReferrals(r.ref), enabled: open, retry: false });
  const send = useMutation({
    mutationFn: () => addLiaisonNote(r.ref, text, pub),
    onSuccess: () => { toast("success", t.owSaved); setText(""); setPub(false); void qc.invalidateQueries({ queryKey: ["liaison-issues"] }); },
    onError: (e) => toast("error", saveError(t, e)),
  });
  return (
    <article className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t.owColRef}: <span dir="ltr">{r.ref}</span></span>
        <Badge tone="info">{label(t, "owSt_", r.status)}</Badge>
        {r.is_sample && <Badge>{t.owSample}</Badge>}
        <span className="text-sm text-muted">{t.owColUpdated}: {fmtDate(r.updated_at, lang)}</span>
      </div>
      <h2 className="jk-h2">{r.title}</h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t.lsCloseDetail : t.lsOpenDetail}<span className="sr-only">: {r.title}</span></Button>
        <Link href={`/office/${encodeURIComponent(r.ref)}`} className="inline-flex min-h-11 items-center text-civic underline">{t.lsOpenCase}<span className="sr-only">: {r.title}</span></Link>
      </div>
      {open && (
        <div className="space-y-3 border-t border-line pt-3">
          <section aria-label={t.lsReferralTitle} className="space-y-1">
            <h3 className="font-medium">{t.lsReferralTitle}</h3>
            <Boundary q={detail} emptyTitle={t.lsNoReferral} isEmpty={(d) => d.length === 0}>
              {(rows) => (
                <ul className="space-y-1 text-sm">{rows.map((x, i) => (
                  <li key={i}>
                    {x.agency_name && <p>{t.rfTo} {x.agency_name}</p>}
                    {x.forwarded_at && <p>{t.rfOn} {fmtDate(x.forwarded_at, lang)}</p>}
                    {x.external_reference && <p>{t.rfOfficeRef} <span dir="ltr">{x.external_reference}</span><br /><span className="text-muted">{t.rfOfficeRefNote}</span></p>}
                  </li>
                ))}</ul>
              )}
            </Boundary>
          </section>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (noteTooShort(text)) { setErr(t.lsNoteShort); return; } setErr(""); send.mutate(); }}>
            <h3 className="font-medium">{t.lsNoteTitle}</h3>
            <Textarea label={t.lsNote} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} error={err || undefined} />
            <Checkbox label={t.lsNotePublic} hint={t.lsNotePublicHint} checked={pub} onChange={(e) => setPub(e.target.checked)} />
            {pub && <p className="text-sm text-muted">{t.owPublicWarn}</p>}
            <Button type="submit" disabled={send.isPending}>{t.lsNoteSend}</Button>
          </form>
        </div>
      )}
    </article>
  );
}
