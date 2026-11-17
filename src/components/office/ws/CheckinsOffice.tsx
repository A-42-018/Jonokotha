"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmAction from "@/components/ui/ConfirmAction";
import Photo from "@/components/ui/Photo";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fetchOfficeCheckins, moderateCheckin, respondToCheckin, type OfficeCheckin } from "@/lib/checkins-api";
import { fillNum, fmtDay } from "@/lib/format";
import { fetchProjects } from "@/lib/projects-api";
import { safeHref } from "@/lib/safe";
import Boundary from "./Boundary";

/** Office view of citizen check-ins (F7.3): show or hide each one, and reply. Nothing here changes the project's own status. */
export default function CheckinsOffice(props: { constituency: string }) {
  return <QueryProvider><Inner {...props} /></QueryProvider>;
}

function Inner({ constituency }: { constituency: string }) {
  const t = useT();
  const projects = useQuery({ queryKey: ["office-projects", constituency], queryFn: () => fetchProjects(constituency), retry: false });
  const [ref, setRef] = useState("");
  const list = useQuery({ queryKey: ["office-checkins", ref], queryFn: () => fetchOfficeCheckins(ref), enabled: !!ref, retry: false });
  return (
    <section aria-labelledby="cko-h" className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <h2 id="cko-h" className="text-lg font-semibold">{t.ckoTitle}</h2>
      <p className="text-sm text-muted">{t.ckoLead}</p>
      <Boundary q={projects} isEmpty={(d) => d.length === 0} emptyTitle={t.ckoNoProjects}>
        {(rows) => <Select label={t.ckoProject} placeholder={t.ckoProject} value={ref} onChange={(e) => setRef(e.target.value)} options={rows.map((p) => ({ value: p.ref, label: p.title }))} />}
      </Boundary>
      {ref && list.data?.kind === "planned" && <p data-planned className="text-sm text-muted">{t.ckPlanned}</p>}
      {ref && list.data?.kind !== "planned" && (
        <Boundary q={list} isEmpty={(d) => d.kind === "ok" && d.data.length === 0} emptyTitle={t.ckoEmpty}>
          {(d) => d.kind === "ok" ? <ul className="space-y-3">{d.data.map((c) => <li key={c.id}><Row projectRef={ref} c={c} /></li>)}</ul> : null}
        </Boundary>
      )}
    </section>
  );
}

function Row({ projectRef, c }: { projectRef: string; c: OfficeCheckin }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [hiding, setHiding] = useState(false);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const done = () => { toast("success", t.ckoDone); void qc.invalidateQueries({ queryKey: ["office-checkins", projectRef] }); setHiding(false); setReplying(false); };
  const fail = (e: unknown) => toast("error", e instanceof ApiError && e.status === 403 ? t.ckoNoAccess : t.r1FailMsg);
  const mod = useMutation({ mutationFn: (a: "approve" | "hide") => moderateCheckin(c.id, a, a === "hide" ? reason.trim() : undefined), onSuccess: done, onError: fail });
  const resp = useMutation({ mutationFn: () => respondToCheckin(c.id, reply), onSuccess: () => { setReply(""); done(); }, onError: fail });
  const status = c.moderation_status === "approved" ? "approved" : c.moderation_status === "hidden" ? "hidden" : "pending";
  const photo = safeHref(c.photo_url ?? null);
  return (
    <Card as="article" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={status === "approved" ? "success" : status === "hidden" ? "danger" : "warning"}>{status === "approved" ? t.ckoApproved : status === "hidden" ? t.ckoHidden : t.ckoPending}</Badge>
        <span className="text-sm text-muted">{fillNum(t.ckVisited, { date: fmtDay(c.visited_at, lang) }, lang)}</span>
        {c.has_photo && !photo && <span className="text-sm text-muted">{t.ckoHasPhoto}</span>}
      </div>
      <p className="whitespace-pre-line break-words">{c.note}</p>
      {photo && <Photo src={photo} alt={t.ckPhotoAlt} loading="lazy" className="max-h-60 rounded-xl" />}
      {c.office_response && <p className="rounded-xl bg-civic/5 p-2 text-sm"><span className="font-medium">{t.ckResponse}: </span>{c.office_response}</p>}
      <div className="flex flex-wrap gap-2">
        {status !== "approved" && <Button variant="secondary" loading={mod.isPending && !hiding} onClick={() => mod.mutate("approve")}>{t.ckoApprove}</Button>}
        {status !== "hidden" && <Button variant="ghost" onClick={() => setHiding((x) => !x)}>{t.ckoHide}</Button>}
        {status === "approved" && !c.office_response && <Button variant="ghost" onClick={() => setReplying((x) => !x)}>{t.ckoRespond}</Button>}
      </div>
      {hiding && (
        <div className="space-y-2">
          <Textarea label={t.ckoHideReason} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="danger" disabled={reason.trim().length < 5} loading={mod.isPending} onClick={() => mod.mutate("hide")}>{t.ckoHide}</Button>
        </div>
      )}
      {replying && (
        <div className="space-y-2">
          <Textarea label={t.ckoRespondLabel} rows={3} maxLength={500} value={reply} onChange={(e) => setReply(e.target.value)} />
          <ConfirmAction label={t.ckoRespondSend} body={t.ckoRespondConfirm} disabled={reply.trim().length < 5} loading={resp.isPending} onConfirm={() => resp.mutateAsync()} />
        </div>
      )}
    </Card>
  );
}
