"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Photo from "@/components/ui/Photo";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import AsyncBlock from "@/components/ui/AsyncBlock";
import { createCheckin, fetchCheckins, noteOk, uploadCheckinPhoto, visitRange, type Checkin } from "@/lib/checkins-api";
import { fillNum, fmtDay } from "@/lib/format";
import { checkPhoto, compressImage, PHOTO_TYPES } from "@/lib/image";
import { writeProblem } from "@/lib/r11";
import { safeHref } from "@/lib/safe";

/**
 * Citizen check-ins on one public project (F7.3, masterplan 7.16). Always labelled citizen-submitted, never changes the project's status,
 * and shows the office's reply under the item. Needs a QueryProvider above it (ProjectDetail has one).
 */
export default function ProjectCheckins({ refId, signedIn, loginHref }: { refId: string; signedIn: boolean; loginHref: string }) {
  const t = useT();
  const q = useQuery({ queryKey: ["checkins", refId], queryFn: () => fetchCheckins(refId), retry: false });
  if (q.data?.kind === "planned") return <PlannedLine />;
  return (
    <section aria-labelledby="ck-h" className="space-y-3">
      <div className="flex items-center gap-3">
        <Photo src="/illustrations/spot-checkin.svg" alt="" width={80} height={80} loading="lazy" className="size-16 shrink-0" />
        <h2 id="ck-h" className="text-lg font-semibold">{t.ckTitle}</h2>
      </div>
      <p className="text-sm text-muted">{t.ckLead}</p>
      <p className="rounded-xl bg-slate-100 p-2 text-sm">{t.ckNotOfficial}</p>
      <AsyncBlock pending={q.isPending} error={q.error} onRetry={() => void q.refetch()}>
        {q.data?.kind === "ok" && (q.data.data.length === 0 ? <EmptyState title={t.ckEmpty} body={t.ckEmptyBody} /> : <ul className="space-y-3">{q.data.data.map((c) => <li key={c.id}><Item c={c} /></li>)}</ul>)}
      </AsyncBlock>
      {signedIn ? <AddCheckin refId={refId} /> : <Link href={loginHref} className="inline-flex min-h-11 items-center text-civic underline">{t.ckSignIn}</Link>}
    </section>
  );
}

function PlannedLine() {
  const t = useT();
  return <p data-planned className="rounded-xl border border-dashed border-line bg-slate-50 p-3 text-sm text-muted">{t.ckPlanned}</p>;
}

function Item({ c }: { c: Checkin }) {
  const t = useT();
  const lang = useLang();
  const photo = safeHref(c.photo_url);
  return (
    <Card as="article" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="teal" icon="👤">{t.ckLabel}</Badge>
        <span className="text-sm text-muted">{fillNum(t.ckVisited, { date: fmtDay(c.visited_at, lang) }, lang)}</span>
      </div>
      <p className="whitespace-pre-line break-words">{c.note}</p>
      {photo && <Photo src={photo} alt={t.ckPhotoAlt} loading="lazy" className="max-h-72 w-full rounded-xl object-cover" />}
      {c.office_response && (
        <div className="rounded-xl border border-civic/30 bg-civic/5 p-3">
          <p className="text-sm font-medium text-civic">{t.ckResponse}{c.responded_at && <span className="ms-2 font-normal text-muted">{fmtDay(c.responded_at, lang)}</span>}</p>
          <p className="whitespace-pre-line break-words">{c.office_response}</p>
        </div>
      )}
    </Card>
  );
}

function AddCheckin({ refId }: { refId: string }) {
  const t = useT();
  const toast = useToast();
  const qc = useQueryClient();
  const file = useId();
  const range = visitRange();
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [err, setErr] = useState<{ note?: string; date?: string; form?: string }>({});
  const key = useRef(crypto.randomUUID());
  const input = useRef<HTMLInputElement>(null);
  const send = useMutation({
    mutationFn: async () => {
      const made = await createCheckin(refId, { note: note.trim(), ...(date ? { visited_at: date } : {}) }, key.current);
      if (!photo) return { photoOk: true };
      try { await uploadCheckinPhoto(refId, made.id, photo.blob); return { photoOk: true }; } catch { return { photoOk: false }; }
    },
    onSuccess: (r) => {
      toast(r.photoOk ? "success" : "info", r.photoOk ? t.ckSent : t.ckSentNoPhoto);
      setNote(""); setDate(""); setErr({}); if (photo) URL.revokeObjectURL(photo.url); setPhoto(null); key.current = crypto.randomUUID();
      void qc.invalidateQueries({ queryKey: ["checkins", refId] });
    },
    onError: (e) => { key.current = crypto.randomUUID(); const p = writeProblem(e); setErr({ form: p === "limit" ? t.ckLimit : p === "auth" ? t.r1AuthMsg : t.r1FailMsg }); },
  });
  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const bad = PHOTO_TYPES.includes(f.type) ? await checkPhoto(f) : "type";
    if (bad) { toast("error", t.errPhotoType); return; }
    try { const blob = await compressImage(f); setPhoto({ blob, url: URL.createObjectURL(blob) }); } catch { toast("error", t.errPhotoFail); }
    if (input.current) input.current.value = "";
  }
  function submit() {
    const e: typeof err = {};
    if (!noteOk(note)) e.note = t.ckNoteShort;
    if (date && (date < range.min || date > range.max)) e.date = t.ckDateBad;
    setErr(e);
    if (!e.note && !e.date) send.mutate();
  }
  return (
    <Card as="section" title={t.ckAddTitle} headingAs="h3">
      <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">
        <p className="text-sm text-muted">{t.ckAddLead}</p>
        <Textarea label={t.ckNote} hint={t.ckNoteHint} rows={4} maxLength={500} value={note} error={err.note} onChange={(e) => setNote(e.target.value)} />
        <Input type="date" label={t.ckDate} hint={t.ckDateHint} optional min={range.min} max={range.max} value={date} error={err.date} onChange={(e) => setDate(e.target.value)} />
        <div className="space-y-2">
          <label htmlFor={file} className="block text-sm font-medium">{t.ckPhoto}</label>
          <input id={file} ref={input} type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" onChange={(e) => void pick(e.target.files)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => input.current?.click()}>{t.ckPhotoPick}</Button>
            {photo && <Button variant="ghost" onClick={() => { URL.revokeObjectURL(photo.url); setPhoto(null); }}>{t.ckPhotoRemove}</Button>}
          </div>
          {photo && <Photo src={photo.url} alt="" className="max-h-40 rounded-xl" />}
          <p className="text-sm text-muted">{t.ckPhotoHint}</p>
        </div>
        {err.form && <p role="alert" className="text-sm text-danger">{err.form}</p>}
        <Button type="submit" loading={send.isPending}>{send.isPending ? t.ckSending : t.ckSend}</Button>
      </form>
    </Card>
  );
}
