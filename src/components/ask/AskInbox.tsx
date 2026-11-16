"use client";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { ASK_KEY, NO_ASKS, type Topic } from "@/lib/ask";
import { fmtDate } from "@/lib/i18n";

/** Private inbox: this device's sent messages (no replies API yet) plus one labelled sample reply. */
export default function AskInbox() {
  const t = useT();
  const lang = useLang();
  const [list] = useLocalValue(ASK_KEY, NO_ASKS);
  const rows = [...list].reverse();
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState title={t.askInboxEmptyTitle} body={t.askInboxEmptyBody} action={<Link href="/ask" className={buttonClass()}>{t.askBackAsk}</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id}>
              <Card as="article">
                <h2 className="font-semibold">{m.subject}</h2>
                <p className="text-sm text-muted">{t[`askTopic_${m.topic as Topic}` as keyof typeof t] as string} · {fmtDate(m.at, lang)}</p>
                <p className="my-2 whitespace-pre-wrap break-words">{m.message}</p>
                <div className="flex flex-wrap gap-2"><Badge tone="neutral">{m.kind === "private" ? t.askPrivateTag : t.askPublicTag}</Badge><Badge tone="info">{t.askStatusSent}</Badge></div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Card tone="info" title={t.askSampleReplyTitle}>
        <Badge tone="warning">{t.exSample}</Badge>
        <p className="mt-2">{t.askSampleReply}</p>
      </Card>
    </div>
  );
}
