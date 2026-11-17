"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { useLang } from "@/components/ui/useLang";
import { fmtNum } from "@/lib/format";
import { mailtoUrl } from "@/lib/legal";
import { looksPersonal, supportText, validateSupport, type SupportInput, type SupportKind } from "@/lib/pilot";

/**
 * Contact and pilot feedback (F6.2). There is no endpoint for it yet (docs/frontend.md Phase 6), so the form prepares the text and hands it
 * over by email (when the operator set a support address) or by copy. It never asks for a password or code and warns when the text looks personal.
 */
export default function SupportForm({ supportEmail }: { supportEmail: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [v, setV] = useState<SupportInput>({ kind: "question", where: "", clarity: "", what: "" });
  const [errs, setErrs] = useState<ReturnType<typeof validateSupport>>({});
  const [ready, setReady] = useState(false);
  const kindName = t[({ question: "spKindQuestion", problem: "spKindProblem", tester: "spKindTester" } as const)[v.kind]];
  const text = supportText(v, { kind: t.spBodyKind, where: t.spBodyWhere, clarity: t.spBodyClarity, what: t.spBodyWhat, kindName }, (n) => fmtNum(Number(n), lang));
  const personal = looksPersonal(v.what) || looksPersonal(v.where);

  if (ready) {
    const copy = async () => {
      try { await navigator.clipboard.writeText(text); toast("success", t.spCopied); } catch { /* the text is visible; the person can select it */ }
    };
    return (
      <Card title={t.spTitle}>
        <div className="space-y-3">
          <p role="status">{t.spReady}</p>
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm">{text}</pre>
          {personal && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{t.spPiiWarn}</p>}
          {!supportEmail && <p className="text-sm text-muted">{t.spNoContact}</p>}
          <div className="flex flex-wrap gap-2">
            {supportEmail && <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-civic px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic" href={mailtoUrl(supportEmail, t.spMailSubject.replace("{kind}", kindName), text)}>{t.spSend}</a>}
            <Button variant="secondary" onClick={() => void copy()}>{t.spCopy}</Button>
            <Button variant="ghost" onClick={() => setReady(false)}>{t.spEdit}</Button>
          </div>
          <p className="text-sm text-muted">{t.spNote}</p>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t.spTitle}>
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); const er = validateSupport(v); setErrs(er); if (!er.what && !er.clarity) setReady(true); }}>
        <p className="text-muted">{t.spLead}</p>
        <p className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{t.spEmergency}</p>
        <Select label={t.spKind} value={v.kind} hint={v.kind === "tester" ? t.spKindNote : undefined} onChange={(e) => setV({ ...v, kind: e.target.value as SupportKind })}
          options={[{ value: "question", label: t.spKindQuestion }, { value: "problem", label: t.spKindProblem }, { value: "tester", label: t.spKindTester }]} />
        <Input label={t.spWhere} hint={t.spWhereHint} optional value={v.where} maxLength={120} autoComplete="off" onChange={(e) => setV({ ...v, where: e.target.value })} />
        {v.kind === "tester" && (
          <Select label={t.spClarity} placeholder={t.spClarityPick} value={v.clarity} error={errs.clarity && t[errs.clarity]} onChange={(e) => setV({ ...v, clarity: e.target.value })}
            options={(["spClarity1", "spClarity2", "spClarity3", "spClarity4", "spClarity5"] as const).map((k, i) => ({ value: String(i + 1), label: t[k] }))} />
        )}
        <Textarea label={t.spWhat} hint={t.spWhatHint} value={v.what} maxLength={1500} rows={6} error={errs.what && t[errs.what]} onChange={(e) => setV({ ...v, what: e.target.value })} />
        <p className="text-sm text-muted">{t.spWarn}</p>
        <Button type="submit">{t.spPrepare}</Button>
      </form>
    </Card>
  );
}
