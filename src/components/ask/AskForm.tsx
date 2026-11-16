"use client";
import Link from "next/link";
import { useState } from "react";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { ASK_KEY, NO_ASKS, remainingToday, TOPICS, validateAsk, type AskKind } from "@/lib/ask";
import { fillNum } from "@/lib/i18n";

/** Ask Your MP form. Sign-in required. No messages API yet: stored on this device (see askSampleBanner). */
export default function AskForm({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [list, setList] = useLocalValue(ASK_KEY, NO_ASKS);
  const [kind, setKind] = useState<AskKind | "">("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errs, setErrs] = useState<ReturnType<typeof validateAsk>>({});
  const [now] = useState(() => Date.now());
  const left = remainingToday(list, now);

  if (!signedIn) {
    return (
      <Card tone="info">
        <p className="mb-3">{t.askNeedsSignIn}</p>
        <Link href={`/login?need=1&next=${encodeURIComponent("/ask")}`} className={buttonClass()}>{t.signIn}</Link>
      </Card>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateAsk({ kind, topic, subject, message });
    setErrs(v);
    if (Object.keys(v).length) return;
    setList([...list, { id: `m-${Date.now()}`, kind: kind as AskKind, topic, subject: subject.trim(), message: message.trim(), at: new Date().toISOString() }]);
    toast("success", t.askSent);
    setKind(""); setTopic(""); setSubject(""); setMessage("");
  }

  const topicLabel = (k: (typeof TOPICS)[number]) => t[`askTopic_${k}` as keyof typeof t] as string;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <RadioGroup legend={t.askKind} name="ask-kind" value={kind} onChange={(v) => setKind(v as AskKind)} error={errs.kind ? t.askErrKind : undefined}
        options={[{ value: "private", label: t.askKindPrivate, hint: t.askPrivateNote }, { value: "public", label: t.askKindPublic, hint: t.askPublicWarn }]} />
      <Select label={t.askTopic} placeholder={t.askChoose} value={topic} error={errs.topic ? t.askErrTopic : undefined} onChange={(e) => setTopic(e.target.value)} options={TOPICS.map((k) => ({ value: k, label: topicLabel(k) }))} />
      <Input label={t.askSubject} maxLength={120} value={subject} error={errs.subject ? t.askErrSubject : undefined} onChange={(e) => setSubject(e.target.value)} />
      <Textarea label={t.askMessage} rows={6} maxLength={2000} value={message} error={errs.message ? t.askErrMessage : undefined} onChange={(e) => setMessage(e.target.value)} />
      <p className="text-sm text-muted">{t.askGuidance}</p>
      <p className="text-sm" aria-live="polite">{left > 0 ? fillNum(t.askRemaining, { n: left }, lang) : t.askLimit}</p>
      <Button type="submit" size="lg" full disabled={left === 0}>{t.askSend}</Button>
    </form>
  );
}
