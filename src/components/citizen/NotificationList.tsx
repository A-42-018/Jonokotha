"use client";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import QueryProvider from "@/components/QueryProvider";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { useLang } from "@/components/ui/useLang";
import { useT } from "@/components/ui/useT";
import { fmtDate } from "@/lib/format";
import { fetchNotices, kindOf, markAllRead, markRead, noticeHref, noticeText } from "@/lib/notifications-api";

export default function NotificationList() {
  return <QueryProvider><ListInner /></QueryProvider>;
}

/** In-app notification centre from /me/notifications. Read state is the server's. Text is generic (reference number and a short label). */
function ListInner() {
  const t = useT();
  const lang = useLang();
  const qc = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["notices"], queryFn: ({ pageParam }) => fetchNotices(pageParam),
    initialPageParam: undefined as string | undefined, getNextPageParam: (l) => l.next ?? undefined,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["notices"] });
  const one = useMutation({ mutationFn: markRead, onSuccess: refresh });
  const all = useMutation({ mutationFn: markAllRead, onSuccess: refresh });
  const notices = q.data?.pages.flatMap((p) => p.items) ?? [];

  if (q.isPending) return <p role="status" className="text-muted">{t.exLoading}</p>;
  if (q.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber/60 bg-amber/10 p-3 text-sm">
        <p>{t.ntLoadError}</p>
        <Button variant="secondary" onClick={() => void q.refetch()}>{t.exRetry}</Button>
      </div>
    );
  }
  if (notices.length === 0) return <EmptyState title={t.ntEmptyTitle} body={t.ntEmptyBody} />;
  const unread = notices.filter((n) => !n.read_at);
  return (
    <div className="space-y-3">
      {unread.length > 0 && <Button variant="secondary" loading={all.isPending} onClick={() => all.mutate()}>{t.ntMarkAll}</Button>}
      <ul className="space-y-2">
        {notices.map((n) => {
          const isNew = !n.read_at;
          const text = noticeText(n, lang);
          return (
            <li key={n.id}>
              <Card as="article" padded={false} tone={isNew ? "info" : "default"} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{t[`ntKind_${kindOf(n.type)}` as keyof typeof t] as string}</Badge>
                  {isNew && <Badge tone="info" icon="●">{t.ntUnread}</Badge>}
                </div>
                <p className="font-medium">{text.title}</p>
                {text.body && <p>{text.body}</p>}
                <p className="text-sm text-muted">{fmtDate(n.created_at, lang)}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={noticeHref(n)} onClick={() => { if (isNew) one.mutate(n.id); }} className="inline-flex min-h-11 items-center text-civic underline">{t.ntOpen}</Link>
                  {isNew && <Button variant="ghost" onClick={() => one.mutate(n.id)}>{t.ntMarkRead}</Button>}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {q.hasNextPage && <div className="text-center"><Button variant="secondary" loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>{t.exLoadMore}</Button></div>}
    </div>
  );
}
