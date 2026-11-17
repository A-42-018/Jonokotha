"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/ui/useT";
import { challengeText, mailtoUrl, validateChallenge, type ChallengeInput, type ChallengeType } from "@/lib/legal";

/**
 * Content challenge: the author of hidden content answers the moderator's reason. There is no endpoint for it yet (docs/frontend.md F.6),
 * so the form prepares the text and hands it over by email (when the operator set a support address) or by copy.
 */
export default function ChallengeForm({ supportEmail, defaultRef = "" }: { supportEmail: string; defaultRef?: string }) {
  const t = useT();
  const toast = useToast();
  const [v, setV] = useState<ChallengeInput>({ type: "issue", ref: defaultRef, why: "" });
  const [errs, setErrs] = useState<ReturnType<typeof validateChallenge>>({});
  const [ready, setReady] = useState(false);
  const typeName = t[({ issue: "chTypeIssue", idea: "chTypeIdea", question: "chTypeQuestion" } as const)[v.type]];
  const text = challengeText(v, { type: t.chBodyType, ref: t.chBodyRef, why: t.chBodyWhy, typeName });

  if (ready) {
    const copy = async () => {
      try { await navigator.clipboard.writeText(text); toast("success", t.chCopied); } catch { /* the text is visible; the person can select it */ }
    };
    return (
      <Card title={t.chTitle}>
        <div className="space-y-3">
          <p role="status">{t.chReady}</p>
          <pre className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-sm">{text}</pre>
          {!supportEmail && <p className="text-sm text-muted">{t.chNoContact}</p>}
          <div className="flex flex-wrap gap-2">
            {supportEmail && <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-civic px-5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-civic" href={mailtoUrl(supportEmail, t.chMailSubject.replace("{ref}", v.ref.trim()), text)}>{t.chSend}</a>}
            <Button variant="secondary" onClick={() => void copy()}>{t.chCopy}</Button>
            <Button variant="ghost" onClick={() => setReady(false)}>{t.chEdit}</Button>
          </div>
          <p className="text-sm text-muted">{t.chNote}</p>
        </div>
      </Card>
    );
  }
  return (
    <Card title={t.chTitle}>
      <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); const er = validateChallenge(v); setErrs(er); if (!er.ref && !er.why) setReady(true); }}>
        <p className="text-muted">{t.chLead}</p>
        <Select label={t.chType} value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as ChallengeType })}
          options={[{ value: "issue", label: t.chTypeIssue }, { value: "idea", label: t.chTypeIdea }, { value: "question", label: t.chTypeQuestion }]} />
        <Input label={t.chRef} hint={t.chRefHint} value={v.ref} maxLength={41} autoComplete="off" error={errs.ref && t[errs.ref]} onChange={(e) => setV({ ...v, ref: e.target.value })} />
        <Textarea label={t.chWhy} hint={t.chWhyHint} value={v.why} maxLength={1500} rows={6} error={errs.why && t[errs.why]} onChange={(e) => setV({ ...v, why: e.target.value })} />
        <Button type="submit">{t.chPrepare}</Button>
      </form>
    </Card>
  );
}
