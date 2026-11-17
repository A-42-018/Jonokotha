"use client";
import Link from "next/link";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button, { buttonClass } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fillNum, fmtDate } from "@/lib/format";
import { QUEUE_KEY, type QueuedReport } from "@/lib/offline-queue";
import { flushNow } from "./queue-store";

const NONE: QueuedReport[] = [];

/** Reports saved on this phone while offline. Shows nothing when the queue is empty. */
export default function QueuedReports() {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [list, setList] = useLocalValue(QUEUE_KEY, NONE);
  const [busy, setBusy] = useState<string | null>(null);
  const [discard, setDiscard] = useState<QueuedReport | null>(null);
  if (list.length === 0) return null;

  async function sendNow(q: QueuedReport) {
    setBusy(q.id);
    if (!navigator.onLine) { toast("info", t.qStillOffline); setBusy(null); return; }
    const { sent, list: after } = await flushNow(q.id);
    for (const s of sent) toast("success", fillNum(t.qSentToast, { ref: s.ref }, lang));
    if (!sent.length && after[0]?.state === "needs-signin") toast("error", t.qSignInToSend);
    else if (!sent.length) toast("error", t.submitFail);
    setBusy(null);
  }
  const label = (s: QueuedReport["state"]) => (s === "queued" ? t.qStateQueued : s === "needs-signin" ? t.qStateSignin : t.qStateRejected);

  return (
    <Card title={t.qTitle} tone="warning">
      <p className="mb-3 text-sm text-muted">{t.qLead}</p>
      <ul className="space-y-3">
        {list.map((q) => (
          <li key={q.id} className="space-y-2 rounded-xl border border-line/40 bg-white p-3">
            <p className="break-words font-medium">{q.title}</p>
            <p className="text-sm text-muted">{fillNum(t.qSavedAt, { when: fmtDate(q.queuedAt, lang) }, lang)}</p>
            <Badge tone={q.state === "rejected" ? "danger" : "warning"} icon={q.state === "rejected" ? "!" : "⏳"}>{label(q.state)}</Badge>
            <div className="flex flex-wrap gap-2">
              {q.state === "needs-signin" && <Link href="/login?next=/me" className={buttonClass({ variant: "secondary" })}>{t.signIn}</Link>}
              {q.state !== "rejected" && <Button variant="secondary" loading={busy === q.id} onClick={() => void sendNow(q)}>{busy === q.id ? t.qSending : t.qSendNow}</Button>}
              <Button variant="ghost" disabled={busy === q.id} onClick={() => setDiscard(q)}>{t.qDiscard}</Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={!!discard}
        onClose={() => setDiscard(null)}
        title={t.qDiscardTitle}
        description={t.qDiscardBody}
        actions={<>
          <Button variant="secondary" onClick={() => setDiscard(null)}>{t.qDiscardNo}</Button>
          <Button variant="danger" onClick={() => { if (discard) setList((l) => l.filter((x) => x.id !== discard.id)); setDiscard(null); }}>{t.qDiscardYes}</Button>
        </>}
      />
    </Card>
  );
}
