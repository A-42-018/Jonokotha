"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/i18n";

const KEY = "jonokotha:office-announcements:v1";
const NONE: { title: string; body: string; at: string }[] = [];

/** Public announcement composer: preview, then confirm. Device-local until the announcements API exists. */
export default function AnnouncementComposer() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [list, setList] = useLocalValue(KEY, NONE);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [errs, setErrs] = useState<{ title?: string; body?: string }>({});
  const [dlg, setDlg] = useState(false);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    const x = { title: title.trim().length < 5 ? t.anErrTitle : undefined, body: body.trim().length < 20 ? t.anErrBody : undefined };
    setErrs(x);
    if (!x.title && !x.body) setDlg(true);
  }
  function publish() {
    setList([{ title: title.trim(), body: body.trim(), at: new Date().toISOString() }, ...list]);
    toast("success", t.anPublished);
    setTitle(""); setBody(""); setDlg(false);
  }
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
      <p className="text-xs text-muted">{t.anLocal}</p>
      <section aria-labelledby="an-list" className="space-y-2">
        <h2 id="an-list" className="font-semibold">{t.anList}</h2>
        {list.length === 0 ? <p className="text-muted">{t.anEmpty}</p> : (
          <ul className="space-y-2">{list.map((a) => <li key={a.at}><Card><p className="font-medium">{a.title}</p><p className="whitespace-pre-wrap break-words">{a.body}</p><p className="text-xs text-muted">{fmtDate(a.at, lang)}</p></Card></li>)}</ul>
        )}
      </section>
      <Dialog open={dlg} onClose={() => setDlg(false)} title={t.anConfirmTitle} description={t.anConfirmBody}
        actions={<><Button variant="ghost" onClick={() => setDlg(false)}>{t.cpCancel}</Button><Button onClick={publish}>{t.anPublish}</Button></>} />
    </div>
  );
}
