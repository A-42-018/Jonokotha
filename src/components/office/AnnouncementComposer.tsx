"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { ApiError } from "@/lib/api-client";
import { fmtDate } from "@/lib/format";
import { newId } from "@/lib/offline-queue";
import { fetchAnnouncements, publishAnnouncement, withdrawAnnouncement } from "@/lib/office-api";

export default function AnnouncementComposer({ constituency }: { constituency: string }) {
  return <QueryProvider><ComposerInner constituency={constituency} /></QueryProvider>;
}

/** Public announcement composer: preview, then confirm, then it is public at once. Withdraw takes it down. */
function ComposerInner({ constituency }: { constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const qc = useQueryClient();
  const key = useRef(newId());
  const list = useQuery({ queryKey: ["announcements", constituency], queryFn: () => fetchAnnouncements(constituency) });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errs, setErrs] = useState<{ title?: string; body?: string }>({});
  const [dlg, setDlg] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["announcements", constituency] });
  const fail = (e: unknown) => toast("error", e instanceof ApiError && e.status === 403 ? t.ofToastForbidden : t.ofToastFail);
  const publish = useMutation({
    mutationFn: () => publishAnnouncement(constituency, title, body, key.current),
    onSuccess: () => { toast("success", t.anPublished); setTitle(""); setBody(""); setDlg(false); key.current = newId(); refresh(); },
    onError: (e) => { setDlg(false); fail(e); },
  });
  const withdraw = useMutation({ mutationFn: withdrawAnnouncement, onSuccess: () => { toast("info", t.anWithdrawn); refresh(); }, onError: fail });

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const x = { title: title.trim().length < 5 ? t.anErrTitle : undefined, body: body.trim().length < 20 ? t.anErrBody : undefined };
    setErrs(x);
    if (!x.title && !x.body) setDlg(true);
  }
  const items = list.data ?? [];
  return (
    <div className="space-y-4">
      <form onSubmit={ask} noValidate className="space-y-3">
        <Input label={t.anFieldTitle} maxLength={120} value={title} error={errs.title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label={t.anFieldBody} rows={6} maxLength={2000} value={body} error={errs.body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit">{t.anPublish}</Button>
      </form>
      {(title || body) && (
        <Card tone="info" title={t.anPreview}><p className="font-medium">{title}</p><p className="whitespace-pre-wrap break-words">{body}</p></Card>
      )}
      <section aria-labelledby="an-list" className="space-y-2">
        <h2 id="an-list" className="font-semibold">{t.anList}</h2>
        {list.isPending && <p role="status" className="text-sm text-muted">{t.exLoading}</p>}
        {list.isError && <p role="alert" className="text-sm">{t.ofToastFail}</p>}
        {list.isSuccess && items.length === 0 && <p className="text-muted">{t.anEmpty}</p>}
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.ref}>
              <Card>
                <p className="font-medium">{a.title}</p>
                <p className="whitespace-pre-wrap break-words">{a.body}</p>
                <p className="text-xs text-muted">{fmtDate(a.published_at, lang)}</p>
                <Button variant="ghost" loading={withdraw.isPending && withdraw.variables === a.ref} onClick={() => withdraw.mutate(a.ref)}>{t.anWithdraw}</Button>
              </Card>
            </li>
          ))}
        </ul>
      </section>
      <Dialog open={dlg} onClose={() => setDlg(false)} title={t.anConfirmTitle} description={t.anConfirmBody}
        actions={<><Button variant="ghost" onClick={() => setDlg(false)}>{t.cpCancel}</Button><Button loading={publish.isPending} onClick={() => publish.mutate()}>{t.anPublish}</Button></>} />
    </div>
  );
}
