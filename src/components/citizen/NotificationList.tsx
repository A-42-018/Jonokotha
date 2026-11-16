"use client";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useLocalValue } from "@/components/ui/useLocalValue";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/i18n";
import type { Notice } from "@/lib/sample";

export const READ_KEY = "jonokotha:notice-read:v1";
const NONE: string[] = [];
export const unreadOf = (list: Notice[], read: string[]) => list.filter((n) => !read.includes(n.id));

/** In-app notification centre (push later). Read state is device-local; items are sample until the API exists. */
export default function NotificationList({ notices }: { notices: Notice[] }) {
  const t = useT();
  const lang = useLang();
  const [read, setRead] = useLocalValue(READ_KEY, NONE);
  if (notices.length === 0) return <EmptyState title={t.ntEmptyTitle} body={t.ntEmptyBody} />;
  const unread = unreadOf(notices, read);
  return (
    <div className="space-y-3">
      {unread.length > 0 && <Button variant="secondary" onClick={() => setRead(notices.map((n) => n.id))}>{t.ntMarkAll}</Button>}
      <ul className="space-y-2">
        {notices.map((n) => {
          const isNew = !read.includes(n.id);
          return (
            <li key={n.id}>
              <Card as="article" padded={false} tone={isNew ? "info" : "default"} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{t[`ntKind_${n.kind}` as keyof typeof t] as string}</Badge>
                  <Badge tone="warning">{t.exSample}</Badge>
                  {isNew && <Badge tone="info" icon="●">{t.ntUnread}</Badge>}
                </div>
                <p>{lang === "bn" ? n.bn : n.en}</p>
                <p className="text-sm text-muted">{fmtDate(n.at, lang)}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={n.href} onClick={() => setRead((r) => (r.includes(n.id) ? r : [...r, n.id]))} className="inline-flex min-h-11 items-center text-civic underline">{t.ntOpen}</Link>
                  {isNew && <Button variant="ghost" onClick={() => setRead((r) => [...r, n.id])}>{t.ntMarkRead}</Button>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
