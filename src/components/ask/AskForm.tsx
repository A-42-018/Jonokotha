"use client";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import QueryProvider from "@/components/QueryProvider";
import { ApiError } from "@/lib/api-client";
import { askBody, askQuestion, type Asked } from "@/lib/ask-api";
import { newId } from "@/lib/offline-queue";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { RadioGroup } from "@/components/ui/Choice";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { TOPICS, validateAsk, type AskKind } from "@/lib/ask";

export default function AskForm(props: { signedIn: boolean; constituency: string }) {
  return <QueryProvider><AskInner {...props} /></QueryProvider>;
}

/** Ask Your MP form. Sign-in required. Posts to /api/v1/questions; a public question waits for moderation. */
function AskInner({ signedIn, constituency }: { signedIn: boolean; constituency: string }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [sent, setSent] = useState<Asked & { kind: AskKind }>();
  const key = useRef(newId()); // one Idempotency-Key per question: a double tap does not send twice
  const [kind, setKind] = useState<AskKind | "">("");
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errs, setErrs] = useState<ReturnType<typeof validateAsk>>({});

  const topicLabel = (k: (typeof TOPICS)[number]) => t[`askTopic_${k}` as keyof typeof t] as string;
  const send = useMutation({
    mutationFn: () => askQuestion(constituency, kind as AskKind, subject, askBody(topicLabel(topic as (typeof TOPICS)[number]), message), key.current),
    onSuccess: (r) => {
      toast("success", kind === "public" ? t.askSentPublic : t.askSent);
      setSent({ ...r, kind: kind as AskKind });
      setKind(""); setTopic(""); setSubject(""); setMessage("");
      key.current = newId();
    },
    onError: (e) => toast("error", e instanceof ApiError && e.status === 429 ? t.askLimit : e instanceof ApiError && e.status === 401 ? t.askNeedsSignIn : t.askSendFail),
  });

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
    send.mutate();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <RadioGroup legend={t.askKind} name="ask-kind" value={kind} onChange={(v) => setKind(v as AskKind)} error={errs.kind ? t.askErrKind : undefined}
        options={[{ value: "private", label: t.askKindPrivate, hint: t.askPrivateNote }, { value: "public", label: t.askKindPublic, hint: t.askPublicWarn }]} />
      <Select label={t.askTopic} placeholder={t.askChoose} value={topic} error={errs.topic ? t.askErrTopic : undefined} onChange={(e) => setTopic(e.target.value)} options={TOPICS.map((k) => ({ value: k, label: topicLabel(k) }))} />
      <Input label={t.askSubject} maxLength={120} value={subject} error={errs.subject ? t.askErrSubject : undefined} onChange={(e) => setSubject(e.target.value)} />
      <Textarea label={t.askMessage} rows={6} maxLength={2000} value={message} error={errs.message ? t.askErrMessage : undefined} onChange={(e) => setMessage(e.target.value)} />
      <p className="text-sm text-muted">{t.askGuidance}</p>
      <p className="text-sm text-muted">{t.askRateNote}</p>
      <Button type="submit" size="lg" full loading={send.isPending}>{t.askSend}</Button>
      {sent && (
        <div aria-live="polite" className="space-y-2">
          {sent.emergency && (
            // Fixed guidance from the server, shown as given (never replaced by model text).
            <div role="alert" className="rounded-xl border-2 border-danger bg-white p-4">
              <p className="font-semibold text-danger">{sent.emergency.guidance[lang]}</p>
              <p className="mt-1 text-lg font-semibold">{sent.emergency.numbers.join(" · ")}</p>
            </div>
          )}
          {sent.pii_removed.length > 0 && <p role="status" className="text-sm text-muted">{t.idPiiRemoved}</p>}
          <Link href="/ask/inbox" className="inline-flex min-h-11 items-center text-civic underline">{t.askInbox}</Link>
        </div>
      )}
    </form>
  );
}
